package io.github.renakoni.marktextandroid;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Google Drive v3 client for cloud documents, pure JVM over the
 * {@link HttpTransport} seam and a structural mirror of
 * {@link OneDriveGraphClient}. Auth is OAuth 2.0 authorization-code + PKCE
 * in the system browser under the non-sensitive {@code drive.file} scope:
 * the app can only reach files the user picked (via the Google Picker) or
 * that it created, which is what keeps this client out of Google's
 * restricted-scope verification.
 *
 * Drive v3 has no {@code If-Match} on media uploads, so writes compare the
 * file's {@code headRevisionId} against the last-seen one immediately
 * before uploading. The compare-then-write pair is NOT atomic — a remote
 * change landing between the two requests still wins silently — but it
 * catches the realistic conflict (the document changed while it was open
 * here), matching the OneDrive ETag gate's intent.
 */
final class GoogleDriveClient {

    static final String AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    static final String TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
    static final String REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
    static final String DRIVE = "https://www.googleapis.com/drive/v3";
    static final String UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    static final String SCOPES = "https://www.googleapis.com/auth/drive.file";

    static final class TokenResult {

        final CloudTokenStore tokens;

        TokenResult(CloudTokenStore tokens) {
            this.tokens = tokens;
        }
    }

    static final class FileContent {

        final String name;
        final String headRevisionId;
        final boolean canWrite;
        final byte[] bytes;

        FileContent(String name, String headRevisionId, boolean canWrite, byte[] bytes) {
            this.name = name;
            this.headRevisionId = headRevisionId;
            this.canWrite = canWrite;
            this.bytes = bytes;
        }
    }

    static final class WriteResult {

        final String name;
        final String headRevisionId;
        final String lastModified;

        WriteResult(String name, String headRevisionId, String lastModified) {
            this.name = name;
            this.headRevisionId = headRevisionId;
            this.lastModified = lastModified;
        }
    }

    private final HttpTransport transport;

    GoogleDriveClient(HttpTransport transport) {
        this.transport = transport;
    }

    /**
     * Markdown candidates as Drive stores them: .md uploads get
     * text/markdown (older ones text/plain or application/octet-stream).
     */
    static final String PICKER_MIME_TYPES =
        "text/markdown,text/x-markdown,text/plain,application/octet-stream";

    /**
     * The authorization URL doubles as the file picker: with
     * {@code trigger_onepick} the Google Picker runs INSIDE the OAuth flow
     * in the user's real browser (where their Google session lives — an
     * embedded WebView has none and Google blocks signing in there), and
     * the redirect carries {@code picked_file_ids} next to the code. This
     * is Google's documented Picker integration for desktop/mobile apps;
     * every pick is one browser round trip.
     */
    static String buildPickerAuthorizeUrl(String clientId, String redirectUri, String state, String codeChallenge) {
        return AUTH_ENDPOINT
            + "?client_id=" + urlEncode(clientId)
            + "&response_type=code"
            + "&redirect_uri=" + urlEncode(redirectUri)
            + "&scope=" + urlEncode(SCOPES)
            + "&state=" + urlEncode(state)
            + "&code_challenge=" + urlEncode(codeChallenge)
            + "&code_challenge_method=S256"
            + "&access_type=offline"
            // Both are required for the in-flow picker.
            + "&prompt=consent"
            + "&trigger_onepick=true"
            + "&mimetypes=" + urlEncode(PICKER_MIME_TYPES);
    }

    TokenResult exchangeCode(String clientId, String redirectUri, String code, String codeVerifier, long nowMillis)
        throws IOException, CloudProviderException {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("client_id", clientId);
        form.put("grant_type", "authorization_code");
        form.put("code", code);
        form.put("redirect_uri", redirectUri);
        form.put("code_verifier", codeVerifier);
        return requestTokens(form, nowMillis, null);
    }

    TokenResult refresh(String clientId, CloudTokenStore tokens, long nowMillis)
        throws IOException, CloudProviderException {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("client_id", clientId);
        form.put("grant_type", "refresh_token");
        form.put("refresh_token", tokens.refreshToken);
        return requestTokens(form, nowMillis, tokens);
    }

