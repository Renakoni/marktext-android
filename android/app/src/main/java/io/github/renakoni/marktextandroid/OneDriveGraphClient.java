package io.github.renakoni.marktextandroid;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Microsoft Graph client for OneDrive documents, pure JVM over the
 * {@link HttpTransport} seam. Auth is OAuth 2.0 authorization-code + PKCE
 * against the /common endpoint (personal and organizational accounts), run
 * in the system browser per Microsoft/Google embedded-WebView policy.
 */
final class OneDriveGraphClient {

    static final String AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
    static final String GRAPH = "https://graph.microsoft.com/v1.0";
    static final String SCOPES = "openid offline_access User.Read Files.ReadWrite";
    /** Follow at most this many @odata.nextLink pages per folder listing. */
    static final int MAX_LIST_PAGES = 20;

    static final class TokenResult {

        final CloudTokenStore tokens;

        TokenResult(CloudTokenStore tokens) {
            this.tokens = tokens;
        }
    }

    static final class Account {

        final String displayName;
        final String userPrincipalName;

        Account(String displayName, String userPrincipalName) {
            this.displayName = displayName;
            this.userPrincipalName = userPrincipalName;
        }
    }

    static final class Entry {

        final String id;
        final String name;
        final boolean isFolder;
        final long size;
        final String lastModified;

        Entry(String id, String name, boolean isFolder, long size, String lastModified) {
            this.id = id;
            this.name = name;
            this.isFolder = isFolder;
            this.size = size;
            this.lastModified = lastModified;
        }
    }

    static final class FileContent {

        final String name;
        final String eTag;
        final byte[] bytes;

        FileContent(String name, String eTag, byte[] bytes) {
            this.name = name;
            this.eTag = eTag;
            this.bytes = bytes;
        }
    }

    static final class WriteResult {

        final String name;
        final String eTag;
        final String lastModified;

        WriteResult(String name, String eTag, String lastModified) {
            this.name = name;
            this.eTag = eTag;
            this.lastModified = lastModified;
        }
    }

    static final class CreateResult {

        final String id;
        final String name;
        final String eTag;
        final String lastModified;

        CreateResult(String id, String name, String eTag, String lastModified) {
            this.id = id;
            this.name = name;
            this.eTag = eTag;
            this.lastModified = lastModified;
        }
    }

    /** Simple (non-session) uploads cap at 4 MB on Microsoft Graph. */
    static final int MAX_SIMPLE_UPLOAD_BYTES = 4 * 1024 * 1024;

    private final HttpTransport transport;

    OneDriveGraphClient(HttpTransport transport) {
        this.transport = transport;
    }

    static String buildAuthorizeUrl(String clientId, String redirectUri, String state, String codeChallenge) {
        return AUTHORITY + "/authorize"
            + "?client_id=" + urlEncode(clientId)
            + "&response_type=code"
            + "&redirect_uri=" + urlEncode(redirectUri)
            + "&response_mode=query"
            + "&scope=" + urlEncode(SCOPES)
            + "&state=" + urlEncode(state)
            + "&code_challenge=" + urlEncode(codeChallenge)
            + "&code_challenge_method=S256";
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
        form.put("scope", SCOPES);
        return requestTokens(form, nowMillis, tokens);
    }

