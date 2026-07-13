package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ContentResolverDocumentIoTest {

    @Test
    public void reportsUnknownLengthForANonRegularDescriptor() {
        // A pipe/socket fstats to a negative size, but its byte-channel size is a
        // meaningless 0 (fstat on a pipe SUCCEEDS and reports 0 — it does not
        // throw). The length must therefore be reported as unknown (-1), not
        // mistaken for a zero-length short-write, which previously aborted every
        // non-empty streaming ("wt") save and its rollback.
        assertEquals(-1L, ContentResolverDocumentIo.resolveWriteLength(-1L, 0L));
        assertEquals(-1L, ContentResolverDocumentIo.resolveWriteLength(-1L, 500L));
    }

    @Test
    public void reportsTheRealSizeForARegularDescriptor() {
        // A regular on-disk file reports its true size so short-write detection
        // still works.
        assertEquals(42L, ContentResolverDocumentIo.resolveWriteLength(42L, 42L));
        assertEquals(3L, ContentResolverDocumentIo.resolveWriteLength(3L, 3L));
        // A genuinely empty regular file is length 0, not "unknown".
        assertEquals(0L, ContentResolverDocumentIo.resolveWriteLength(0L, 0L));
    }
}
