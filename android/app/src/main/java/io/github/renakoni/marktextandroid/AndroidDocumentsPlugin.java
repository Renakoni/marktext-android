package io.github.renakoni.marktextandroid;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@CapacitorPlugin(name = "AndroidDocuments")
public class AndroidDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final int MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;
    private static final String CALLBACK_OPEN_MARKDOWN_DOCUMENT = "openMarkdownDocumentResult";

    @PluginMethod
    public void openMarkdownDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "text/markdown",
                "text/x-markdown",
                "text/plain",
                "application/octet-stream"
            }
        );
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );

        try {
            startActivityForResult(call, intent, CALLBACK_OPEN_MARKDOWN_DOCUMENT);
        } catch (ActivityNotFoundException ex) {
            Log.e(TAG, "No Android document picker is available", ex);
            call.reject("No Android document picker is available", "DOCUMENT_PICKER_UNAVAILABLE", ex);
        }
    }

    @PluginMethod
    public void readMarkdownDocument(PluginCall call) {
        String sourceUri = call.getString("sourceUri", "");
        Uri uri = parseContentUri(sourceUri);
        if (uri == null) {
            call.reject("A valid content URI is required", "INVALID_SOURCE_URI");
            return;
        }

        try {
            JSObject result = buildDocumentResult(uri, null);
            Log.i(TAG, "Read Android document: " + safeForLog(result.getString("displayName")));
            call.resolve(result);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document read rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to read Android document", ex);
            call.reject("Failed to read Android document", "DOCUMENT_READ_FAILED", ex);
        }
    }

    @ActivityCallback
    private void openMarkdownDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.w(TAG, "Missing plugin call for Android document picker result");
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject canceled = new JSObject();
            canceled.put("canceled", true);
            call.resolve(canceled);
            return;
        }

        Intent data = result.getData();
        Uri uri = data.getData();
        if (uri == null) {
            call.reject("Android document picker returned no URI", "DOCUMENT_URI_MISSING");
            return;
        }

        try {
            JSObject document = buildDocumentResult(uri, data);
            persistUriPermission(uri, data);
            document.put("persisted", hasPersistedReadPermission(uri));
            Log.i(TAG, "Opened Android document: " + safeForLog(document.getString("displayName")));
            call.resolve(document);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document open rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to open Android document", ex);
            call.reject("Failed to open Android document", "DOCUMENT_READ_FAILED", ex);
        }
    }

    private JSObject buildDocumentResult(Uri uri, Intent grantIntent) throws IOException, DocumentReadException {
        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri);
        if (!isMarkdownCandidate(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_DOCUMENT",
                "Choose a Markdown or plain text document"
            );
        }

        String markdown = readText(uri);
        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        result.put("markdown", markdown);
        result.put("canWrite", canWrite(uri, grantIntent));
        result.put("persisted", hasPersistedReadPermission(uri));
        return result;
    }

    private Uri parseContentUri(String value) {
        if (value == null || value.length() == 0) {
            return null;
        }

        Uri uri = Uri.parse(value);
        if (!"content".equals(uri.getScheme())) {
            return null;
        }
        return uri;
    }

    private void persistUriPermission(Uri uri, Intent data) {
        int grantFlags = data.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION;
        if (grantFlags == 0) {
            return;
        }

        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, grantFlags);
        } catch (SecurityException ex) {
            Log.w(TAG, "Could not persist Android document URI permission", ex);
        }
    }

    private String readText(Uri uri) throws IOException, DocumentReadException {
        ContentResolver resolver = getContext().getContentResolver();
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) {
                throw new IOException("Content resolver returned no stream");
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int totalBytes = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                totalBytes += read;
                if (totalBytes > MAX_MARKDOWN_BYTES) {
                    throw new DocumentReadException(
                        "DOCUMENT_TOO_LARGE",
                        "Markdown document is larger than the current 5 MB limit"
                    );
                }
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String getDisplayName(Uri uri) {
        ContentResolver resolver = getContext().getContentResolver();
        try (
            Cursor cursor = resolver.query(
                uri,
                new String[] { OpenableColumns.DISPLAY_NAME },
                null,
                null,
                null
            )
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && value.trim().length() > 0) {
                        return value.trim();
                    }
                }
            }
        } catch (SecurityException ex) {
            Log.w(TAG, "Could not query Android document display name", ex);
        }

        String path = uri.getLastPathSegment();
        if (path != null && path.trim().length() > 0) {
            return path.trim();
        }
        return "Android document";
    }

    private String getMimeType(Uri uri) {
        String type = getContext().getContentResolver().getType(uri);
        return type == null ? "" : type.toLowerCase(Locale.US);
    }

    private String getProviderName(Uri uri) {
        String authority = uri.getAuthority();
        if (authority == null || authority.length() == 0) {
            return "Android document";
        }

        PackageManager packageManager = getContext().getPackageManager();
        ProviderInfo providerInfo = packageManager.resolveContentProvider(authority, 0);
        if (providerInfo != null) {
            CharSequence label = providerInfo.loadLabel(packageManager);
            if (label != null && label.length() > 0) {
                return label.toString();
            }
        }
        return authority;
    }

    private boolean isMarkdownCandidate(String displayName, String mimeType) {
        String lowerName = displayName == null ? "" : displayName.toLowerCase(Locale.US);
        boolean markdownExtension =
            lowerName.endsWith(".md") ||
            lowerName.endsWith(".markdown") ||
            lowerName.endsWith(".mdown") ||
            lowerName.endsWith(".mkdn") ||
            lowerName.endsWith(".mkd");

        if (markdownExtension) {
            return true;
        }

        return (
            "text/markdown".equals(mimeType) ||
            "text/x-markdown".equals(mimeType) ||
            "text/plain".equals(mimeType)
        );
    }

    private boolean canWrite(Uri uri, Intent grantIntent) {
        if (grantIntent != null && (grantIntent.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != 0) {
            return true;
        }

        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (uri.equals(permission.getUri()) && permission.isWritePermission()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasPersistedReadPermission(Uri uri) {
        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (uri.equals(permission.getUri()) && permission.isReadPermission()) {
                return true;
            }
        }
        return false;
    }

    private String safeForLog(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\r', ' ').replace('\n', ' ').trim();
    }

    private static class DocumentReadException extends Exception {

        final String code;

        DocumentReadException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
