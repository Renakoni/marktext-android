package io.github.renakoni.marktextandroid;

import android.content.ContentResolver;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.ByteArrayOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

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
        // "rwt": read-write + truncate. "rw" implies a seekable on-disk file so
        // the written length can be verified; "t" forces truncation (since
        // Android 10 a bare "w" may leave trailing bytes).
        ParcelFileDescriptor descriptor = resolver.openFileDescriptor(uri, "rwt");
        if (descriptor == null) {
            throw new IOException("Content resolver returned no file descriptor");
        }
        return new DescriptorWriteHandle(descriptor);
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
        public void sync() {
            // Durability: on Android (ext4) close() alone does not guarantee the
            // bytes reach disk. Best-effort — a provider backed by a pipe cannot
            // sync, and that must not fail an otherwise good write.
            try {
                FileDescriptor fd = descriptor.getFileDescriptor();
                if (fd != null && fd.valid()) {
                    fd.sync();
                }
            } catch (IOException ignored) {
                // best-effort durability only
            }
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
