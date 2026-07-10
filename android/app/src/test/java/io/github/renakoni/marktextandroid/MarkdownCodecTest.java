package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.Arrays;
import org.junit.Test;

public class MarkdownCodecTest {

    @Test
    public void roundTripsUtf8WithCjkContent() throws Exception {
        String markdown = "# 你好 MarkText\n\n正文 body\n";

        byte[] bytes = MarkdownCodec.encode(markdown, new MarkdownWriteOptions("utf8", false));
        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "utf8", true);

        assertEquals(markdown, decoded.markdown);
        assertEquals("utf8", decoded.encoding);
        assertFalse(decoded.hasBom);
    }

    @Test
    public void writesAndDetectsUtf8Bom() throws Exception {
        byte[] bytes = MarkdownCodec.encode("# BOM", new MarkdownWriteOptions("utf8", true));

        assertArrayEquals(
            new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF },
            Arrays.copyOfRange(bytes, 0, 3)
        );

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "utf8", true);
        assertEquals("# BOM", decoded.markdown);
        assertTrue(decoded.hasBom);
    }

    @Test
    public void prefersUtf32BomOverItsUtf16Prefix() throws Exception {
        // The UTF-16LE BOM (FF FE) is a prefix of the UTF-32LE BOM
        // (FF FE 00 00); the longer sniff must win.
        byte[] bytes = MarkdownCodec.encode("A", new MarkdownWriteOptions("utf32le", true));

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "utf8", true);

        assertEquals("utf32le", decoded.encoding);
        assertEquals("A", decoded.markdown);
        assertTrue(decoded.hasBom);
    }

    @Test
    public void honorsBomMatchingTheDefaultWhenAutoDetectIsOff() throws Exception {
        byte[] bytes = MarkdownCodec.encode("plain", new MarkdownWriteOptions("utf16le", true));

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "utf16le", false);

        assertEquals("plain", decoded.markdown);
        assertEquals("utf16le", decoded.encoding);
        assertTrue(decoded.hasBom);
    }

    @Test
    public void rejectsDocumentsOverTheByteLimit() {
        char[] filler = new char[MarkdownCodec.MAX_MARKDOWN_BYTES + 1];
        Arrays.fill(filler, 'a');

        try {
            MarkdownCodec.validateBytes(new String(filler));
            fail("expected DOCUMENT_TOO_LARGE");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_TOO_LARGE", ex.code);
        }
    }

    @Test
    public void normalizesUnknownAndUntrimmedEncodingNames() {
        assertEquals("utf8", MarkdownCodec.normalizeEncoding("something-weird"));
        assertEquals("utf8", MarkdownCodec.normalizeEncoding(null));
        assertEquals("gbk", MarkdownCodec.normalizeEncoding("  GBK  "));
    }

    @Test
    public void reportsUnmappableCharactersInsteadOfCorrupting() {
        try {
            MarkdownCodec.encode("你好", new MarkdownWriteOptions("ascii", false));
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }

    @Test
    public void reportsMalformedBytesOnDecode() {
        byte[] malformed = new byte[] { (byte) 0xC3, (byte) 0x28 };

        try {
            MarkdownCodec.decode(malformed, "utf8", true);
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }
}
