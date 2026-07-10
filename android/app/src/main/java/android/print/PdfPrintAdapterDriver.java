package android.print;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

/**
 * Drives a PrintDocumentAdapter straight to a PDF file, without the system
 * print dialog. Lives in the android.print package because the
 * LayoutResultCallback / WriteResultCallback constructors are package-private:
 * both classes are public SDK types on the greylist, and same-package
 * compilation is the established way apps subclass them (the technique behind
 * the common WebView-to-PDF converters). Runs on whichever thread the adapter
 * expects — for WebView adapters that is the main thread.
 *
 * The caller owns the CancellationSignal: cancelling it aborts an in-flight
 * layout or write, and the cancelled callbacks below still close the adapter
 * lifecycle and report through the listener (the caller's completion guard
 * drops duplicate deliveries). Synchronous adapter failures are reported the
 * same way instead of escaping as uncaught exceptions.
 */
public final class PdfPrintAdapterDriver {

    public interface Listener {
        void onSuccess();
        void onFailure(String message);
    }

    private PdfPrintAdapterDriver() {}

    public static void print(
        final PrintDocumentAdapter adapter,
        PrintAttributes attributes,
        final ParcelFileDescriptor destination,
        final CancellationSignal cancellationSignal,
        final Listener listener
    ) {
        try {
            adapter.onStart();
            adapter.onLayout(
                null,
                attributes,
                cancellationSignal,
                new PrintDocumentAdapter.LayoutResultCallback() {
                    @Override
                    public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                        try {
                            adapter.onWrite(
                                new PageRange[] { PageRange.ALL_PAGES },
                                destination,
                                cancellationSignal,
                                new PrintDocumentAdapter.WriteResultCallback() {
                                    @Override
                                    public void onWriteFinished(PageRange[] pages) {
                                        finish(adapter);
                                        listener.onSuccess();
                                    }

                                    @Override
                                    public void onWriteFailed(CharSequence error) {
                                        finish(adapter);
                                        listener.onFailure(error == null ? "PDF write failed" : error.toString());
                                    }

                                    @Override
                                    public void onWriteCancelled() {
                                        finish(adapter);
                                        listener.onFailure("PDF write cancelled");
                                    }
                                }
                            );
                        } catch (RuntimeException ex) {
                            finish(adapter);
                            listener.onFailure("PDF write could not start: " + ex);
                        }
                    }

                    @Override
                    public void onLayoutFailed(CharSequence error) {
                        finish(adapter);
                        listener.onFailure(error == null ? "PDF layout failed" : error.toString());
                    }

                    @Override
                    public void onLayoutCancelled() {
                        finish(adapter);
                        listener.onFailure("PDF layout cancelled");
                    }
                },
                new Bundle()
            );
        } catch (RuntimeException ex) {
            finish(adapter);
            listener.onFailure("PDF print could not start: " + ex);
        }
    }

    private static void finish(PrintDocumentAdapter adapter) {
        try {
            adapter.onFinish();
        } catch (RuntimeException ignored) {
            // The adapter may already be torn down with its WebView.
        }
    }
}
