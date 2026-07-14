package io.github.renakoni.marktextandroid;

import java.io.File;
import java.util.Set;

final class ImportedImageStorage {

    static final class Stats {

        final int fileCount;
        final long bytes;

        Stats(int fileCount, long bytes) {
            this.fileCount = fileCount;
            this.bytes = bytes;
        }
    }

    static final class CleanupResult {

        final Stats stats;
        final int removedFileCount;
        final long removedBytes;
        final int failedFileCount;

        CleanupResult(
            Stats stats,
            int removedFileCount,
            long removedBytes,
            int failedFileCount
        ) {
            this.stats = stats;
            this.removedFileCount = removedFileCount;
            this.removedBytes = removedBytes;
            this.failedFileCount = failedFileCount;
        }
    }

    private ImportedImageStorage() {}

    static Stats inspect(File directory) {
        File[] files = listFiles(directory);
        int fileCount = 0;
        long bytes = 0;
        for (File file : files) {
            if (!file.isFile()) {
                continue;
            }
            fileCount += 1;
            bytes += file.length();
        }
        return new Stats(fileCount, bytes);
    }

    static CleanupResult cleanup(
        File directory,
        Set<String> referencedFileNames,
        Set<String> managedFileNames
    ) {
        int removedFileCount = 0;
        long removedBytes = 0;
        int failedFileCount = 0;

        for (File file : listFiles(directory)) {
            if (
                !file.isFile()
                || !managedFileNames.contains(file.getName())
                || referencedFileNames.contains(file.getName())
            ) {
                continue;
            }

            long bytes = file.length();
            if (file.delete()) {
                removedFileCount += 1;
                removedBytes += bytes;
            } else {
                failedFileCount += 1;
            }
        }

        return new CleanupResult(
            inspect(directory),
            removedFileCount,
            removedBytes,
            failedFileCount
        );
    }

    private static File[] listFiles(File directory) {
        if (!directory.isDirectory()) {
            return new File[0];
        }
        File[] files = directory.listFiles();
        return files == null ? new File[0] : files;
    }
}
