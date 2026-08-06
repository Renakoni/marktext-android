package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumentation smoke for the real SAF read/write paths — the
 * ContentResolver-coupled behavior that the JVM SafeDocumentWriterTest and
 * ContentResolverDocumentIoTest cannot cover because they run against a fake.
 * Backed by {@link TestDocumentProvider} so no system picker UI is involved;
 * every document is seeded and verified through the real ContentResolver, which
 * also keeps the test and the (different-UID) provider from touching each
 * other's files directly.
 */
@RunWith(AndroidJUnit4.class)
public final class SafDocumentIoInstrumentationTest {

    private ContentResolver resolver;

    @Before
    public void setUp() {
        // The app (target) context owns the resolver the production code uses.
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        resolver = context.getContentResolver();
    }

    private Uri seedDocument(String fileName, String contents) throws Exception {
        Uri uri = TestDocumentProvider.uriFor(fileName);
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            output.write(contents.getBytes(StandardCharsets.UTF_8));
        }
        return uri;
    }

    @Test
    public void readsExistingDocumentThroughRealResolver() throws Exception {
        Uri uri = seedDocument("read.md", "# Existing\n\nReal resolver read.");

        byte[] bytes = new ContentResolverDocumentIo(resolver, uri, MarkdownCodec.MAX_MARKDOWN_BYTES)
            .readBytes();

        assertEquals("# Existing\n\nReal resolver read.", new String(bytes, StandardCharsets.UTF_8));
    }

    @Test
    public void overwritesExistingDocumentAtomicallyAndReadsItBack() throws Exception {
        Uri uri = seedDocument("write.md", "# Old body");
        byte[] next = "# New body\n\nRewritten through the real truncating descriptor."
            .getBytes(StandardCharsets.UTF_8);

        ContentResolverDocumentIo io =
            new ContentResolverDocumentIo(resolver, uri, MarkdownCodec.MAX_MARKDOWN_BYTES);
        // protectExisting=true drives the full read-backup -> truncate -> write
        // -> fsync -> length-verify path against a real content descriptor.
        SafeDocumentWriter.write(io, next, true);

        assertArrayEquals(next, io.readBytes());
    }

    @Test
    public void writesFreshlyCreatedDocument() throws Exception {
        // No seed: the write path itself creates the document, as it does for a
        // freshly created SAF file (protectExisting=false, no backup).
        Uri uri = TestDocumentProvider.uriFor("fresh.md");
        byte[] body = "# Fresh\n\nNo backup path.".getBytes(StandardCharsets.UTF_8);

        ContentResolverDocumentIo io =
            new ContentResolverDocumentIo(resolver, uri, MarkdownCodec.MAX_MARKDOWN_BYTES);
        SafeDocumentWriter.write(io, body, false);

        assertArrayEquals(body, io.readBytes());
    }
}
