package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.Charset;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

/**
 * Non-BOM charset detection coverage. The statistical engine under test is
 * the vendored ICU CharsetDetector — the same engine the app runs on device —
 * so the confusable-sample verdicts here exercise the real recognizers, not a
 * mock. FixedSniffer cases pin the acceptance policy itself: threshold,
 * supported-set mapping, top-candidate-only, and the round-trip gate.
 */
public class MarkdownCodecDetectionTest {

    private static final String SIMPLIFIED_CHINESE =
        "# 项目说明\n\n这是一个用于测试字符编码检测的中文文档。软件在打开没有字节顺序标记的文件时,"
            + "需要根据内容判断使用哪一种编码。为了保证判断的可靠性,检测结果必须能够完整地还原原始字节,"
            + "否则就退回默认设置。\n";

    private static final String TRADITIONAL_CHINESE =
        "# 專案說明\n\n這是一個用於測試字元編碼偵測的中文文件。軟體在開啟沒有位元組順序標記的檔案時,"
            + "需要根據內容判斷使用哪一種編碼。為了確保判斷可靠,偵測結果必須能夠完整還原原始位元組,"
            + "否則就退回預設設定。\n";

    private static final String JAPANESE =
        "# 設定の説明\n\nこれは文字コード判定を試すための日本語の文書です。バイト順マークのないファイルを"
            + "開くとき、内容から符号化方式を推定します。推定結果は元のバイト列を完全に復元できる場合だけ"
            + "採用され、そうでなければ既定の設定に戻ります。\n";

    private static final String KOREAN =
        "# 설정 설명\n\n한국어 문서입니다. 인코딩 감지 기능을 시험하기 위한 자연스러운 문장입니다."
            + " 바이트 순서 표시가 없는 파일이라도 내용을 통해 판별할 수 있어야 합니다.\n";

    private static final String FRENCH =
        "# Réglages de l'éditeur\n\nCe document sert à vérifier la détection du codage des"
            + " caractères. Lorsqu'un fichier est ouvert sans marque d'ordre des octets,"
            + " l'application doit déterminer le codage à partir du contenu, sinon elle"
            + " revient au réglage par défaut choisi par l'utilisateur. Écrire « déjà vu »,"
            + " « cœur » ou « très tôt » ne doit pas être corrompu.\n";

    private static final byte[] GARBAGE = new byte[] { (byte) 0xC3, 0x28, (byte) 0x81, 0x40 };

    private final IcuCharsetSniffer icu = new IcuCharsetSniffer();

    private static final class FixedSniffer implements CharsetSniffer {

        private final List<Guess> guesses;

        FixedSniffer(Guess... guesses) {
            this.guesses = Arrays.asList(guesses);
        }

        @Override
        public List<Guess> sniff(byte[] bytes) {
            return guesses;
        }
    }

    private static byte[] toBytes(String text, String charsetName) {
        return text.getBytes(Charset.forName(charsetName));
    }

    private void assertDetects(
        String text,
        String fileCharset,
        String expectedEncoding
    ) throws Exception {
        byte[] bytes = toBytes(text, fileCharset);

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "utf8", true, icu);

