package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumentation smoke that the PDF export completes end to end through the
 * real platform print pipeline (WebView render -> PrintDocumentAdapter ->
 * PdfDocument), producing a valid file. None of this is reachable from a JVM
 * test: it needs a live WebView and android.print.
 */
@RunWith(AndroidJUnit4.class)
public final class PdfExportInstrumentationTest {

    private static final String EXPORT_HTML =
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
            + "<body><h1>PDF smoke</h1><p>Instrumentation export.</p></body></html>";

    @Test
    public void exportsAValidPdfFile() throws Exception {
        // The app context owns the WebView/print stack the exporter drives.
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File output = new File(context.getCacheDir(), "instrumentation-export.pdf");
        if (output.exists() && !output.delete()) {
            throw new IllegalStateException("could not clear stale export output");
        }

        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> failure = new AtomicReference<>();

        // export() must run on the main thread (it creates a WebView).
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
            PdfExporter.export(context, EXPORT_HTML, "instrumentation-export", output,
                new PdfExporter.Callback() {
                    @Override
                    public void onSuccess() {
                        done.countDown();
                    }

                    @Override
                    public void onFailure(String code, String message) {
                        failure.set(code + ": " + message);
                        done.countDown();
                    }
                }));

        // The exporter's own timeout is 30s; wait a little longer so a timeout
        // surfaces as its failure callback rather than as a latch expiry.
        assertTrue("PDF export did not complete within 40s", done.await(40, TimeUnit.SECONDS));
        assertNull("PDF export reported a failure", failure.get());

        assertTrue("export output file is missing", output.exists());
        assertTrue("export output file is empty", output.length() > 0);

        byte[] header = new byte[5];
        try (FileInputStream input = new FileInputStream(output)) {
            assertEquals("could not read the PDF header", 5, input.read(header));
        }
        assertEquals("%PDF-", new String(header, StandardCharsets.US_ASCII));
    }
}
