package io.github.renakoni.marktextandroid;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Markdown byte codec: encoding-name normalization, charset lookup, BOM
 * detection and emission, strict encode/decode, and the document byte-size
 * validation. Pure JVM logic — no Capacitor, URI, ContentResolver, or
 * Activity concerns.
 */
final class MarkdownCodec {

    static final int MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

    private static final byte[] UTF8_BOM = new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
    private static final byte[] UTF16BE_BOM = new byte[] { (byte) 0xFE, (byte) 0xFF };
    private static final byte[] UTF16LE_BOM = new byte[] { (byte) 0xFF, (byte) 0xFE };
    private static final byte[] UTF32BE_BOM = new byte[] { 0x00, 0x00, (byte) 0xFE, (byte) 0xFF };
    private static final byte[] UTF32LE_BOM = new byte[] { (byte) 0xFF, (byte) 0xFE, 0x00, 0x00 };

    private MarkdownCodec() {}

    static byte[] validateBytes(String markdown) throws DocumentReadException {
        return validateBytes(markdown, new MarkdownWriteOptions("utf8", false));
    }

    static byte[] validateBytes(String markdown, MarkdownWriteOptions writeOptions) throws DocumentReadException {
        byte[] bytes = encode(markdown, writeOptions);
        if (bytes.length > MAX_MARKDOWN_BYTES) {
            throw new DocumentReadException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }
        return bytes;
    }

    static byte[] encode(String markdown, MarkdownWriteOptions writeOptions) throws DocumentReadException {
        Charset charset = getCharset(writeOptions.encoding);
        byte[] body;
        try {
            ByteBuffer buffer = charset
                .newEncoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .encode(CharBuffer.wrap(markdown));
            body = new byte[buffer.remaining()];
            buffer.get(body);
        } catch (CharacterCodingException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_FAILED",
                "Could not encode Markdown with the selected encoding"
            );
        }

        byte[] bom = encodingBom(writeOptions);
        if (bom.length == 0) {
            return body;
        }

