package io.github.renakoni.marktextandroid;

import java.io.IOException;

/**
 * Writes bytes to an already-granted Storage Access Framework document with
 * all-or-nothing intent: a mid-write failure must never leave the user's real
 * file truncated or half-written.
 *
 * <p>SAF offers no atomic replace for a bare document URI — the app holds only
 * a single-document grant (no parent tree), and {@code renameDocument} cannot
 * overwrite an existing name — so true filesystem rename-atomicity is
 * unreachable here. This emulates it at the application layer:
 *
 * <ol>
 *   <li>back up the existing bytes BEFORE anything is truncated,</li>
 *   <li>truncate + write the new bytes, fsync, and verify the written length,</li>
 *   <li>on ANY failure, tell the provider to discard the partial write and
 *       restore the backup so the file is never left empty.</li>
 * </ol>
 *
 * <p>All provider I/O is behind {@link DocumentIo}, so this algorithm is unit
 * tested without Android.
 */
final class SafeDocumentWriter {

    /** Provider I/O for a single document. The real impl wraps a ContentResolver + Uri. */
    interface DocumentIo {
        /**
         * The document's current raw bytes, for backup/rollback. Throws
         * {@link java.io.FileNotFoundException} when the document no longer
         * exists — callers rely on this surfacing BEFORE any truncation.
         */
        byte[] readBytes() throws IOException;

        /** Open a truncating, seekable write handle onto the document. */
        WriteHandle openWrite() throws IOException;
    }

    /** A single truncating write attempt onto the document. */
    interface WriteHandle {
        void write(byte[] bytes) throws IOException;

        /**
         * Force bytes to stable storage. Best-effort: a provider backed by a
         * non-seekable pipe cannot sync, and that must not fail an otherwise
         * good write.
         */
        void sync();

        /** Bytes currently written, or {@code -1} when the provider cannot report a size. */
        long length();

        /** Clean close — commits the write. */
        void commit() throws IOException;

        /** Abort — signals the provider to discard the partial write. */
        void abort(String reason);
    }

    private SafeDocumentWriter() {}

    /**
     * @param protectExisting {@code true} when overwriting an existing document
     *     (read a backup and roll back on failure); {@code false} when writing a
     *     freshly created document (nothing to protect yet).
     */
    static void write(DocumentIo io, byte[] bytes, boolean protectExisting) throws IOException {
        // Read the backup FIRST. If the document was moved or deleted out from
        // under us, this throws here — before a single byte is truncated.
        byte[] backup = protectExisting ? io.readBytes() : null;

        WriteHandle handle = io.openWrite();
        try {
            handle.write(bytes);
            handle.sync();

            long written = handle.length();
            if (written >= 0 && written != bytes.length) {
                throw new IOException(
                    "Document write verification failed: wrote " + written + " of " + bytes.length + " bytes");
            }

            handle.commit();
        } catch (IOException writeError) {
            // Signal the provider (cloud especially) to discard the partial
            // write instead of committing a truncation...
            handle.abort(writeError.getMessage());
            // ...then put the original bytes back so the file is never left empty.
            if (backup != null) {
                restore(io, backup, writeError);
            }
            // TODO(process-kill): `backup` lives only in memory, so a process
            // kill DURING the write — not a catchable exception — could still
            // leave the target truncated with no rollback source. Guarding that
            // near-impossible case (the write is a single sub-second push of at
            // most 5 MB while the app is foregrounded) would mean staging the
            // backup + new bytes to a fsync'd cache file BEFORE truncating and
            // adding a next-launch interrupted-save recovery pass. Deliberately
            // deferred; tracked in todolist.
            throw writeError;
        }
    }

    private static void restore(DocumentIo io, byte[] backup, IOException cause) {
        try {
            WriteHandle handle = io.openWrite();
            try {
                handle.write(backup);
                handle.sync();
                handle.commit();
            } catch (IOException restoreError) {
                handle.abort(restoreError.getMessage());
                throw restoreError;
            }
        } catch (IOException restoreError) {
            // Best-effort: the same failing storage may reject the restore too.
            // The file may be left truncated; the JS layer still holds the new
            // content as a recovery draft. Keep the original write error primary.
            cause.addSuppressed(restoreError);
        }
    }
}
