package io.github.renakoni.marktextandroid;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.print.PdfPrintAdapterDriver;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.util.Log;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.IOException;

/**
 * Renders export HTML in a detached WebView and prints it to a PDF file
 * through the platform print pipeline — the same paginated vector output as
 * the system "Save as PDF" printer, minus the dialog. The export document is
 * self-contained (inlined styles, embedded fonts, pre-rendered math and
 * diagrams); only image subresources load, from file URIs inside this app's
 * sandbox or over the network.
 */
final class PdfExporter {

    private static final String TAG = "MarkTextAndroid";
    private static final long EXPORT_TIMEOUT_MS = 30_000;
    // Bounded readiness gate: the document is polled until images and fonts
    // reach a terminal state, then printed. If readiness is never reached
    // (e.g. a remote image on a stalled connection), printing proceeds once
    // the readiness budget runs out rather than failing the whole export.
    private static final long READY_POLL_INTERVAL_MS = 250;
    private static final long READY_POLL_BUDGET_MS = 10_000;
    // document.readyState covers parsing; an image is ready once `complete`
    // (loaded OR failed — a broken remote image must not stall the export);
    // document.fonts settles once the embedded KaTeX fonts are applied.
    private static final String DOCUMENT_READY_PROBE =
        "(function(){" +
        "if(document.readyState!=='complete')return false;" +
        "var imgs=document.images;" +
        "for(var i=0;i<imgs.length;i++){if(!imgs[i].complete)return false;}" +
        "return !document.fonts||document.fonts.status==='loaded';" +
        "})()";

    interface Callback {
        void onSuccess();
        void onFailure(String code, String message);
    }

    private PdfExporter() {}

    /** Must be called on the main thread. */
    static void export(Context context, String html, String jobName, File outputFile, Callback callback) {
        new ExportSession(context, html, jobName, outputFile, callback).start();
    }

    /**
     * One export session owns every live resource — the WebView, the delayed
     * timeout and readiness runnables, the print adapter's cancellation
     * signal, the output descriptor, and the output file — so success,
     * failure, and timeout all run the same single-shot teardown: pending
     * work is unscheduled, an in-flight layout or write is aborted through
     * the signal, the descriptor is closed, the WebView is destroyed, and a
     * partial PDF is deleted on any non-success outcome. Callback delivery
     * happens exactly once.
     */
    private static final class ExportSession {

        private final Context context;
        private final String html;
        private final String jobName;
        private final File outputFile;
        private final Callback callback;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final CancellationSignal printCancellation = new CancellationSignal();

        private WebView webView;
        private Runnable timeoutRunnable;
        private Runnable pendingPollRunnable;
        private ParcelFileDescriptor destination;
        private long readinessDeadline;
        private boolean printStarted;
        private boolean finished;

        ExportSession(Context context, String html, String jobName, File outputFile, Callback callback) {
            this.context = context;
            this.html = html;
            this.jobName = jobName;
            this.outputFile = outputFile;
            this.callback = callback;
        }