        byte[] bytes = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, bytes, 0, bom.length);
        System.arraycopy(body, 0, bytes, bom.length, body.length);
        return bytes;
    }

    static DecodedMarkdown decode(
        byte[] bytes,
        String defaultEncoding,
        boolean autoDetectEncoding
    ) throws DocumentReadException {
        Bom bom = detectBom(bytes, defaultEncoding);
        boolean useBom = bom.hasBom && (
            autoDetectEncoding ||
            normalizeEncoding(defaultEncoding).equals(bom.encoding)
        );
        String encoding = useBom ? bom.encoding : normalizeEncoding(defaultEncoding);
        int offset = useBom ? bom.offset : 0;
        Charset charset = getCharset(encoding);

        try {
            String markdown = charset
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset))
                .toString();
            // TODO: Add full non-BOM charset detection for Advanced > Encoding.
            return new DecodedMarkdown(markdown, encoding, useBom);
        } catch (CharacterCodingException | IndexOutOfBoundsException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_FAILED",
                "Could not decode Markdown with the selected encoding"
            );
        }
    }

    static String normalizeEncoding(String encoding) {
        String normalized = encoding == null ? "" : encoding.trim().toLowerCase(Locale.US);
        switch (normalized) {
            case "ascii":
            case "utf8":
            case "utf16be":
            case "utf16le":
            case "utf32be":
            case "utf32le":
            case "latin3":
            case "iso885915":
            case "cp1252":
            case "arabic":
            case "cp1256":
            case "latin4":
            case "cp1257":
            case "iso88592":
            case "windows1250":
            case "cp866":
            case "iso88595":
            case "koi8r":
            case "koi8u":
            case "cp1251":
            case "iso885913":
            case "greek":
            case "cp1253":
            case "hebrew":
            case "cp1255":
            case "latin5":
            case "cp1254":
            case "gb2312":
            case "gb18030":
            case "gbk":
            case "big5":
            case "big5hkscs":
            case "shiftjis":
            case "eucjp":
            case "euckr":
            case "latin6":
                return normalized;
            default:
                return "utf8";
        }
    }

    static Charset getCharset(String encoding) throws DocumentReadException {
        try {
            return Charset.forName(charsetName(encoding));
        } catch (IllegalArgumentException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_UNSUPPORTED",
                "Selected Markdown encoding is not supported on this device"
            );
        }
    }

    private static String charsetName(String encoding) {
        switch (normalizeEncoding(encoding)) {
            case "ascii":
                return StandardCharsets.US_ASCII.name();
            case "utf8":
                return StandardCharsets.UTF_8.name();
            case "utf16be":
                return StandardCharsets.UTF_16BE.name();
            case "utf16le":
                return StandardCharsets.UTF_16LE.name();
            case "utf32be":
                return "UTF-32BE";
            case "utf32le":
                return "UTF-32LE";
            case "latin3":
                return "ISO-8859-3";
            case "iso885915":
                return "ISO-8859-15";
            case "cp1252":
                return "windows-1252";
            case "arabic":
                return "ISO-8859-6";
            case "cp1256":
                return "windows-1256";
            case "latin4":
                return "ISO-8859-4";
            case "cp1257":
                return "windows-1257";
            case "iso88592":
                return "ISO-8859-2";
            case "windows1250":
                return "windows-1250";
            case "cp866":
                return "IBM866";
            case "iso88595":
                return "ISO-8859-5";
            case "koi8r":
                return "KOI8-R";
            case "koi8u":
                return "KOI8-U";
            case "cp1251":
                return "windows-1251";
            case "iso885913":
                return "ISO-8859-13";
            case "greek":
                return "ISO-8859-7";
            case "cp1253":
                return "windows-1253";
            case "hebrew":
                return "ISO-8859-8";
            case "cp1255":
                return "windows-1255";
            case "latin5":
                return "ISO-8859-9";
            case "cp1254":
                return "windows-1254";
            case "gb2312":
                return "GB2312";
            case "gb18030":
                return "GB18030";
            case "gbk":
                return "GBK";
            case "big5":
                return "Big5";
            case "big5hkscs":
                return "Big5-HKSCS";
            case "shiftjis":
                return "Shift_JIS";
            case "eucjp":
                return "EUC-JP";
            case "euckr":
                return "EUC-KR";
            case "latin6":
                return "ISO-8859-10";
            default:
                return StandardCharsets.UTF_8.name();
        }
    }

    private static byte[] encodingBom(MarkdownWriteOptions writeOptions) {
        if (!writeOptions.writeBom) {
            return new byte[0];
        }

        switch (writeOptions.encoding) {
            case "utf8":
                return UTF8_BOM;
            case "utf16be":
                return UTF16BE_BOM;
            case "utf16le":
                return UTF16LE_BOM;
            case "utf32be":
                return UTF32BE_BOM;
            case "utf32le":
                return UTF32LE_BOM;
            default:
                return new byte[0];
        }
    }

    // UTF-32 BOMs are checked before UTF-16: the UTF-16LE BOM is a prefix of
    // the UTF-32LE BOM, so the longer sniff has to win.
    private static Bom detectBom(byte[] bytes, String defaultEncoding) {
        if (startsWith(bytes, UTF8_BOM)) {
            return new Bom("utf8", UTF8_BOM.length, true);
        }
        if (startsWith(bytes, UTF32BE_BOM)) {
            return new Bom("utf32be", UTF32BE_BOM.length, true);
        }
        if (startsWith(bytes, UTF32LE_BOM)) {
            return new Bom("utf32le", UTF32LE_BOM.length, true);
        }
        if (startsWith(bytes, UTF16BE_BOM)) {
            return new Bom("utf16be", UTF16BE_BOM.length, true);
        }
        if (startsWith(bytes, UTF16LE_BOM)) {
            return new Bom("utf16le", UTF16LE_BOM.length, true);
        }
        return new Bom(defaultEncoding, 0, false);
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (bytes[index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private static class Bom {

        final String encoding;
        final int offset;
        final boolean hasBom;

        Bom(String encoding, int offset, boolean hasBom) {
            this.encoding = encoding;
            this.offset = offset;
            this.hasBom = hasBom;
        }
    }
}
