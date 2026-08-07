package io.github.renakoni.marktextandroid;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Cloud documents over provider web APIs — no provider app required
 * (#185 Phase 2: OneDrive, then Google Drive). OAuth runs in the system
 * browser (embedded WebViews are provider-blocked); the redirect lands back
 * here through a per-provider intent filter. All network work runs on a
 * single-thread executor; protocol logic lives in the pure-JVM
 * {@link OneDriveGraphClient} and {@link GoogleDriveClient}.
 */
@CapacitorPlugin(name = "CloudDocuments")
public class CloudDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final String PROVIDER_ONEDRIVE = "onedrive";
    private static final String PROVIDER_GOOGLEDRIVE = "googledrive";
    private static final String PROVIDER_WEBDAV = "webdav";
    private static final String CLOUD_PREFS = "cloud_documents";
    private static final String PREF_ONEDRIVE_TOKENS = "onedrive_tokens";
    private static final String PREF_ONEDRIVE_PENDING_AUTH = "onedrive_pending_auth";
    private static final String PREF_GOOGLEDRIVE_TOKENS = "googledrive_tokens";
    private static final String PREF_GOOGLEDRIVE_PENDING_AUTH = "googledrive_pending_auth";
    private static final String EVENT_AUTH_COMPLETED = "cloudAuthCompleted";
    private static final String OAUTH_HOST = "oauth";
    private static final String OAUTH_ONEDRIVE_PATH = "/onedrive";
    private static final String OAUTH_GOOGLEDRIVE_PATH = "/oauth2redirect";

    private final ExecutorService cloudExecutor = Executors.newSingleThreadExecutor();
    private final CharsetSniffer cloudCharsetSniffer = new IcuCharsetSniffer();
    private final HttpTransport cloudTransport = new UrlConnectionTransport();
    private final OneDriveGraphClient graphClient = new OneDriveGraphClient(cloudTransport);
    private final GoogleDriveClient driveClient = new GoogleDriveClient(cloudTransport);

    /**
     * Per-provider wiring for the shared OAuth machinery: the pending/token
     * storage keys, the redirect shape, and the protocol client calls. The
     * connect/complete/refresh/disconnect flows themselves are identical
     * across providers and stay in one copy below.
     */
    private abstract class ProviderAuth {

        final String id;
        final String label;
        final String pendingPrefKey;
        final String tokensPrefKey;

        ProviderAuth(String id, String label, String pendingPrefKey, String tokensPrefKey) {
            this.id = id;
            this.label = label;
            this.pendingPrefKey = pendingPrefKey;
            this.tokensPrefKey = tokensPrefKey;
        }

        abstract String clientId();

        abstract String redirectUri();

        abstract boolean matchesRedirect(Uri data);

        abstract String authorizeUrl(String state, String codeChallenge);

        abstract CloudTokenStore exchangeCode(String code, String verifier, long nowMillis)
            throws IOException, CloudProviderException;

        abstract CloudTokenStore refresh(CloudTokenStore tokens, long nowMillis)
            throws IOException, CloudProviderException;

        /** Best-effort account label; the connection works without it. */
        abstract String fetchAccountName(String accessToken) throws IOException, CloudProviderException;

        /** Best-effort hook after stored tokens were dropped on disconnect. */
        void onDisconnect(CloudTokenStore tokens) {}
    }

    private final ProviderAuth oneDriveAuth = new ProviderAuth(
        PROVIDER_ONEDRIVE, "OneDrive", PREF_ONEDRIVE_PENDING_AUTH, PREF_ONEDRIVE_TOKENS) {

        @Override
        String clientId() {
            return CloudAuthConfig.ONEDRIVE_CLIENT_ID;
        }

        @Override
        String redirectUri() {
            // The package name IS the applicationId (".debug"-suffixed on
            // debug builds), matching the ${applicationId} manifest scheme.
            return getContext().getPackageName() + "://" + OAUTH_HOST + OAUTH_ONEDRIVE_PATH;
        }

        @Override
        boolean matchesRedirect(Uri data) {
            return getContext().getPackageName().equals(data.getScheme())
                && OAUTH_HOST.equals(data.getHost())
                && OAUTH_ONEDRIVE_PATH.equals(data.getPath());
        }

        @Override
        String authorizeUrl(String state, String codeChallenge) {
            return OneDriveGraphClient.buildAuthorizeUrl(clientId(), redirectUri(), state, codeChallenge);
        }

        @Override
        CloudTokenStore exchangeCode(String code, String verifier, long nowMillis)
            throws IOException, CloudProviderException {
            return graphClient.exchangeCode(clientId(), redirectUri(), code, verifier, nowMillis).tokens;
        }

        @Override
        CloudTokenStore refresh(CloudTokenStore tokens, long nowMillis)
            throws IOException, CloudProviderException {
            return graphClient.refresh(clientId(), tokens, nowMillis).tokens;
        }

        @Override
        String fetchAccountName(String accessToken) throws IOException, CloudProviderException {
            OneDriveGraphClient.Account account = graphClient.getAccount(accessToken);
            return account.userPrincipalName.length() > 0
                ? account.userPrincipalName
                : account.displayName;
        }
    };

    private final ProviderAuth googleDriveAuth = new ProviderAuth(
        PROVIDER_GOOGLEDRIVE, "Google Drive", PREF_GOOGLEDRIVE_PENDING_AUTH, PREF_GOOGLEDRIVE_TOKENS) {

        @Override
        String clientId() {
            return CloudAuthConfig.GOOGLEDRIVE_CLIENT_ID;
        }

        @Override
        String redirectUri() {
            // Google's documented native-app form: the reversed client id
            // as the scheme, no authority.
            return CloudAuthConfig.GOOGLEDRIVE_REDIRECT_SCHEME + ":" + OAUTH_GOOGLEDRIVE_PATH;
        }

        @Override
        boolean matchesRedirect(Uri data) {
            // Only auth redirects ever use the reversed-client-id scheme.
            return CloudAuthConfig.GOOGLEDRIVE_REDIRECT_SCHEME.equals(data.getScheme());
        }

        @Override
        String authorizeUrl(String state, String codeChallenge) {
            return GoogleDriveClient.buildAuthorizeUrl(clientId(), redirectUri(), state, codeChallenge);
        }

        @Override
        CloudTokenStore exchangeCode(String code, String verifier, long nowMillis)
            throws IOException, CloudProviderException {
            return driveClient.exchangeCode(clientId(), redirectUri(), code, verifier, nowMillis).tokens;
        }

        @Override
        CloudTokenStore refresh(CloudTokenStore tokens, long nowMillis)
            throws IOException, CloudProviderException {
            return driveClient.refresh(clientId(), tokens, nowMillis).tokens;
        }

        @Override
        String fetchAccountName(String accessToken) throws IOException, CloudProviderException {
            return driveClient.getAccountName(accessToken);
        }

        @Override
        void onDisconnect(CloudTokenStore tokens) {
            // Revoking the refresh token retires the whole grant server-side;
            // the local state is already cleared, so failures only log.
            cloudExecutor.execute(() -> {
                try {
                    driveClient.revoke(tokens.refreshToken);
                    Log.i(TAG, "Revoked the Google Drive grant");
                } catch (IOException ex) {
                    Log.w(TAG, "Google Drive token revocation failed", ex);
                }
            });
        }
    };

    @Override
    public void load() {
        super.load();
        Activity activity = getActivity();
        if (activity != null) {
            // A cold-start redirect arrives as the launch intent, never
            // through handleOnNewIntent.
            maybeCompleteAuth(activity.getIntent());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        maybeCompleteAuth(intent);
    }

    @PluginMethod
    public void getCloudAccountState(PluginCall call) {
        String provider = call.getString("provider", "");
        if (PROVIDER_WEBDAV.equals(provider)) {
            JSObject result = new JSObject();
            result.put("connected", false);
            result.put("available", false);
            result.put("accountName", JSObject.NULL);
            call.resolve(result);
            return;
        }
        ProviderAuth auth = providerAuthFor(provider);
        if (auth == null) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }

        CloudTokenStore tokens = readTokens(auth);
        JSObject result = new JSObject();
        result.put("connected", tokens != null);
        result.put("available", auth.clientId().length() > 0);
        result.put(
            "accountName",
            tokens == null || tokens.accountName == null ? JSObject.NULL : tokens.accountName
        );
        call.resolve(result);
    }

    @PluginMethod
    public void connectCloudAccount(PluginCall call) {
        String provider = call.getString("provider", "");
        if (PROVIDER_WEBDAV.equals(provider)) {
            call.reject("WebDAV support is not available yet", WebDavCloudClient.NOT_IMPLEMENTED_CODE);
            return;
        }
        ProviderAuth auth = providerAuthFor(provider);
        if (auth == null) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }
        if (auth.clientId().length() == 0) {
            call.reject(
                "The " + auth.label + " client id is not configured in this build",
                "CLOUD_CLIENT_ID_MISSING"
            );
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No Android activity is available", "CLOUD_AUTH_FAILED");
            return;
        }

        String verifier = PkceUtil.generateVerifier();
        String state = PkceUtil.generateVerifier();
        try {
            JSONObject pending = new JSONObject();
            pending.put("state", state);
            pending.put("verifier", verifier);
            cloudPrefs().edit().putString(auth.pendingPrefKey, pending.toString()).apply();
        } catch (JSONException ex) {
            call.reject("Could not start the " + auth.label + " sign-in", "CLOUD_AUTH_FAILED", ex);
            return;
        }

        String authorizeUrl = auth.authorizeUrl(state, PkceUtil.challengeFor(verifier));
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(authorizeUrl)));
        } catch (ActivityNotFoundException ex) {
            cloudPrefs().edit().remove(auth.pendingPrefKey).apply();
            call.reject(
                "No browser is available for the " + auth.label + " sign-in",
                "CLOUD_BROWSER_UNAVAILABLE",
                ex
            );
            return;
        }

        Log.i(TAG, "Started " + auth.label + " sign-in in the system browser");
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void disconnectCloudAccount(PluginCall call) {
        String provider = call.getString("provider", "");
        ProviderAuth auth = providerAuthFor(provider);
        if (auth == null) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }
        CloudTokenStore tokens = readTokens(auth);
        cloudPrefs()
            .edit()
            .remove(auth.tokensPrefKey)
            .remove(auth.pendingPrefKey)
            .apply();
        Log.i(TAG, "Disconnected the " + auth.label + " account");
        call.resolve(new JSObject());
        if (tokens != null) {
            auth.onDisconnect(tokens);
        }
    }

    @PluginMethod
    public void listCloudFolder(PluginCall call) {
        String provider = call.getString("provider", "");
        String folderId = call.getString("folderId", "");
        ProviderAuth auth = requireDocumentProvider(call, provider);
        if (auth == null) {
            return;
        }
        if (auth != oneDriveAuth) {
            // Google Drive files are chosen through the Google Picker;
            // drive.file cannot enumerate a folder the app was never shown.
            call.reject(
                auth.label + " does not support in-app folder browsing",
                "CLOUD_OPERATION_UNSUPPORTED"
            );
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore tokens = requireFreshTokens(oneDriveAuth);
                List<OneDriveGraphClient.Entry> entries =
                    graphClient.listFolder(tokens.accessToken, folderId);
                entries.sort(
                    Comparator.comparing((OneDriveGraphClient.Entry entry) -> !entry.isFolder)
                        .thenComparing(entry -> entry.name, String.CASE_INSENSITIVE_ORDER)
                );

                JSArray values = new JSArray();
                for (OneDriveGraphClient.Entry entry : entries) {
                    JSObject value = new JSObject();
                    value.put("id", entry.id);
                    value.put("name", entry.name);
                    value.put("isFolder", entry.isFolder);
                    value.put("size", entry.size);
                    value.put("lastModified", entry.lastModified);
                    values.put(value);
                }
                JSObject result = new JSObject();
                result.put("entries", values);
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, "OneDrive folder listing failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, "OneDrive folder listing failed", ex);
                call.reject("Could not reach OneDrive", "CLOUD_NETWORK_FAILED", ex);
            }
        });
    }

    /**
     * A fresh access token plus the Picker configuration, exposed only for
     * the in-WebView Google Picker (the WebView is this app's own code; the
     * token never leaves the process except toward Google's own origin).
     */
    @PluginMethod
    public void getCloudAccessToken(PluginCall call) {
        String provider = call.getString("provider", "");
        if (!PROVIDER_GOOGLEDRIVE.equals(provider)) {
            call.reject(
                "Access tokens are only exposed for the Google Drive picker",
                "CLOUD_OPERATION_UNSUPPORTED"
            );
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore tokens = requireFreshTokens(googleDriveAuth);
                JSObject result = new JSObject();
                result.put("accessToken", tokens.accessToken);
                result.put("pickerApiKey", CloudAuthConfig.GOOGLE_PICKER_API_KEY);
                result.put("appId", CloudAuthConfig.GOOGLE_PROJECT_NUMBER);
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, "Google Drive token request failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, "Google Drive token request failed", ex);
                call.reject("Could not reach Google Drive", "CLOUD_NETWORK_FAILED", ex);
            }
        });
    }

    @PluginMethod
    public void readCloudDocument(PluginCall call) {
        String provider = call.getString("provider", "");
        String fileId = call.getString("fileId", "");
        String defaultEncoding = MarkdownCodec.normalizeEncoding(call.getString("defaultEncoding", "utf8"));
        boolean autoDetectEncoding = call.getBoolean("autoDetectEncoding", true);
        ProviderAuth auth = requireDocumentProvider(call, provider);
        if (auth == null) {
            return;
        }
        if (fileId.length() == 0) {
            call.reject("A cloud file id is required", "INVALID_CLOUD_FILE_ID");
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore tokens = requireFreshTokens(auth);
                String name;
                String versionTag;
                byte[] bytes;
                if (auth == googleDriveAuth) {
                    GoogleDriveClient.FileContent file = driveClient.readFile(
                        tokens.accessToken,
                        fileId,
                        MarkdownCodec.MAX_MARKDOWN_BYTES
                    );
                    name = file.name;
                    versionTag = file.headRevisionId;
                    bytes = file.bytes;
                } else {
                    OneDriveGraphClient.FileContent file = graphClient.readFile(
                        tokens.accessToken,
                        fileId,
                        MarkdownCodec.MAX_MARKDOWN_BYTES
                    );
                    name = file.name;
                    versionTag = file.eTag;
                    bytes = file.bytes;
                }
                DecodedMarkdown decoded = MarkdownCodec.decode(
                    bytes,
                    defaultEncoding,
                    autoDetectEncoding,
                    cloudCharsetSniffer
                );

                JSObject result = new JSObject();
                result.put("fileId", fileId);
                result.put("displayName", name);
                result.put("markdown", decoded.markdown);
                result.put("encoding", MarkdownCodec.normalizeEncoding(decoded.encoding));
                result.put("hasEncodingBom", decoded.hasBom);
                result.put("eTag", versionTag);
                result.put("providerName", auth.label);
                result.put("canWrite", true);
                Log.i(TAG, "Read " + auth.label + " document: " + safeForLog(name));
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, auth.label + " document read failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (DocumentReadException ex) {
                Log.w(TAG, auth.label + " document read rejected: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, auth.label + " document read failed", ex);
                call.reject("Could not reach " + auth.label, "CLOUD_NETWORK_FAILED", ex);
            }
        });
    }

    @PluginMethod
    public void writeCloudDocument(PluginCall call) {
        String provider = call.getString("provider", "");
        String fileId = call.getString("fileId", "");
        String markdown = call.getString("markdown", null);
        String eTag = call.getString("eTag", "");
        String encoding = MarkdownCodec.normalizeEncoding(call.getString("encoding", "utf8"));
        boolean writeBom = call.getBoolean("writeBom", false);
        ProviderAuth auth = requireDocumentProvider(call, provider);
        if (auth == null) {
            return;
        }
        if (fileId.length() == 0) {
            call.reject("A cloud file id is required", "INVALID_CLOUD_FILE_ID");
            return;
        }
        if (markdown == null) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                byte[] bytes = MarkdownCodec.validateBytes(
                    markdown,
                    new MarkdownWriteOptions(encoding, writeBom)
                );
                CloudTokenStore tokens = requireFreshTokens(auth);
                String name;
                String versionTag;
                String lastModified;
                if (auth == googleDriveAuth) {
                    GoogleDriveClient.WriteResult written =
                        driveClient.writeFile(tokens.accessToken, fileId, bytes, eTag);
                    name = written.name;
                    versionTag = written.headRevisionId;
                    lastModified = written.lastModified;
                } else {
                    OneDriveGraphClient.WriteResult written =
                        graphClient.writeFile(tokens.accessToken, fileId, bytes, eTag);
                    name = written.name;
                    versionTag = written.eTag;
                    lastModified = written.lastModified;
                }

                JSObject result = new JSObject();
                result.put("fileId", fileId);
                result.put("displayName", name);
                result.put("eTag", versionTag);
                result.put("lastModified", lastModified);
                Log.i(TAG, "Wrote " + auth.label + " document: " + safeForLog(name));
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, auth.label + " document write failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (DocumentReadException ex) {
                Log.w(TAG, auth.label + " document write rejected: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, auth.label + " document write failed", ex);
                call.reject("Could not reach " + auth.label, "CLOUD_NETWORK_FAILED", ex);
            }
        });
    }

    private ProviderAuth providerAuthFor(String provider) {
        if (PROVIDER_ONEDRIVE.equals(provider)) {
            return oneDriveAuth;
        }
        if (PROVIDER_GOOGLEDRIVE.equals(provider)) {
            return googleDriveAuth;
        }
        return null;
    }

    private ProviderAuth requireDocumentProvider(PluginCall call, String provider) {
        if (PROVIDER_WEBDAV.equals(provider)) {
            call.reject("WebDAV support is not available yet", WebDavCloudClient.NOT_IMPLEMENTED_CODE);
            return null;
        }
        ProviderAuth auth = providerAuthFor(provider);
        if (auth == null) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
        }
        return auth;
    }

    private void maybeCompleteAuth(Intent intent) {
        if (intent == null || intent.getData() == null) {
            return;
        }
        Uri data = intent.getData();
        ProviderAuth auth;
        if (oneDriveAuth.matchesRedirect(data)) {
            auth = oneDriveAuth;
        } else if (googleDriveAuth.matchesRedirect(data)) {
            auth = googleDriveAuth;
        } else {
            return;
        }

        String pendingSerialized = cloudPrefs().getString(auth.pendingPrefKey, "");
        if (pendingSerialized.length() == 0) {
            return;
        }

        String expectedState;
        String verifier;
        try {
            JSONObject pending = new JSONObject(pendingSerialized);
            expectedState = pending.optString("state", "");
            verifier = pending.optString("verifier", "");
        } catch (JSONException ex) {
            cloudPrefs().edit().remove(auth.pendingPrefKey).apply();
            emitAuthResult(auth, false, null, "CLOUD_AUTH_FAILED",
                "The " + auth.label + " sign-in state was unreadable");
            return;
        }

        // The state parameter must match BEFORE the pending record is
        // consumed, on error responses too: the scheme is public, so any
        // app could fire a forged redirect (e.g. error=access_denied) to
        // wipe the in-flight verifier and deny the real sign-in. Redirects
        // that cannot prove they belong to our request are ignored.
        String state = data.getQueryParameter("state");
        if (expectedState.length() == 0 || !expectedState.equals(state)) {
            Log.w(TAG, "Ignored a " + auth.label + " redirect with a mismatched state");
            return;
        }
        // Consuming the record here also deduplicates delivery: the launch
        // intent can be observed again after handleOnNewIntent ran.
        cloudPrefs().edit().remove(auth.pendingPrefKey).apply();

        String error = data.getQueryParameter("error");
        if (error != null && error.length() > 0) {
            boolean canceled = "access_denied".equals(error);
            Log.w(TAG, auth.label + " sign-in was not completed: " + safeForLog(error));
            emitAuthResult(
                auth,
                false,
                null,
                canceled ? "CLOUD_AUTH_CANCELED" : "CLOUD_AUTH_FAILED",
                canceled
                    ? "The " + auth.label + " sign-in was canceled"
                    : "The " + auth.label + " sign-in failed"
            );
            return;
        }

        String code = data.getQueryParameter("code");
        if (code == null || code.length() == 0) {
            emitAuthResult(auth, false, null, "CLOUD_AUTH_FAILED",
                "The " + auth.label + " sign-in response was invalid");
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore exchanged = auth.exchangeCode(code, verifier, System.currentTimeMillis());
                String accountName = null;
                try {
                    accountName = auth.fetchAccountName(exchanged.accessToken);
                } catch (CloudProviderException | IOException ex) {
                    // The account label is cosmetic; the connection still works.
                    Log.w(TAG, "Could not read the " + auth.label + " account name", ex);
                }
                saveTokens(auth, exchanged.withAccountName(accountName));
                Log.i(TAG, "Connected the " + auth.label + " account");
                emitAuthResult(auth, true, accountName, null, null);
            } catch (CloudProviderException ex) {
                Log.w(TAG, auth.label + " sign-in completion failed: " + ex.getMessage());
                emitAuthResult(auth, false, null, ex.code, ex.getMessage());
            } catch (IOException ex) {
                Log.w(TAG, auth.label + " sign-in completion failed", ex);
                emitAuthResult(auth, false, null, "CLOUD_NETWORK_FAILED",
                    "Could not reach " + auth.label);
            }
        });
    }

    private void emitAuthResult(
        ProviderAuth auth,
        boolean connected,
        String accountName,
        String errorCode,
        String message
    ) {
        JSObject event = new JSObject();
        event.put("provider", auth.id);
        event.put("connected", connected);
        event.put("accountName", accountName == null ? JSObject.NULL : accountName);
        if (errorCode != null) {
            event.put("errorCode", errorCode);
            event.put("message", message);
        }
        notifyListeners(EVENT_AUTH_COMPLETED, event, true);
    }

    private CloudTokenStore requireFreshTokens(ProviderAuth auth) throws CloudProviderException, IOException {
        CloudTokenStore tokens = readTokens(auth);
        if (tokens == null) {
            throw new CloudProviderException(
                "CLOUD_NOT_CONNECTED",
                "No " + auth.label + " account is connected"
            );
        }
        if (tokens.isAccessTokenFresh(System.currentTimeMillis())) {
            return tokens;
        }

        try {
            CloudTokenStore refreshed = auth.refresh(tokens, System.currentTimeMillis());
            saveTokens(auth, refreshed);
            return refreshed;
        } catch (CloudProviderException ex) {
            if ("CLOUD_AUTH_EXPIRED".equals(ex.code)) {
                // The refresh token is dead; drop it so the account state
                // honestly reads disconnected.
                cloudPrefs().edit().remove(auth.tokensPrefKey).apply();
            }
            throw ex;
        }
    }

    private CloudTokenStore readTokens(ProviderAuth auth) {
        return CloudTokenStore.parse(cloudPrefs().getString(auth.tokensPrefKey, ""));
    }

    private void saveTokens(ProviderAuth auth, CloudTokenStore tokens) {
        cloudPrefs().edit().putString(auth.tokensPrefKey, tokens.serialize()).apply();
    }

    private SharedPreferences cloudPrefs() {
        return getContext().getSharedPreferences(CLOUD_PREFS, Context.MODE_PRIVATE);
    }

    private String safeForLog(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\r', ' ').replace('\n', ' ').trim();
    }

    /** Real transport: redirects are handled by the caller, never followed. */
    private static final class UrlConnectionTransport implements HttpTransport {

        @Override
        public Response execute(Request request) throws IOException {
            HttpURLConnection connection = (HttpURLConnection) new URL(request.url).openConnection();
            try {
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20_000);
                connection.setReadTimeout(30_000);
                connection.setRequestMethod(request.method);
                for (Map.Entry<String, String> header : request.headers.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
                if (request.body != null) {
                    connection.setDoOutput(true);
                    connection.setFixedLengthStreamingMode(request.body.length);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(request.body);
                    }
                }

                int status = connection.getResponseCode();
                Map<String, String> headers = new LinkedHashMap<>();
                for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                    if (header.getKey() != null && !header.getValue().isEmpty()) {
                        headers.put(header.getKey(), header.getValue().get(0));
                    }
                }

                InputStream stream = status >= 400
                    ? connection.getErrorStream()
                    : connection.getInputStream();
                ByteArrayOutputStream body = new ByteArrayOutputStream();
                if (stream != null) {
                    // Bounded read: deliver at most maxResponseBytes + 1 so
                    // the caller sees the overflow without this transport
                    // ever buffering an arbitrarily large response.
                    int limit = request.maxResponseBytes > 0
                        ? request.maxResponseBytes + 1
                        : Integer.MAX_VALUE;
                    byte[] buffer = new byte[8192];
                    int read;
                    while (body.size() < limit && (read = stream.read(buffer)) != -1) {
                        int keep = Math.min(read, limit - body.size());
                        body.write(buffer, 0, keep);
                    }
                    stream.close();
                }
                return new Response(status, headers, body.toByteArray());
            } finally {
                connection.disconnect();
            }
        }
    }
}
