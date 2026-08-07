package io.github.renakoni.marktextandroid;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * OAuth 2.0 PKCE material (RFC 7636), dependency-free. base64url is
 * hand-rolled because java.util.Base64 needs API 26 and android.util.Base64
 * would tie these pure helpers to the platform.
 */
final class PkceUtil {

    private static final char[] BASE64_URL_ALPHABET =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".toCharArray();

    private PkceUtil() {}

    static String generateVerifier() {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return base64Url(random);
    }

    static String challengeFor(String verifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return base64Url(digest.digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException ex) {
            // SHA-256 is mandatory on every Java platform.
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    static String base64Url(byte[] bytes) {
        StringBuilder encoded = new StringBuilder((bytes.length * 4 + 2) / 3);
        for (int index = 0; index < bytes.length; index += 3) {
            int chunk = (bytes[index] & 0xFF) << 16;
            int chunkBytes = 1;
            if (index + 1 < bytes.length) {
                chunk |= (bytes[index + 1] & 0xFF) << 8;
                chunkBytes = 2;
            }
            if (index + 2 < bytes.length) {
                chunk |= bytes[index + 2] & 0xFF;
                chunkBytes = 3;
            }

            encoded.append(BASE64_URL_ALPHABET[(chunk >>> 18) & 0x3F]);
            encoded.append(BASE64_URL_ALPHABET[(chunk >>> 12) & 0x3F]);
            if (chunkBytes > 1) {
                encoded.append(BASE64_URL_ALPHABET[(chunk >>> 6) & 0x3F]);
            }
            if (chunkBytes > 2) {
                encoded.append(BASE64_URL_ALPHABET[chunk & 0x3F]);
            }
        }
        return encoded.toString();
    }
}
