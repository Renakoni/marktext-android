package io.github.renakoni.marktextandroid;

import android.content.ContentResolver;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.ByteArrayOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SyncFailedException;

/**
 * {@link SafeDocumentWriter.DocumentIo} backed by a {@link ContentResolver} and
 * a single document {@link Uri}. This is the only Android-coupled part of the
 * atomic-write path; the algorithm in {@link SafeDocumentWriter} stays pure and
 * unit tested against a fake.
 */
final class ContentResolverDocumentIo implements SafeDocumentWriter.DocumentIo {
    private final ContentResolver resolver;
    private final Uri uri;
    private final int maxBytes;

    ContentResolverDocumentIo(ContentResolver resolver, Uri uri, int maxBytes) {
        this.resolver = resolver;
        this.uri = uri;
        this.maxBytes = maxBytes;
    }

    @Override
    public byte[] readBytes() throws IOException {
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) {
                throw new IOException("Content resolver returned no input stream");
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new IOException("Existing document exceeds the " + maxBytes + " byte limit");
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    @Override
    public SafeDocumentWriter.WriteHandle openWrite() throws IOException {
        // Prefer "rwt": read-write + truncate — a seekable on-disk descriptor
        // that lets the write be length-verified and fsync'd; "t" forces
        // truncation (since Android 10 a bare "w" may leave trailing bytes).
        ParcelFileDescriptor descriptor = tryOpen("rwt");
        if (descriptor == null) {
            // A streaming-only provider (some cloud/remote SAF backends) may not
            // expose a seekable read-write descriptor; fall back to write-only
            // truncating. Backup/rollback and closeWithError still apply — only
            // the length verify and fsync are unavailable on the resulting
            // non-seekable descriptor. A genuinely missing document surfaces
            // from this final attempt (mapped to DOCUMENT_NOT_FOUND).
            descriptor = resolver.openFileDescriptor(uri, "wt");
        }
        if (descriptor == null) {
            throw new IOException("Content resolver returned no file descriptor");
        }
        return new DescriptorWriteHandle(descriptor);
    }

    // Open in a mode, returning null when the provider does not support it so
    // the caller can fall back, rather than failing the whole write.
    private ParcelFileDescriptor tryOpen(String mode) {
        try {
            return resolver.openFileDescriptor(uri, mode);
        } catch (IOException | IllegalArgumentException | UnsupportedOperationException error) {
            return null;
        }
    }

    private static final class DescriptorWriteHandle implements SafeDocumentWriter.WriteHandle {
        private final ParcelFileDescriptor descriptor;
        private final FileOutputStream output;

        DescriptorWriteHandle(ParcelFileDescriptor descriptor) {
            this.descriptor = descriptor;
            this.output = new FileOutputStream(descriptor.getFileDescriptor());
        }

        @Override
        public void write(byte[] bytes) throws IOException {
            output.write(bytes);
            output.flush();
        }

        @Override
        public void sync() throws IOException {
            // Durability: on Android (ext4) close() alone does not guarantee the
            // bytes reach disk.
            FileDescriptor fd = descriptor.getFileDescriptor();
            if (fd == null || !fd.valid()) {
                return;
            }
            try {
                fd.sync();
            } catch (SyncFailedException error) {
                // On a seekable on-disk descriptor a sync failure is a real
                // durability failure (disk full, I/O error) — propagate so the
                // caller aborts and restores. A non-seekable streaming
                // descriptor legitimately cannot sync; skip it quietly.
                if (isSeekable()) {
                    throw error;
                }
            }
        }

        private boolean isSeekable() {
            // A regular on-disk file reports a stat size; a pipe/socket returns
            // -1 — mirrors length()'s capability to report a size.
            return descriptor.getStatSize() >= 0;
        }

        @Override
        public long length() {
            try {
                return output.getChannel().size();
            } catch (IOException error) {
                // Non-seekable provider (e.g. a cloud pipe): length is unknown,
                // so the caller skips the verify and relies on sync + close.
                return -1;
            }
        }

        @Override
        public void commit() throws IOException {
            output.close();
            descriptor.close();
        }

        @Override
        public void abort(String reason) {
            // Tell the provider the write is bad so it discards the partial
            // result (well-behaved cloud providers stage on write and commit on
            // clean close). Deliberately do NOT close `output`, which would
            // commit; closeWithError closes the descriptor with the error.
            try {
                descriptor.closeWithError(reason != null ? reason : "document write aborted");
            } catch (IOException ignored) {
                // nothing more we can do
            }
        }
    }
}
