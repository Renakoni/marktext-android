package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import org.junit.Test;

public class ImportedImageStorageTest {

    @Test
    public void reportsFilesAndBytesWithoutCountingDirectories() throws Exception {
        File directory = Files.createTempDirectory("imported-images-test").toFile();
        writeBytes(new File(directory, "one.png"), 3);
        writeBytes(new File(directory, "two.webp"), 5);
        assertTrue(new File(directory, "nested").mkdir());

        ImportedImageStorage.Stats stats = ImportedImageStorage.inspect(directory);

        assertEquals(2, stats.fileCount);
        assertEquals(8L, stats.bytes);
    }

    @Test
    public void removesOnlyManagedUnreferencedFilesAndKeepsDirectories() throws Exception {
        File directory = Files.createTempDirectory("imported-images-test").toFile();
        File referenced = new File(directory, "shared.png");
        File orphan = new File(directory, "orphan.png");
        File legacy = new File(directory, "legacy.png");
        File nested = new File(directory, "nested");
        writeBytes(referenced, 4);
        writeBytes(orphan, 6);
        writeBytes(legacy, 8);
        assertTrue(nested.mkdir());

        ImportedImageStorage.CleanupResult result = ImportedImageStorage.cleanup(
            directory,
            Collections.singleton("shared.png"),
            new HashSet<>(Arrays.asList("shared.png", "orphan.png"))
        );

        assertTrue(referenced.exists());
        assertFalse(orphan.exists());
        assertTrue(legacy.exists());
        assertTrue(nested.exists());
        assertEquals(1, result.removedFileCount);
        assertEquals(6L, result.removedBytes);
        assertEquals(0, result.failedFileCount);
        assertEquals(2, result.stats.fileCount);
        assertEquals(12L, result.stats.bytes);
    }

    @Test
    public void treatsAMissingDirectoryAsEmpty() {
        File missing = new File("missing-imported-images-" + System.nanoTime());

        ImportedImageStorage.Stats stats = ImportedImageStorage.inspect(missing);
        ImportedImageStorage.CleanupResult cleanup = ImportedImageStorage.cleanup(
            missing,
            Collections.emptySet(),
            Collections.emptySet()
        );

        assertEquals(0, stats.fileCount);
        assertEquals(0L, stats.bytes);
        assertEquals(0, cleanup.removedFileCount);
        assertEquals(0L, cleanup.removedBytes);
    }

    private static void writeBytes(File file, int count) throws Exception {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(new byte[count]);
        }
    }
}
