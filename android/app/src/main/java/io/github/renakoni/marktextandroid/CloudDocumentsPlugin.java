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
import java.util.ArrayList;
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
 * (#185 Phase 2, OneDrive first). OAuth runs in the system browser
 * (embedded WebViews are provider-blocked); the redirect lands back here
 * through the applicationId-scheme intent filter. All network work runs on
 * a single-thread executor; Graph protocol logic lives in the pure-JVM
 * {@link OneDriveGraphClient}.
 */
@CapacitorPlugin(name = "CloudDocuments")
public class CloudDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final String PROVIDER_ONEDRIVE = "onedrive";
    private static final String PROVIDER_WEBDAV = "webdav";
    private static final String CLOUD_PREFS = "cloud_documents";
    private static final String PREF_ONEDRIVE_TOKENS = "onedrive_tokens";
    private static final String PREF_ONEDRIVE_PENDING_AUTH = "onedrive_pending_auth";
    private static final String EVENT_AUTH_COMPLETED = "cloudAuthCompleted";
    private static final String OAUTH_HOST = "oauth";
    private static final String OAUTH_ONEDRIVE_PATH = "/onedrive";

    private final ExecutorService cloudExecutor = Executors.newSingleThreadExecutor();
    private final CharsetSniffer cloudCharsetSniffer = new IcuCharsetSniffer();
    private final OneDriveGraphClient graphClient =
        new OneDriveGraphClient(new UrlConnectionTransport());

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
        if (!PROVIDER_ONEDRIVE.equals(provider)) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }

        CloudTokenStore tokens = readTokens();
        JSObject result = new JSObject();
        result.put("connected", tokens != null);
        result.put("available", CloudAuthConfig.ONEDRIVE_CLIENT_ID.length() > 0);
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
        if (!PROVIDER_ONEDRIVE.equals(provider)) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }
        if (CloudAuthConfig.ONEDRIVE_CLIENT_ID.length() == 0) {
            call.reject(
                "The OneDrive client id is not configured in this build",
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
            cloudPrefs().edit().putString(PREF_ONEDRIVE_PENDING_AUTH, pending.toString()).apply();
        } catch (JSONException ex) {
            call.reject("Could not start the OneDrive sign-in", "CLOUD_AUTH_FAILED", ex);
            return;
        }

        String authorizeUrl = OneDriveGraphClient.buildAuthorizeUrl(
            CloudAuthConfig.ONEDRIVE_CLIENT_ID,
            oneDriveRedirectUri(),
            state,
            PkceUtil.challengeFor(verifier)
        );
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(authorizeUrl)));
        } catch (ActivityNotFoundException ex) {
            cloudPrefs().edit().remove(PREF_ONEDRIVE_PENDING_AUTH).apply();
            call.reject("No browser is available for the OneDrive sign-in", "CLOUD_BROWSER_UNAVAILABLE", ex);
            return;
        }

        Log.i(TAG, "Started OneDrive sign-in in the system browser");
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void disconnectCloudAccount(PluginCall call) {
        String provider = call.getString("provider", "");
        if (!PROVIDER_ONEDRIVE.equals(provider)) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return;
        }
        cloudPrefs()
            .edit()
            .remove(PREF_ONEDRIVE_TOKENS)
            .remove(PREF_ONEDRIVE_PENDING_AUTH)
            .apply();
        Log.i(TAG, "Disconnected the OneDrive account");
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void listCloudFolder(PluginCall call) {
        String provider = call.getString("provider", "");
        String folderId = call.getString("folderId", "");
        if (!requireOneDrive(call, provider)) {
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore tokens = requireFreshTokens();
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

    @PluginMethod
    public void readCloudDocument(PluginCall call) {
        String provider = call.getString("provider", "");
        String fileId = call.getString("fileId", "");
        String defaultEncoding = MarkdownCodec.normalizeEncoding(call.getString("defaultEncoding", "utf8"));
        boolean autoDetectEncoding = call.getBoolean("autoDetectEncoding", true);
        if (!requireOneDrive(call, provider)) {
            return;
        }
        if (fileId.length() == 0) {
            call.reject("A cloud file id is required", "INVALID_CLOUD_FILE_ID");
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                CloudTokenStore tokens = requireFreshTokens();
                OneDriveGraphClient.FileContent file = graphClient.readFile(
                    tokens.accessToken,
                    fileId,
                    MarkdownCodec.MAX_MARKDOWN_BYTES
                );
                DecodedMarkdown decoded = MarkdownCodec.decode(
                    file.bytes,
                    defaultEncoding,
                    autoDetectEncoding,
                    cloudCharsetSniffer
                );

                JSObject result = new JSObject();
                result.put("fileId", fileId);
                result.put("displayName", file.name);
                result.put("markdown", decoded.markdown);
                result.put("encoding", MarkdownCodec.normalizeEncoding(decoded.encoding));
                result.put("hasEncodingBom", decoded.hasBom);
                result.put("eTag", file.eTag);
                result.put("providerName", "OneDrive");
                result.put("canWrite", true);
                Log.i(TAG, "Read OneDrive document: " + safeForLog(file.name));
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, "OneDrive document read failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (DocumentReadException ex) {
                Log.w(TAG, "OneDrive document read rejected: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, "OneDrive document read failed", ex);
                call.reject("Could not reach OneDrive", "CLOUD_NETWORK_FAILED", ex);
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
        if (!requireOneDrive(call, provider)) {
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
                CloudTokenStore tokens = requireFreshTokens();
                OneDriveGraphClient.WriteResult written =
                    graphClient.writeFile(tokens.accessToken, fileId, bytes, eTag);

                JSObject result = new JSObject();
                result.put("fileId", fileId);
                result.put("displayName", written.name);
                result.put("eTag", written.eTag);
                result.put("lastModified", written.lastModified);
                Log.i(TAG, "Wrote OneDrive document: " + safeForLog(written.name));
                call.resolve(result);
            } catch (CloudProviderException ex) {
                Log.w(TAG, "OneDrive document write failed: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (DocumentReadException ex) {
                Log.w(TAG, "OneDrive document write rejected: " + ex.getMessage());
                call.reject(ex.getMessage(), ex.code, ex);
            } catch (IOException ex) {
                Log.w(TAG, "OneDrive document write failed", ex);
                call.reject("Could not reach OneDrive", "CLOUD_NETWORK_FAILED", ex);
            }
        });
    }

    private boolean requireOneDrive(PluginCall call, String provider) {
        if (PROVIDER_WEBDAV.equals(provider)) {
            call.reject("WebDAV support is not available yet", WebDavCloudClient.NOT_IMPLEMENTED_CODE);
            return false;
        }
        if (!PROVIDER_ONEDRIVE.equals(provider)) {
            call.reject("Unknown cloud provider", "CLOUD_PROVIDER_UNKNOWN");
            return false;
        }
        return true;
    }

    private void maybeCompleteAuth(Intent intent) {
        if (intent == null || intent.getData() == null) {
            return;
        }
        Uri data = intent.getData();
        if (!getContext().getPackageName().equals(data.getScheme())
            || !OAUTH_HOST.equals(data.getHost())
            || !OAUTH_ONEDRIVE_PATH.equals(data.getPath())) {
            return;
        }

        // Clearing the pending record first also deduplicates delivery: the
        // launch intent can be observed again after handleOnNewIntent ran.
        String pendingSerialized = cloudPrefs().getString(PREF_ONEDRIVE_PENDING_AUTH, "");
        cloudPrefs().edit().remove(PREF_ONEDRIVE_PENDING_AUTH).apply();
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
            emitAuthResult(false, null, "CLOUD_AUTH_FAILED", "The OneDrive sign-in state was unreadable");
            return;
        }

        String error = data.getQueryParameter("error");
        if (error != null && error.length() > 0) {
            boolean canceled = "access_denied".equals(error);
            Log.w(TAG, "OneDrive sign-in was not completed: " + safeForLog(error));
            emitAuthResult(
                false,
                null,
                canceled ? "CLOUD_AUTH_CANCELED" : "CLOUD_AUTH_FAILED",
                canceled ? "The OneDrive sign-in was canceled" : "The OneDrive sign-in failed"
            );
            return;
        }

        String code = data.getQueryParameter("code");
        String state = data.getQueryParameter("state");
        if (code == null || code.length() == 0 || !expectedState.equals(state)) {
            emitAuthResult(false, null, "CLOUD_AUTH_FAILED", "The OneDrive sign-in response was invalid");
            return;
        }

        cloudExecutor.execute(() -> {
            try {
                OneDriveGraphClient.TokenResult exchanged = graphClient.exchangeCode(
                    CloudAuthConfig.ONEDRIVE_CLIENT_ID,
                    oneDriveRedirectUri(),
                    code,
                    verifier,
                    System.currentTimeMillis()
                );
                String accountName = null;
                try {
                    OneDriveGraphClient.Account account =
                        graphClient.getAccount(exchanged.tokens.accessToken);
                    accountName = account.userPrincipalName.length() > 0
                        ? account.userPrincipalName
                        : account.displayName;
                } catch (CloudProviderException | IOException ex) {
                    // The account label is cosmetic; the connection still works.
                    Log.w(TAG, "Could not read the OneDrive account name", ex);
                }
                saveTokens(exchanged.tokens.withAccountName(accountName));
                Log.i(TAG, "Connected the OneDrive account");
                emitAuthResult(true, accountName, null, null);
            } catch (CloudProviderException ex) {
                Log.w(TAG, "OneDrive sign-in completion failed: " + ex.getMessage());
                emitAuthResult(false, null, ex.code, ex.getMessage());
            } catch (IOException ex) {
                Log.w(TAG, "OneDrive sign-in completion failed", ex);
                emitAuthResult(false, null, "CLOUD_NETWORK_FAILED", "Could not reach OneDrive");
            }
        });
    }

    private void emitAuthResult(boolean connected, String accountName, String errorCode, String message) {
        JSObject event = new JSObject();
        event.put("provider", PROVIDER_ONEDRIVE);
        event.put("connected", connected);
        event.put("accountName", accountName == null ? JSObject.NULL : accountName);
        if (errorCode != null) {
            event.put("errorCode", errorCode);
            event.put("message", message);
        }
        notifyListeners(EVENT_AUTH_COMPLETED, event, true);
    }

    private CloudTokenStore requireFreshTokens() throws CloudProviderException, IOException {
        CloudTokenStore tokens = readTokens();
        if (tokens == null) {
            throw new CloudProviderException(
                "CLOUD_NOT_CONNECTED",
                "No OneDrive account is connected"
            );
        }
        if (tokens.isAccessTokenFresh(System.currentTimeMillis())) {
            return tokens;
        }

        try {
            OneDriveGraphClient.TokenResult refreshed = graphClient.refresh(
                CloudAuthConfig.ONEDRIVE_CLIENT_ID,
                tokens,
                System.currentTimeMillis()
            );
            saveTokens(refreshed.tokens);
            return refreshed.tokens;
        } catch (CloudProviderException ex) {
            if ("CLOUD_AUTH_EXPIRED".equals(ex.code)) {
                // The refresh token is dead; drop it so the account state
                // honestly reads disconnected.
                cloudPrefs().edit().remove(PREF_ONEDRIVE_TOKENS).apply();
            }
            throw ex;
        }
    }

    private CloudTokenStore readTokens() {
        return CloudTokenStore.parse(cloudPrefs().getString(PREF_ONEDRIVE_TOKENS, ""));
    }

    private void saveTokens(CloudTokenStore tokens) {
        cloudPrefs().edit().putString(PREF_ONEDRIVE_TOKENS, tokens.serialize()).apply();
    }

    private SharedPreferences cloudPrefs() {
        return getContext().getSharedPreferences(CLOUD_PREFS, Context.MODE_PRIVATE);
    }

    private String oneDriveRedirectUri() {
        // The package name IS the applicationId (".debug"-suffixed on debug
        // builds), matching the ${applicationId} scheme in the manifest.
        return getContext().getPackageName() + "://" + OAUTH_HOST + OAUTH_ONEDRIVE_PATH;
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
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = stream.read(buffer)) != -1) {
                        body.write(buffer, 0, read);
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
