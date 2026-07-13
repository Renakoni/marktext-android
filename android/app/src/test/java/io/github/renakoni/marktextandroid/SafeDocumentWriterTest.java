package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.Test;

public class SafeDocumentWriterTest {

    /** A programmable single write attempt. */
    private static final class FakeHandle implements SafeDocumentWriter.WriteHandle {
        IOException writeError;
        Long lengthOverride; // null = report exactly what was written

        byte[] written;
        boolean synced;
        boolean committed;
        boolean aborted;

        @Override
        public void write(byte[] bytes) throws IOException {
            if (writeError != null) {
                throw writeError;
            }
            written = bytes;
        }

        @Override
        public void sync() {
            synced = true;
        }

        @Override
        public long length() {
            if (lengthOverride != null) {
                return lengthOverride;
            }
            return written == null ? 0 : written.length;
        }

        @Override
        public void commit() {
            committed = true;
        }

        @Override
        public void abort(String reason) {
            aborted = true;
        }
    }

    private static final class FakeIo implements SafeDocumentWriter.DocumentIo {
        byte[] existing;
        IOException readError;
        final Deque<FakeHandle> handles = new ArrayDeque<>();
        final List<FakeHandle> opened = new ArrayList<>();
        int readCount;

        @Override
        public byte[] readBytes() throws IOException {
            readCount++;
            if (readError != null) {
                throw readError;
            }
            return existing;
        }

        @Override
        public SafeDocumentWriter.WriteHandle openWrite() {
            FakeHandle handle = handles.poll();
            if (handle == null) {
                fail("openWrite() called more times than configured");
            }
            opened.add(handle);
            return handle;
        }
    }

    @Test
    public void writesAndCommitsOnTheHappyPath() throws IOException {
        FakeIo io = new FakeIo();
        io.existing = new byte[] { 1, 2, 3 };
        FakeHandle handle = new FakeHandle();
        io.handles.add(handle);

        byte[] bytes = new byte[] { 9, 8, 7, 6 };
        SafeDocumentWriter.write(io, bytes, true);

        assertEquals(1, io.readCount);
        assertEquals(1, io.opened.size());
        assertArrayEquals(bytes, handle.written);
        assertTrue(handle.synced);
        assertTrue(handle.committed);
        assertFalse(handle.aborted);
    }

    @Test
    public void skipsTheBackupReadWhenNotProtectingExisting() throws IOException {
        FakeIo io = new FakeIo();
        FakeHandle handle = new FakeHandle();
        io.handles.add(handle);

        SafeDocumentWriter.write(io, new byte[] { 1 }, false);

        assertEquals(0, io.readCount); // a fresh document has nothing to back up
        assertTrue(handle.committed);
    }

    @Test
    public void restoresTheBackupWhenTheWriteFails() {
        FakeIo io = new FakeIo();
        io.existing = new byte[] { 4, 5, 6 };
        FakeHandle failing = new FakeHandle();
        IOException boom = new IOException("disk full");
        failing.writeError = boom;
        FakeHandle restore = new FakeHandle();
        io.handles.add(failing);
        io.handles.add(restore);

        try {
            SafeDocumentWriter.write(io, new byte[] { 7, 7 }, true);
            fail("expected the write error to propagate");
        } catch (IOException error) {
            assertSame(boom, error);
        }

        assertTrue(failing.aborted); // provider told to discard the partial write
        assertEquals(2, io.opened.size()); // failing write + restore write
        assertArrayEquals(io.existing, restore.written); // original bytes rewritten
        assertTrue(restore.committed);
    }

    @Test
    public void restoresWhenTheLengthVerificationFails() {
        FakeIo io = new FakeIo();
        io.existing = new byte[] { 1 };
        FakeHandle shortWrite = new FakeHandle();
        shortWrite.lengthOverride = 2L; // provider silently wrote fewer than 4 bytes
        FakeHandle restore = new FakeHandle();
        io.handles.add(shortWrite);
        io.handles.add(restore);

        try {
            SafeDocumentWriter.write(io, new byte[] { 1, 2, 3, 4 }, true);
            fail("expected a verification failure");
        } catch (IOException error) {
            assertTrue(error.getMessage().contains("verification failed"));
        }

        assertTrue(shortWrite.aborted);
        assertArrayEquals(io.existing, restore.written);
        assertTrue(restore.committed);
    }

    @Test
    public void skipsVerificationWhenLengthIsUnavailable() throws IOException {
        FakeIo io = new FakeIo();
        io.existing = new byte[] { 1 };
        FakeHandle handle = new FakeHandle();
        handle.lengthOverride = -1L; // non-seekable pipe: length unknown
        io.handles.add(handle);

        SafeDocumentWriter.write(io, new byte[] { 1, 2, 3 }, true);

        assertTrue(handle.committed); // committed despite an unknown length
        assertFalse(handle.aborted);
    }

    @Test
    public void abortsWithoutRestoringWhenThereIsNoBackup() {
        FakeIo io = new FakeIo();
        FakeHandle failing = new FakeHandle();
        failing.writeError = new IOException("provider gone");
        io.handles.add(failing);

        try {
            SafeDocumentWriter.write(io, new byte[] { 1 }, false);
            fail("expected the write error to propagate");
        } catch (IOException error) {
            assertEquals("provider gone", error.getMessage());
        }

        assertTrue(failing.aborted);
        assertEquals(1, io.opened.size()); // no restore attempt for a fresh document
    }

    @Test
    public void surfacesDeletionBeforeTruncatingAnything() {
        FakeIo io = new FakeIo();
        io.readError = new FileNotFoundException("document deleted");

        try {
            SafeDocumentWriter.write(io, new byte[] { 1, 2 }, true);
            fail("expected the not-found error to propagate");
        } catch (IOException error) {
            assertTrue(error instanceof FileNotFoundException);
        }

        assertEquals(0, io.opened.size()); // nothing opened for writing → nothing truncated
    }

    @Test
    public void keepsTheOriginalErrorWhenTheRestoreAlsoFails() {
        FakeIo io = new FakeIo();
        io.existing = new byte[] { 9 };
        FakeHandle failing = new FakeHandle();
        IOException boom = new IOException("primary failure");
        failing.writeError = boom;
        FakeHandle restore = new FakeHandle();
        restore.writeError = new IOException("restore failure too");
        io.handles.add(failing);
        io.handles.add(restore);

        try {
            SafeDocumentWriter.write(io, new byte[] { 1 }, true);
            fail("expected the primary write error");
        } catch (IOException error) {
            assertSame(boom, error); // the original error stays primary
            assertEquals(1, error.getSuppressed().length); // restore failure attached
        }

        assertTrue(restore.aborted);
    }
}