    private TokenResult requestTokens(Map<String, String> form, long nowMillis, CloudTokenStore previous)
        throws IOException, CloudProviderException {
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "POST",
            TOKEN_ENDPOINT,
            formHeaders(),
            HttpTransport.encodeForm(form).getBytes(StandardCharsets.UTF_8)
        ));

        JSONObject json = parseJson(response.body);
        if (response.status != 200) {
            String error = json == null ? "" : json.optString("error", "");
            if ("invalid_grant".equals(error)) {
                throw new CloudProviderException(
                    "CLOUD_AUTH_EXPIRED",
                    "The Google Drive sign-in has expired; connect the account again"
                );
            }
            throw new CloudProviderException(
                "CLOUD_AUTH_FAILED",
                "Google Drive sign-in failed"
                    + (json != null && json.optString("error_description", "").length() > 0
                        ? ": " + firstLine(json.optString("error_description", ""))
                        : "")
            );
        }
        if (json == null) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "Google Drive sign-in returned an unreadable response");
        }

        String accessToken = json.optString("access_token", "");
        if (accessToken.length() == 0) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "Google Drive sign-in returned no access token");
        }
        // Refresh responses omit the refresh token; keep the previous one.
        String refreshToken = json.optString("refresh_token", "");
        if (refreshToken.length() == 0 && previous != null) {
            refreshToken = previous.refreshToken;
        }
        if (refreshToken.length() == 0) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "Google Drive sign-in returned no refresh token");
        }
        long expiresAt = nowMillis + json.optLong("expires_in", 0) * 1000;
        String accountName = previous == null ? null : previous.accountName;
        return new TokenResult(new CloudTokenStore(accessToken, refreshToken, expiresAt, accountName));
    }

    /** Best-effort token revocation on disconnect; returns whether Google confirmed it. */
    boolean revoke(String token) throws IOException {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("token", token);
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "POST",
            REVOKE_ENDPOINT,
            formHeaders(),
            HttpTransport.encodeForm(form).getBytes(StandardCharsets.UTF_8)
        ));
        return response.status >= 200 && response.status < 300;
    }

    /** The reversed-client-id redirect scheme Google mandates for native apps. */
    static String redirectSchemeFor(String clientId) {
        String suffix = ".apps.googleusercontent.com";
        if (clientId == null || !clientId.endsWith(suffix)) {
            return "";
        }
        return "com.googleusercontent.apps."
            + clientId.substring(0, clientId.length() - suffix.length());
    }

    /** The account label from the Drive about resource — no extra scopes needed. */
    String getAccountName(String accessToken) throws IOException, CloudProviderException {
        JSONObject json = driveJson(accessToken, DRIVE + "/about?fields=user");
        JSONObject user = json.optJSONObject("user");
        if (user == null) {
            return "";
        }
        String email = user.optString("emailAddress", "");
        return email.length() > 0 ? email : user.optString("displayName", "");
    }

    FileContent readFile(String accessToken, String fileId, int maxBytes)
        throws IOException, CloudProviderException {
        JSONObject metadata = driveJson(
            accessToken,
            DRIVE + "/files/" + urlEncode(fileId)
                + "?fields=name,mimeType,headRevisionId,size,trashed,capabilities/canModifyContent"
        );
        if (metadata.optBoolean("trashed", false)) {
            throw new CloudProviderException(
                "CLOUD_DOCUMENT_NOT_FOUND",
                "This Google Drive document was moved to the trash"
            );
        }
        // The picker MIME filter admits application/octet-stream (how Drive
        // stored older .md uploads), which also matches arbitrary binaries.
        // A decodable-but-binary payload would survive charset validation,
        // get edited as garbage, and then overwrite the original — so
        // non-text MIME types must carry a Markdown/text extension.
        String name = metadata.optString("name", "");
        String mimeType = metadata.optString("mimeType", "");
        boolean isTextMime = mimeType.toLowerCase(Locale.US).startsWith("text/");
        if (!isTextMime && !OneDriveGraphClient.isListableDocumentName(name)) {
            throw new CloudProviderException(
                "UNSUPPORTED_DOCUMENT",
                "This Google Drive file is not a Markdown or plain text document"
            );
        }
        // Drive v3 serializes size as a string; optLong parses it.
        long size = metadata.optLong("size", 0);
        if (size > maxBytes) {
            throw new CloudProviderException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }

        HttpTransport.Response download = transport.execute(new HttpTransport.Request(
            "GET",
            DRIVE + "/files/" + urlEncode(fileId) + "?alt=media",
            bearerHeaders(accessToken),
            null,
            maxBytes
        ));
        if (download.status != 200) {
            throw statusException(download, "CLOUD_READ_FAILED", "Google Drive download failed");
        }
        byte[] bytes = download.body == null ? new byte[0] : download.body;
        if (bytes.length > maxBytes) {
            throw new CloudProviderException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }
        // The picker offers read-only shared files too; canWrite must be
        // the file's real capability or autosave runs into 403s.
        // canModifyContent is the capability that governs media uploads
        // (canEdit can be true while content is restricted), and a missing
        // answer fails closed to a read-only open.
        JSONObject capabilities = metadata.optJSONObject("capabilities");
        boolean canWrite = capabilities != null && capabilities.optBoolean("canModifyContent", false);
        return new FileContent(
            name,
            metadata.optString("headRevisionId", ""),
            canWrite,
            bytes
        );
    }

    WriteResult writeFile(String accessToken, String fileId, byte[] bytes, String expectedRevision)
        throws IOException, CloudProviderException {
        JSONObject metadata = driveJson(
            accessToken,
            DRIVE + "/files/" + urlEncode(fileId) + "?fields=name,mimeType,headRevisionId,trashed"
        );
        if (metadata.optBoolean("trashed", false)) {
            throw new CloudProviderException(
                "CLOUD_DOCUMENT_NOT_FOUND",
                "This Google Drive document was moved to the trash"
            );
        }
        String headRevision = metadata.optString("headRevisionId", "");
        if (expectedRevision != null
            && expectedRevision.length() > 0
            && headRevision.length() > 0
            && !expectedRevision.equals(headRevision)) {
            throw new CloudProviderException(
                "CLOUD_DOCUMENT_CONFLICT",
                "This document changed on Google Drive since it was opened"
            );
        }

        // Echo the file's own MIME type: uploadType=media derives the type
        // from Content-Type, and a mismatched header would rewrite it.
        String mimeType = metadata.optString("mimeType", "");
        Map<String, String> headers = bearerHeaders(accessToken);
        headers.put("Content-Type", mimeType.length() > 0 ? mimeType : "text/markdown");
        // files.update is PATCH, which HttpURLConnection cannot send;
        // Google APIs accept the documented POST + method-override form.
        headers.put("X-HTTP-Method-Override", "PATCH");

        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "POST",
            UPLOAD + "/files/" + urlEncode(fileId)
                + "?uploadType=media&fields=name,headRevisionId,modifiedTime",
            headers,
            bytes
        ));
        if (response.status != 200) {
            throw statusException(response, "CLOUD_WRITE_FAILED", "Google Drive save failed");
        }

        JSONObject json = parseJson(response.body);
        if (json == null) {
            throw new CloudProviderException("CLOUD_WRITE_FAILED", "Google Drive save returned an unreadable response");
        }
        return new WriteResult(
            json.optString("name", ""),
            json.optString("headRevisionId", ""),
            json.optString("modifiedTime", "")
        );
    }

    private JSONObject driveJson(String accessToken, String url) throws IOException, CloudProviderException {
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "GET",
            url,
            bearerHeaders(accessToken),
            null
        ));
        if (response.status != 200) {
            throw statusException(response, "CLOUD_REQUEST_FAILED", "Google Drive request failed");
        }
        JSONObject json = parseJson(response.body);
        if (json == null) {
            throw new CloudProviderException("CLOUD_REQUEST_FAILED", "Google Drive returned an unreadable response");
        }
        return json;
    }

    private static CloudProviderException statusException(
        HttpTransport.Response response,
        String fallbackCode,
        String fallbackMessage
    ) {
        if (response.status == 401) {
            return authExpired();
        }
        if (response.status == 403) {
            // Drive multiplexes 403: rate limiting (retryable), per-file
            // permission problems (this document, not the account), and
            // real authorization loss. Only the last may declare the
            // account disconnected.
            String body = response.body == null
                ? ""
                : new String(response.body, StandardCharsets.UTF_8).toLowerCase(Locale.US);
            if (body.contains("ratelimit") || body.contains("quota")) {
                return unavailable();
            }
            if (body.contains("insufficient") || body.contains("cannotmodify")
                || body.contains("filenotdownloadable")) {
                return new CloudProviderException(fallbackCode, fallbackMessage + " (no permission)");
            }
            return authExpired();
        }
        if (response.status == 404) {
            return new CloudProviderException(
                "CLOUD_DOCUMENT_NOT_FOUND",
                "This Google Drive document was moved or deleted"
            );
        }
        if (response.status == 429 || response.status >= 500) {
            return unavailable();
        }
        return new CloudProviderException(fallbackCode, fallbackMessage + " (HTTP " + response.status + ")");
    }

    private static CloudProviderException authExpired() {
        return new CloudProviderException(
            "CLOUD_AUTH_EXPIRED",
            "Google Drive access is no longer authorized; connect the account again"
        );
    }

    private static CloudProviderException unavailable() {
        return new CloudProviderException(
            "CLOUD_UNAVAILABLE",
            "Google Drive is temporarily unavailable; try again shortly"
        );
    }

    private static Map<String, String> bearerHeaders(String accessToken) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", "Bearer " + accessToken);
        headers.put("Accept", "application/json");
        return headers;
    }

    private static Map<String, String> formHeaders() {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Content-Type", "application/x-www-form-urlencoded");
        headers.put("Accept", "application/json");
        return headers;
    }

    private static JSONObject parseJson(byte[] body) {
        if (body == null || body.length == 0) {
            return null;
        }
        try {
            return new JSONObject(new String(body, StandardCharsets.UTF_8));
        } catch (JSONException ex) {
            return null;
        }
    }

    private static String firstLine(String value) {
        int lineEnd = value.indexOf('\n');
        return (lineEnd >= 0 ? value.substring(0, lineEnd) : value).trim();
    }

    private static String urlEncode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException ex) {
            throw new IllegalStateException("UTF-8 unavailable", ex);
        }
    }
}