        assertEquals(expectedEncoding, decoded.encoding);
        assertEquals(text, decoded.markdown);
        assertFalse(decoded.hasBom);
        // Saving with the detected encoding must reproduce the original file
        // bytes — detection may never rewrite a document it merely opened.
        assertArrayEquals(
            bytes,
            MarkdownCodec.encode(decoded.markdown, new MarkdownWriteOptions(decoded.encoding, false))
        );
    }

    @Test
    public void detectsGbkChineseAgainstUtf8Default() throws Exception {
        // ICU reports the GB18030 superset; the bytes and text are identical
        // for GBK-range content, so the original file is preserved.
        assertDetects(SIMPLIFIED_CHINESE, "GBK", "gb18030");
    }

    @Test
    public void detectsBig5ChineseAgainstUtf8Default() throws Exception {
        assertDetects(TRADITIONAL_CHINESE, "Big5", "big5");
    }

    @Test
    public void detectsShiftJisJapaneseAgainstUtf8Default() throws Exception {
        assertDetects(JAPANESE, "Shift_JIS", "shiftjis");
    }

    @Test
    public void detectsEucKrKoreanAgainstUtf8Default() throws Exception {
        assertDetects(KOREAN, "EUC-KR", "euckr");
    }

    @Test
    public void detectsWindows1252FrenchAgainstUtf8Default() throws Exception {
        assertDetects(FRENCH, "windows-1252", "cp1252");
    }

    @Test
    public void utf8SelfValidationNeedsNoSniffer() throws Exception {
        byte[] bytes = toBytes(SIMPLIFIED_CHINESE, "UTF-8");

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "cp1252", true);

        assertEquals("utf8", decoded.encoding);
        assertEquals(SIMPLIFIED_CHINESE, decoded.markdown);
    }

    @Test
    public void pureAsciiKeepsTheUserSelectedDefault() throws Exception {
        byte[] bytes = toBytes("# Plain ASCII\n\nNothing to detect here.\n", "US-ASCII");

        DecodedMarkdown decoded = MarkdownCodec.decode(bytes, "cp1252", true, icu);

        assertEquals("cp1252", decoded.encoding);
        assertEquals("# Plain ASCII\n\nNothing to detect here.\n", decoded.markdown);
    }

    @Test
    public void lowConfidenceGarbageKeepsTheExplicitFailure() {
        try {
            MarkdownCodec.decode(GARBAGE, "utf8", true, icu);
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }

    @Test
    public void autoDetectOffNeverSniffs() {
        byte[] bytes = toBytes(SIMPLIFIED_CHINESE, "GBK");

        try {
            MarkdownCodec.decode(bytes, "utf8", false, icu);
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }

    @Test
    public void bomStillWinsOverTheSniffer() throws Exception {
        byte[] bytes = MarkdownCodec.encode("# BOM 标题", new MarkdownWriteOptions("utf8", true));

        DecodedMarkdown decoded =
            MarkdownCodec.decode(bytes, "utf8", true, new FixedSniffer(new CharsetSniffer.Guess("Big5", 100)));

        assertEquals("utf8", decoded.encoding);
        assertEquals("# BOM 标题", decoded.markdown);
        assertTrue(decoded.hasBom);
    }

    @Test
    public void roundTripGateRejectsALyingSniffer() {
        // 0x81 0x20 is structurally invalid Shift_JIS (bad trail byte), so a
        // sniffer lying with full confidence must still be rejected and the
        // decode must fall back to the default encoding's explicit failure.
        byte[] bytes = new byte[] { (byte) 0x81, 0x20, (byte) 0x81 };

        try {
            MarkdownCodec.decode(
                bytes, "utf8", true, new FixedSniffer(new CharsetSniffer.Guess("Shift_JIS", 100)));
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }

    @Test
    public void unsupportedTopCandidateIsNotSkippedOver() {
        byte[] bytes = toBytes(SIMPLIFIED_CHINESE, "GBK");

        try {
            MarkdownCodec.decode(
                bytes,
                "utf8",
                true,
                new FixedSniffer(
                    new CharsetSniffer.Guess("ISO-2022-JP", 100),
                    new CharsetSniffer.Guess("GB18030", 90)));
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }
    }

    @Test
    public void confidenceThresholdIsExactlyFifty() throws Exception {
        byte[] bytes = toBytes(SIMPLIFIED_CHINESE, "GBK");

        try {
            MarkdownCodec.decode(
                bytes, "utf8", true, new FixedSniffer(new CharsetSniffer.Guess("GB18030", 49)));
            fail("expected DOCUMENT_ENCODING_FAILED");
        } catch (DocumentReadException ex) {
            assertEquals("DOCUMENT_ENCODING_FAILED", ex.code);
        }

        DecodedMarkdown decoded = MarkdownCodec.decode(
            bytes, "utf8", true, new FixedSniffer(new CharsetSniffer.Guess("GB18030", 50)));
        assertEquals("gb18030", decoded.encoding);
        assertEquals(SIMPLIFIED_CHINESE, decoded.markdown);
    }
}
