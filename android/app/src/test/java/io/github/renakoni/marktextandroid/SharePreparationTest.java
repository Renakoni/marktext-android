package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

public class SharePreparationTest {

    @Test
    public void normalizesSuggestedNamesToSafeMarkdownFiles() {
        assertEquals("Meeting A B.md", SharePreparation.normalizeSuggestedMarkdownName("Meeting: A/B?"));
        assertEquals("Untitled.md", SharePreparation.normalizeSuggestedMarkdownName("   "));
        assertEquals("notes.markdown", SharePreparation.normalizeSuggestedMarkdownName("notes.markdown"));
        assertEquals("Trip plan.md", SharePreparation.normalizeSuggestedMarkdownName("  Trip   plan  "));
    }

    @Test
    public void normalizesSuggestedNamesToSafePdfFiles() {
        assertEquals("Meeting A B.pdf", SharePreparation.normalizeSuggestedPdfName("Meeting: A/B?"));
        assertEquals("Untitled.pdf", SharePreparation.normalizeSuggestedPdfName("   "));
        assertEquals("Untitled.pdf", SharePreparation.normalizeSuggestedPdfName(null));
        assertEquals("Trip notes.PDF", SharePreparation.normalizeSuggestedPdfName("Trip notes.PDF"));
        assertEquals("notes.md.pdf", SharePreparation.normalizeSuggestedPdfName("notes.md"));
        assertEquals("Trip plan.pdf", SharePreparation.normalizeSuggestedPdfName("  Trip   plan  "));
    }

    @Test
    public void deduplicatesBatchFileNamesCaseInsensitively() {
        Set<String> used = new HashSet<>();

        assertEquals("Trip.md", SharePreparation.uniqueShareFileName("Trip.md", used));
        assertEquals("trip 2.md", SharePreparation.uniqueShareFileName("trip.md", used));
        assertEquals("Trip 3.md", SharePreparation.uniqueShareFileName("Trip.md", used));
        assertEquals("Other.md", SharePreparation.uniqueShareFileName("Other.md", used));
    }

    @Test
    public void rejectsUnsafeImportedImageNames() {
        assertEquals("", SharePreparation.normalizeImportedImageFileName("../escape.png"));
        assertEquals("", SharePreparation.normalizeImportedImageFileName("dir\\escape.png"));
        assertEquals("", SharePreparation.normalizeImportedImageFileName("script.js"));
        assertEquals("", SharePreparation.normalizeImportedImageFileName(null));
        assertEquals("photo.webp", SharePreparation.normalizeImportedImageFileName(" photo.webp "));
    }

    @Test
    public void recognizesSupportedImageExtensions() {
        assertTrue(SharePreparation.hasSupportedImageExtension("a.PNG"));
        assertTrue(SharePreparation.hasSupportedImageExtension("a.svg"));
        assertFalse(SharePreparation.hasSupportedImageExtension("a.bmp"));
    }

    @Test
    public void copiesShareImagesByteForByte() throws Exception {
        File directory = Files.createTempDirectory("share-prep-test").toFile();
        File source = new File(directory, "source.bin");
        byte[] payload = new byte[] { 1, 2, 3, 4, 5 };
        try (FileOutputStream output = new FileOutputStream(source)) {
            output.write(payload);
        }

        File copied = SharePreparation.copyShareImageFile(directory, "picture.png", source);

        assertEquals("picture.png", copied.getName());
        assertArrayEquals(payload, Files.readAllBytes(copied.toPath()));
    }

    @Test
    public void refusesToCopyImagesWithInvalidNames() throws Exception {
        File directory = Files.createTempDirectory("share-prep-test").toFile();
        File source = new File(directory, "source.bin");
        assertTrue(source.createNewFile());

        try {
            SharePreparation.copyShareImageFile(directory, "../escape.png", source);
            fail("expected SecurityException");
        } catch (SecurityException expected) {
            // Path-traversal names must never reach the filesystem.
        }
    }
}
