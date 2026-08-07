package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class PkceUtilTest {

    @Test
    public void base64UrlMatchesTheRfcTestVectors() {
        // RFC 4648 vectors, translated to the url-safe alphabet, unpadded.
        assertEquals("", PkceUtil.base64Url(new byte[0]));
        assertEquals("Zg", PkceUtil.base64Url("f".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("Zm8", PkceUtil.base64Url("fo".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("Zm9v", PkceUtil.base64Url("foo".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("Zm9vYg", PkceUtil.base64Url("foob".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("Zm9vYmE", PkceUtil.base64Url("fooba".getBytes(StandardCharsets.US_ASCII)));
        assertEquals("Zm9vYmFy", PkceUtil.base64Url("foobar".getBytes(StandardCharsets.US_ASCII)));
        // Bytes that force the url-safe characters.
        assertEquals("-_A", PkceUtil.base64Url(new byte[] {(byte) 0xFB, (byte) 0xF0}));
    }

    @Test
    public void challengeMatchesTheRfc7636Appendix() {
        // RFC 7636 appendix B reference verifier and its S256 challenge.
        assertEquals(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            PkceUtil.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        );
    }

    @Test
    public void verifiersAreUnpredictableAndWellFormed() {
        String first = PkceUtil.generateVerifier();
        String second = PkceUtil.generateVerifier();

        assertNotEquals(first, second);
        // 32 random bytes -> 43 unpadded base64url characters, RFC 7636 valid.
        assertEquals(43, first.length());
        assertTrue(first.matches("[A-Za-z0-9_-]+"));
    }
}