        // SetJavaScriptEnabled is suppressed deliberately; the script trust
        // boundary here is narrow and must stay that way:
        //  - this WebView is transient and detached, and every outcome
        //    (success, failure, timeout) destroys it;
        //  - no JavascriptInterface and no Capacitor bridge are attached;
        //  - the only script that ever runs is DOCUMENT_READY_PROBE, which
        //    reads document/image/font readiness and nothing else;
        //  - the loaded HTML is generated locally by the Muya export
        //    renderer and DOMPurify-sanitized: script tags, event-handler
        //    attributes, and javascript: URLs are stripped (locked in by
        //    the sanitizer-boundary test in pdfExportHtml.test.ts).
        // Do not attach interfaces to or load remote documents into this
        // WebView.
        @SuppressLint("SetJavaScriptEnabled")
        void start() {
            timeoutRunnable = () -> {
                Log.e(TAG, "PDF export timed out");
                fail("PDF_EXPORT_FAILED", "PDF export timed out");
            };
            handler.postDelayed(timeoutRunnable, EXPORT_TIMEOUT_MS);

            try {
                webView = new WebView(context);
            } catch (RuntimeException ex) {
                Log.e(TAG, "Could not create PDF export WebView", ex);
                fail("PDF_EXPORT_FAILED", "Could not render the document for PDF export");
                return;
            }

            WebSettings settings = webView.getSettings();
            // Only the readiness probe runs; see the boundary note on this
            // method for why enabling JavaScript is safe here.
            settings.setJavaScriptEnabled(true);
            // The export HTML references imported images by file URI inside
            // this app's own sandbox; nothing outside it is reachable from
            // the sanitized document.
            settings.setAllowFileAccess(true);
            settings.setLoadsImagesAutomatically(true);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (finished || printStarted) {
                        return;
                    }
                    readinessDeadline = SystemClock.uptimeMillis() + READY_POLL_BUDGET_MS;
                    pollDocumentReady();
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (!request.isForMainFrame()) {
                        // A missing image must not abort the whole document.
                        return;
                    }
                    Log.e(TAG, "PDF export document failed to load: " + error.getDescription());
                    fail("PDF_EXPORT_FAILED", "Could not render the document for PDF export");
                }
            });

            // The file base URL keeps the document in a file origin so the
            // image file URIs above are loadable; the export HTML itself
            // carries no relative references into the app assets.
            webView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "utf-8", null);
        }

        private void pollDocumentReady() {
            pendingPollRunnable = null;
            if (finished || printStarted) {
                return;
            }

            webView.evaluateJavascript(DOCUMENT_READY_PROBE, value -> {
                if (finished || printStarted) {
                    return;
                }

                boolean ready = "true".equals(value);
                if (ready || SystemClock.uptimeMillis() >= readinessDeadline) {
                    if (!ready) {
                        Log.w(TAG, "PDF export proceeding before full resource readiness");
                    }
                    print();
                    return;
                }

                pendingPollRunnable = this::pollDocumentReady;
                handler.postDelayed(pendingPollRunnable, READY_POLL_INTERVAL_MS);
            });
        }

        private void print() {
            if (finished || printStarted) {
                return;
            }
            printStarted = true;

            PrintAttributes attributes = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 600, 600))
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                // Page margins come from the export document's @page CSS, so
                // the print pipeline itself adds none.
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();

            try {
                destination = ParcelFileDescriptor.open(
                    outputFile,
                    ParcelFileDescriptor.MODE_CREATE |
                    ParcelFileDescriptor.MODE_TRUNCATE |
                    ParcelFileDescriptor.MODE_READ_WRITE
                );
            } catch (IOException ex) {
                Log.e(TAG, "Could not open PDF export output file", ex);
                fail("PDF_WRITE_FAILED", "Could not prepare the PDF file for sharing");
                return;
            }

            try {
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                PdfPrintAdapterDriver.print(adapter, attributes, destination, printCancellation, new PdfPrintAdapterDriver.Listener() {
                    @Override
                    public void onSuccess() {
                        succeed();
                    }

                    @Override
                    public void onFailure(String message) {
                        Log.e(TAG, "PDF print pipeline failed: " + message);
                        fail("PDF_EXPORT_FAILED", "Could not export this document as a PDF");
                    }
                });
            } catch (RuntimeException ex) {
                Log.e(TAG, "PDF print pipeline could not start", ex);
                fail("PDF_EXPORT_FAILED", "Could not export this document as a PDF");
            }
        }

        private void succeed() {
            if (!complete()) {
                return;
            }
            callback.onSuccess();
        }

        private void fail(String code, String message) {
            if (!complete()) {
                return;
            }
            if (outputFile.exists() && !outputFile.delete()) {
                Log.w(TAG, "Could not delete partial PDF export output");
            }
            callback.onFailure(code, message);
        }

        /** Single-shot teardown of every session-owned resource. */
        private boolean complete() {
            if (finished) {
                return false;
            }
            finished = true;

            if (timeoutRunnable != null) {
                handler.removeCallbacks(timeoutRunnable);
            }
            if (pendingPollRunnable != null) {
                handler.removeCallbacks(pendingPollRunnable);
            }
            // Aborts an in-flight layout or write; the driver's cancelled
            // callbacks then close the adapter lifecycle and report back
            // here, where the delivery is dropped as a duplicate.
            printCancellation.cancel();
            if (destination != null) {
                try {
                    destination.close();
                } catch (IOException ex) {
                    Log.w(TAG, "Could not close PDF export descriptor", ex);
                }
            }
            if (webView != null) {
                webView.stopLoading();
                webView.destroy();
            }
            return true;
        }
    }
}
