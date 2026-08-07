package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumentation smoke for the seam between intent parsing and real document
 * I/O — deliberately NOT an end-to-end incoming-intent test. It constructs an
 * {@code ACTION_VIEW} / {@code ACTION_SEND} {@link Intent} directly, classifies
 * it with {@link IncomingIntentParser}, and reads the resulting content URI back
 * through the actual ContentResolver.
 *
 * <p>It does NOT launch {@code MainActivity}, pass through the manifest intent
 * filters, or exercise {@code AndroidDocumentsPlugin.handleIncomingIntent} / the
 * plugin's JS event path — so a broken filter, missing {@code onNewIntent}, or a
 * dropped URI grant would NOT be caught here. That dispatch chain is covered by
 * the on-device share-intent verification recorded on #158. What this adds over
 * the JVM {@code IncomingIntentParserTest} is that the parsed URI points at
 * content the real resolver can actually read.
 */
@RunWith(AndroidJUnit4.class)
public final class IntentUriResolverReadInstrumentationTest {

    private ContentResolver resolver;

    @Before
    public void setUp() {
        // The app (target) context owns the resolver the production code uses.
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        resolver = context.getContentResolver();
    }

    private Uri seedDocument(String fileName, String contents) throws Exception {
        // Seed through the resolver so the test never touches the (different-UID)
        // provider's files directly.
        Uri uri = TestDocumentProvider.uriFor(fileName);
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            output.write(contents.getBytes(StandardCharsets.UTF_8));
        }
        return uri;
    }

    private String readThrough(Uri uri) throws Exception {
        byte[] bytes = new ContentResolverDocumentIo(resolver, uri, MarkdownCodec.MAX_MARKDOWN_BYTES)
            .readBytes();
        return new String(bytes, StandardCharsets.UTF_8);
    }

    @Test
    public void openWithIntentUriIsClassifiedAndReadable() throws Exception {
        Uri uri = seedDocument("open-with.md", "# Open with\n\nFrom ACTION_VIEW.");
        Intent intent = new Intent(Intent.ACTION_VIEW).setData(uri);

        IncomingIntentParser.Result result = IncomingIntentParser.parse(intent);

        assertEquals(IncomingIntentParser.Kind.OPEN_WITH_DOCUMENT, result.kind);
        assertEquals(uri, result.uri);
        assertEquals("# Open with\n\nFrom ACTION_VIEW.", readThrough(result.uri));
    }

    @Test
    public void shareStreamIntentUriIsClassifiedAndReadable() throws Exception {
        Uri uri = seedDocument("share-stream.md", "# Shared stream\n\nFrom ACTION_SEND.");
        Intent intent = new Intent(Intent.ACTION_SEND)
            .setType("text/markdown")
            .putExtra(Intent.EXTRA_STREAM, uri);

        IncomingIntentParser.Result result = IncomingIntentParser.parse(intent);

        assertEquals(IncomingIntentParser.Kind.SHARE_STREAM, result.kind);
        assertEquals(uri, result.uri);
        assertEquals("# Shared stream\n\nFrom ACTION_SEND.", readThrough(result.uri));
    }
}
