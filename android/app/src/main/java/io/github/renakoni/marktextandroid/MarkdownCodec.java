package io.github.renakoni.marktextandroid;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Markdown byte codec: encoding-name normalization, charset lookup, BOM
 * detection and emission, conservative non-BOM charset detection, strict
 * encode/decode, and the document byte-size validation. Pure JVM logic — no
 * Capacitor, URI, ContentResolver, or Activity concerns.
 */
final class MarkdownCodec {

    static final int MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

    // Statistical guesses below this confidence are ignored; the decode then
    // falls back to the user-selected default and its explicit failure.
    private static final int DETECTION_CONFIDENCE_THRESHOLD = 50;

    // When the user-selected default encoding itself strictly round-trips the
    // bytes, it is a viable reading and overriding it needs strong evidence.
    // The bar sits between two ICU landmarks: a lone UTF-8 multi-byte
    // sequence (a "©" that is equally plausible cp1252 "Â©") scores 80, while
    // real UTF-8/UTF-16/UTF-32 documents score 100. Below the bar the user's
    // explicit choice wins.
    private static final int VIABLE_DEFAULT_OVERRIDE_CONFIDENCE = 85;

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
        return decode(bytes, defaultEncoding, autoDetectEncoding, null);
    }

    /**
     * Decodes Markdown bytes. For bytes without a BOM and auto-detect on, the
     * sniffer's top candidate is accepted only when it maps into the
     * supported encoding set, clears the confidence bar, and survives a full
     * decode/re-encode byte round trip. The bar depends on the user's
     * default: {@link #DETECTION_CONFIDENCE_THRESHOLD} when the default
     * cannot round-trip the bytes, {@link #VIABLE_DEFAULT_OVERRIDE_CONFIDENCE}
     * when it can — byte reversibility alone never proves character
     * semantics, so a viable explicit default is only overridden on strong
     * statistical evidence. Anything less confident falls back to the
     * default; if the bytes contain NUL and the default is not a UTF-16/32
     * family encoding, that fallback fails explicitly instead of silently
     * embedding NULs (the signature of BOM-less UTF-16/32 read as an
     * ASCII-compatible charset).
     */
    static DecodedMarkdown decode(
        byte[] bytes,
        String defaultEncoding,
        boolean autoDetectEncoding,
        CharsetSniffer sniffer
    ) throws DocumentReadException {
        Bom bom = detectBom(bytes, defaultEncoding);
        if (!bom.hasBom && autoDetectEncoding) {
            String detected = detectEncodingWithoutBom(bytes, defaultEncoding, sniffer);
            if (detected != null) {
                return new DecodedMarkdown(strictDecode(bytes, 0, detected), detected, false);
            }
            if (containsNul(bytes) && !isNulTolerantEncoding(normalizeEncoding(defaultEncoding))) {
                throw new DocumentReadException(
                    "DOCUMENT_ENCODING_FAILED",
                    "Could not decode Markdown with the selected encoding"
                );
            }
        }
        boolean useBom = bom.hasBom && (
            autoDetectEncoding ||
            normalizeEncoding(defaultEncoding).equals(bom.encoding)
        );
        String encoding = useBom ? bom.encoding : normalizeEncoding(defaultEncoding);
        int offset = useBom ? bom.offset : 0;
        return new DecodedMarkdown(strictDecode(bytes, offset, encoding), encoding, useBom);
    }

    private static String strictDecode(
        byte[] bytes,
        int offset,
        String encoding
    ) throws DocumentReadException {
        Charset charset = getCharset(encoding);
        try {
            return charset
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset))
                .toString();
        } catch (CharacterCodingException | IndexOutOfBoundsException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_FAILED",
                "Could not decode Markdown with the selected encoding"
            );
        }
    }

    private static String detectEncodingWithoutBom(
        byte[] bytes,
        String defaultEncoding,
        CharsetSniffer sniffer
    ) {
        if (bytes.length == 0 || isAscii(bytes)) {
            // NUL-free ASCII bytes decode identically under every
            // ASCII-compatible encoding, so the user-selected default stays
            // authoritative. NUL is deliberately NOT ASCII here: it is the
            // signature of BOM-less UTF-16/32 and must reach the sniffer.
            return null;
        }
        if (sniffer == null) {
            return null;
        }
        List<CharsetSniffer.Guess> guesses;
        try {
            guesses = sniffer.sniff(bytes);
        } catch (RuntimeException ex) {
            return null;
        }
        if (guesses == null || guesses.isEmpty()) {
            return null;
        }
        // Only the top candidate is considered: accepting a weaker candidate
        // because a stronger one is unsupported would trade the fail-closed
        // contract for a statistically worse guess.
        CharsetSniffer.Guess top = guesses.get(0);
        int requiredConfidence = roundTrips(bytes, normalizeEncoding(defaultEncoding))
            ? VIABLE_DEFAULT_OVERRIDE_CONFIDENCE
            : DETECTION_CONFIDENCE_THRESHOLD;
        if (top.confidence < requiredConfidence) {
            return null;
        }
        String encoding = supportedEncodingForCharsetName(top.charsetName);
        if (encoding == null || !roundTrips(bytes, encoding)) {
            return null;
        }
        return encoding;
    }

    private static boolean isAscii(byte[] bytes) {
        for (byte value : bytes) {
            // Positive means 0x01-0x7F: negative is a high byte, zero is NUL.
            if (value <= 0) {
                return false;
            }
        }
        return true;
    }

    private static boolean containsNul(byte[] bytes) {
        for (byte value : bytes) {
            if (value == 0) {
                return true;
            }
        }
        return false;
    }

    private static boolean isNulTolerantEncoding(String encoding) {
        switch (encoding) {
            case "utf16be":
            case "utf16le":
            case "utf32be":
            case "utf32le":
                return true;
            default:
                return false;
        }
    }

    private static boolean roundTrips(byte[] bytes, String encoding) {
        try {
            String text = strictDecode(bytes, 0, encoding);
            return Arrays.equals(bytes, encode(text, new MarkdownWriteOptions(encoding, false)));
        } catch (DocumentReadException ex) {
            return false;
        }
    }

    private static String supportedEncodingForCharsetName(String charsetName) {
        String normalized = charsetName == null ? "" : charsetName.trim().toLowerCase(Locale.US);
        switch (normalized) {
            case "utf-8":
                return "utf8";
            case "utf-16be":
                return "utf16be";
            case "utf-16le":
                return "utf16le";
            case "utf-32be":
                return "utf32be";
            case "utf-32le":
                return "utf32le";
            case "gb18030":
                return "gb18030";
            case "big5":
                return "big5";
            case "shift_jis":
                return "shiftjis";
            case "euc-jp":
                return "eucjp";
            case "euc-kr":
                return "euckr";
            // ISO-8859-1 reports map onto cp1252, the Latin-1-family
            // superset the app already exposes; the two only disagree inside
            // the 0x80-0x9F control range, which real text does not use.
            case "iso-8859-1":
            case "windows-1252":
                return "cp1252";
            case "iso-8859-2":
                return "iso88592";
            case "windows-1250":
                return "windows1250";
            case "iso-8859-5":
                return "iso88595";
            case "windows-1251":
                return "cp1251";
            case "koi8-r":
                return "koi8r";
            case "ibm866":
                return "cp866";
            case "iso-8859-6":
                return "arabic";
            case "windows-1256":
                return "cp1256";
            case "iso-8859-7":
                return "greek";
            case "windows-1253":
                return "cp1253";
            case "iso-8859-8":
            case "iso-8859-8-i":
                return "hebrew";
            case "windows-1255":
                return "cp1255";
            case "iso-8859-9":
                return "latin5";
            case "windows-1254":
                return "cp1254";
            default:
                return null;
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