    private TokenResult requestTokens(Map<String, String> form, long nowMillis, CloudTokenStore previous)
        throws IOException, CloudProviderException {
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "POST",
            AUTHORITY + "/token",
            formHeaders(),
            HttpTransport.encodeForm(form).getBytes(StandardCharsets.UTF_8)
        ));

        JSONObject json = parseJson(response.body);
        if (response.status != 200) {
            String error = json == null ? "" : json.optString("error", "");
            if ("invalid_grant".equals(error) || "interaction_required".equals(error)) {
                throw new CloudProviderException(
                    "CLOUD_AUTH_EXPIRED",
                    "The OneDrive sign-in has expired; connect the account again"
                );
            }
            throw new CloudProviderException(
                "CLOUD_AUTH_FAILED",
                "OneDrive sign-in failed"
                    + (json != null && json.optString("error_description", "").length() > 0
                        ? ": " + firstLine(json.optString("error_description", ""))
                        : "")
            );
        }
        if (json == null) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "OneDrive sign-in returned an unreadable response");
        }

        String accessToken = json.optString("access_token", "");
        if (accessToken.length() == 0) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "OneDrive sign-in returned no access token");
        }
        // Refresh responses may omit the refresh token; keep the previous one.
        String refreshToken = json.optString("refresh_token", "");
        if (refreshToken.length() == 0 && previous != null) {
            refreshToken = previous.refreshToken;
        }
        if (refreshToken.length() == 0) {
            throw new CloudProviderException("CLOUD_AUTH_FAILED", "OneDrive sign-in returned no refresh token");
        }
        long expiresAt = nowMillis + json.optLong("expires_in", 0) * 1000;
        String accountName = previous == null ? null : previous.accountName;
        return new TokenResult(new CloudTokenStore(accessToken, refreshToken, expiresAt, accountName));
    }

    Account getAccount(String accessToken) throws IOException, CloudProviderException {
        JSONObject json = graphJson(accessToken, GRAPH + "/me?$select=displayName,userPrincipalName");
        return new Account(
            json.optString("displayName", ""),
            json.optString("userPrincipalName", "")
        );
    }

    /** Lists a folder ({@code null} folderId = drive root): folders plus Markdown candidates. */
    List<Entry> listFolder(String accessToken, String folderId) throws IOException, CloudProviderException {
        String base = folderId == null || folderId.length() == 0
            ? GRAPH + "/me/drive/root/children"
            : GRAPH + "/me/drive/items/" + urlEncode(folderId) + "/children";
        String url = base + "?$select=id,name,folder,file,size,lastModifiedDateTime&$top=200";

        List<Entry> entries = new ArrayList<>();
        for (int page = 0; page < MAX_LIST_PAGES && url != null; page++) {
            JSONObject json = graphJson(accessToken, url);
            JSONArray values = json.optJSONArray("value");
            if (values != null) {
                for (int index = 0; index < values.length(); index++) {
                    JSONObject item = values.optJSONObject(index);
                    if (item == null) {
                        continue;
                    }
                    boolean isFolder = item.has("folder");
                    String name = item.optString("name", "");
                    if (!isFolder && !isListableDocumentName(name)) {
                        continue;
                    }
                    entries.add(new Entry(
                        item.optString("id", ""),
                        name,
                        isFolder,
                        item.optLong("size", 0),
                        item.optString("lastModifiedDateTime", "")
                    ));
                }
            }
            url = json.optString("@odata.nextLink", "");
            if (url.length() == 0) {
                url = null;
            }
        }
        return entries;
    }

    FileContent readFile(String accessToken, String itemId, int maxBytes)
        throws IOException, CloudProviderException {
        JSONObject metadata = graphJson(
            accessToken,
            GRAPH + "/me/drive/items/" + urlEncode(itemId) + "?$select=id,name,eTag,size"
        );
        long size = metadata.optLong("size", 0);
        if (size > maxBytes) {
            throw new CloudProviderException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }

        // /content answers 302 with a pre-authenticated download URL; fetch it
        // WITHOUT the Authorization header (the URL carries its own token and
        // some CDNs reject a bearer header).
        HttpTransport.Response redirect = transport.execute(new HttpTransport.Request(
            "GET",
            GRAPH + "/me/drive/items/" + urlEncode(itemId) + "/content",
            bearerHeaders(accessToken),
            null,
            maxBytes
        ));
        byte[] bytes;
        if (redirect.status == 302 || redirect.status == 301 || redirect.status == 307) {
            String location = redirect.header("Location");
            if (location == null || location.length() == 0) {
                throw new CloudProviderException("CLOUD_READ_FAILED", "OneDrive returned no download location");
            }
            HttpTransport.Response download = transport.execute(new HttpTransport.Request(
                "GET",
                location,
                new LinkedHashMap<>(),
                null,
                maxBytes
            ));
            if (download.status != 200) {
                throw statusException(download, "CLOUD_READ_FAILED", "OneDrive download failed");
            }
            bytes = download.body;
        } else if (redirect.status == 200) {
            bytes = redirect.body;
        } else {
            throw statusException(redirect, "CLOUD_READ_FAILED", "OneDrive download failed");
        }

        if (bytes == null) {
            bytes = new byte[0];
        }
        if (bytes.length > maxBytes) {
            throw new CloudProviderException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }
        return new FileContent(
            metadata.optString("name", ""),
            metadata.optString("eTag", ""),
            bytes
        );
    }

    WriteResult writeFile(String accessToken, String itemId, byte[] bytes, String expectedETag)
        throws IOException, CloudProviderException {
        Map<String, String> headers = bearerHeaders(accessToken);
        headers.put("Content-Type", "application/octet-stream");
        if (expectedETag != null && expectedETag.length() > 0) {
            headers.put("If-Match", expectedETag);
        }

        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "PUT",
            GRAPH + "/me/drive/items/" + urlEncode(itemId) + "/content",
            headers,
            bytes
        ));
        if (response.status == 412) {
            throw new CloudProviderException(
                "CLOUD_DOCUMENT_CONFLICT",
                "This document changed on OneDrive since it was opened"
            );
        }
        if (response.status != 200 && response.status != 201) {
            throw statusException(response, "CLOUD_WRITE_FAILED", "OneDrive save failed");
        }

        JSONObject json = parseJson(response.body);
        if (json == null) {
            throw new CloudProviderException("CLOUD_WRITE_FAILED", "OneDrive save returned an unreadable response");
        }
        return new WriteResult(
            json.optString("name", ""),
            json.optString("eTag", ""),
            json.optString("lastModifiedDateTime", "")
        );
    }

    /**
     * Creates a new document in the given folder ({@code null} = drive
     * root). The path-based upload with {@code conflictBehavior=fail}
     * refuses to silently overwrite an existing name — a save-as must
     * never eat another document.
     */
    CreateResult createFile(String accessToken, String parentId, String name, byte[] bytes)
        throws IOException, CloudProviderException {
        if (bytes.length > MAX_SIMPLE_UPLOAD_BYTES) {
            // Brand-new documents above the simple-upload cap are rejected
            // honestly; upload sessions are the follow-up if it ever matters.
            throw new CloudProviderException(
                "DOCUMENT_TOO_LARGE",
                "New OneDrive documents are limited to 4 MB"
            );
        }

        String base = parentId == null || parentId.length() == 0
            ? GRAPH + "/me/drive/root:/"
            : GRAPH + "/me/drive/items/" + urlEncode(parentId) + ":/";
        Map<String, String> headers = bearerHeaders(accessToken);
        headers.put("Content-Type", "application/octet-stream");

        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "PUT",
            base + encodePathSegment(name) + ":/content?@microsoft.graph.conflictBehavior=fail",
            headers,
            bytes
        ));
        if (response.status == 409) {
            throw new CloudProviderException(
                "CLOUD_NAME_EXISTS",
                "A document with this name already exists in the chosen OneDrive folder"
            );
        }
        if (response.status != 200 && response.status != 201) {
            throw statusException(response, "CLOUD_WRITE_FAILED", "OneDrive save failed");
        }

        JSONObject json = parseJson(response.body);
        if (json == null) {
            throw new CloudProviderException("CLOUD_WRITE_FAILED", "OneDrive save returned an unreadable response");
        }
        return new CreateResult(
            json.optString("id", ""),
            json.optString("name", ""),
            json.optString("eTag", ""),
            json.optString("lastModifiedDateTime", "")
        );
    }

    /** Percent-encodes a Graph path segment (URLEncoder's '+' is form encoding, not path). */
    static String encodePathSegment(String name) {
        return urlEncode(name).replace("+", "%20");
    }

    /**
     * Mirrors the local picker's accepted set: Markdown extensions plus
     * plain text (the picker admits text/plain). Listings have no MIME
     * type, so the extension carries the whole decision.
     */
    static boolean isListableDocumentName(String name) {
        return IncomingIntentParser.hasMarkdownExtension(name)
            || (name != null && name.toLowerCase(java.util.Locale.US).endsWith(".txt"));
    }

    private JSONObject graphJson(String accessToken, String url) throws IOException, CloudProviderException {
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "GET",
            url,
            bearerHeaders(accessToken),
            null
        ));
        if (response.status != 200) {
            throw statusException(response, "CLOUD_REQUEST_FAILED", "OneDrive request failed");
        }
        JSONObject json = parseJson(response.body);
        if (json == null) {
            throw new CloudProviderException("CLOUD_REQUEST_FAILED", "OneDrive returned an unreadable response");
        }
        return json;
    }

    private static CloudProviderException statusException(
        HttpTransport.Response response,
        String fallbackCode,
        String fallbackMessage
    ) {
        if (response.status == 401 || response.status == 403) {
            return new CloudProviderException(
                "CLOUD_AUTH_EXPIRED",
                "OneDrive access is no longer authorized; connect the account again"
            );
        }
        if (response.status == 404) {
            return new CloudProviderException(
                "CLOUD_DOCUMENT_NOT_FOUND",
                "This OneDrive document was moved or deleted"
            );
        }
        if (response.status == 429 || response.status >= 500) {
            return new CloudProviderException(
                "CLOUD_UNAVAILABLE",
                "OneDrive is temporarily unavailable; try again shortly"
            );
        }
        return new CloudProviderException(fallbackCode, fallbackMessage + " (HTTP " + response.status + ")");
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
