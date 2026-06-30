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
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "AndroidDocuments")
public class AndroidDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final int MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;
    private static final String CALLBACK_OPEN_MARKDOWN_DOCUMENT = "openMarkdownDocumentResult";
    private static final String CALLBACK_CREATE_MARKDOWN_DOCUMENT = "createMarkdownDocumentResult";
    private static final String EVENT_OPEN_WITH_DOCUMENT = "openWithDocument";

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleOpenWithIntent(intent);
    }

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
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
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
    public void createMarkdownDocument(PluginCall call) {
        String markdown = call.getString("markdown", null);
        if (markdown == null) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        try {
            validateMarkdownBytes(markdown);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document create rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/markdown");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "text/markdown",
                "text/x-markdown",
                "text/plain"
            }
        );
        intent.putExtra(Intent.EXTRA_TITLE, normalizeSuggestedMarkdownName(call.getString("suggestedName", "")));
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );

        try {
            startActivityForResult(call, intent, CALLBACK_CREATE_MARKDOWN_DOCUMENT);
        } catch (ActivityNotFoundException ex) {
            Log.e(TAG, "No Android document creator is available", ex);
            call.reject("No Android document creator is available", "DOCUMENT_CREATOR_UNAVAILABLE", ex);
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
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android document no longer exists", ex);
            call.reject("This Android document was moved or deleted", "DOCUMENT_NOT_FOUND", ex);
        } catch (SecurityException ex) {
            Log.w(TAG, "Android document read permission is no longer available", ex);
            call.reject("Android document permission is no longer available", "DOCUMENT_PERMISSION_LOST", ex);
        } catch (IOException ex) {
            Log.e(TAG, "Failed to read Android document", ex);
            call.reject("Failed to read Android document", "DOCUMENT_READ_FAILED", ex);
        }
    }

    @PluginMethod
    public void writeMarkdownDocument(PluginCall call) {
        String sourceUri = call.getString("sourceUri", "");
        String markdown = call.getString("markdown", null);
        Uri uri = parseContentUri(sourceUri);
        if (uri == null) {
            call.reject("A valid content URI is required", "INVALID_SOURCE_URI");
            return;
        }
        if (markdown == null) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        try {
            JSObject result = writeDocumentResult(uri, markdown);
            Log.i(TAG, "Wrote Android document: " + safeForLog(result.getString("displayName")));
            call.resolve(result);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document write rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android document no longer exists", ex);
            call.reject("This Android document was moved or deleted", "DOCUMENT_NOT_FOUND", ex);
        } catch (SecurityException ex) {
            Log.w(TAG, "Android document write permission is no longer available", ex);
            call.reject("Android document permission is no longer available", "DOCUMENT_PERMISSION_LOST", ex);
        } catch (IOException ex) {
            Log.e(TAG, "Failed to write Android document", ex);
            call.reject("Failed to write Android document", "DOCUMENT_WRITE_FAILED", ex);
        }
    }

    private void handleOpenWithIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }

        Uri uri = intent.getData();
        if (uri == null) {
            notifyOpenWithRejected("DOCUMENT_URI_MISSING", "Android open-with intent returned no URI");
            return;
        }

        if (!hasOnlyAllowedViewCategories(intent)) {
            Log.w(TAG, "Rejected Android open-with intent with unsupported categories");
            notifyOpenWithRejected("INVALID_OPEN_WITH_INTENT", "This Android open-with request is not supported");
            return;
        }

        if (!"content".equals(uri.getScheme())) {
            Log.w(TAG, "Rejected Android open-with URI with unsupported scheme: " + safeForLog(uri.getScheme()));
            notifyOpenWithRejected("INVALID_SOURCE_URI", "A valid content URI is required");
            return;
        }

        try {
            JSObject document = buildOpenWithDocumentResult(uri, intent);
            if ((intent.getFlags() & Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION) != 0) {
                persistUriPermission(uri, intent);
            }
            document.put("persisted", hasPersistedReadPermission(uri));
            document.put("canWrite", canWrite(uri, intent));
            JSObject event = new JSObject();
            event.put("document", document);
            event.put("source", "open-with");
            Log.i(TAG, "Received Android open-with Markdown document: " + safeForLog(document.getString("displayName")));
            notifyListeners(EVENT_OPEN_WITH_DOCUMENT, event, true);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android open-with document rejected: " + ex.getMessage());
            notifyOpenWithRejected(ex.code, ex.getMessage());
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android open-with document no longer exists", ex);
            notifyOpenWithRejected("DOCUMENT_NOT_FOUND", "This Android document was moved or deleted");
        } catch (SecurityException ex) {
            Log.w(TAG, "Android open-with document permission is not available", ex);
            notifyOpenWithRejected("DOCUMENT_PERMISSION_LOST", "Android document permission is no longer available");
        } catch (IOException ex) {
            Log.e(TAG, "Failed to open Android open-with document", ex);
            notifyOpenWithRejected("DOCUMENT_READ_FAILED", "Failed to read Android document");
        }
    }

    @ActivityCallback
    private void createMarkdownDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.w(TAG, "Missing plugin call for Android document create result");
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject canceled = new JSObject();
            canceled.put("canceled", true);
            call.resolve(canceled);
            return;
        }

        String markdown = call.getString("markdown", null);
        if (markdown == null) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        Intent data = result.getData();
        Uri uri = data.getData();
        if (uri == null) {
            call.reject("Android document creator returned no URI", "DOCUMENT_URI_MISSING");
            return;
        }

        try {
            JSObject document = createDocumentResult(uri, data, markdown);
            persistUriPermission(uri, data);
            document.put("persisted", hasPersistedReadPermission(uri));
            document.put("canWrite", canWrite(uri, data));
            Log.i(TAG, "Created Android document: " + safeForLog(document.getString("displayName")));
            call.resolve(document);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document create rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (SecurityException ex) {
            Log.e(TAG, "Missing write permission for created Android document", ex);
            call.reject("Missing write permission for Android document", "DOCUMENT_WRITE_PERMISSION_MISSING", ex);
        } catch (IOException ex) {
            Log.e(TAG, "Failed to create Android document", ex);
            call.reject("Failed to create Android document", "DOCUMENT_WRITE_FAILED", ex);
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
            document.put("canWrite", canWrite(uri, data));
            Log.i(TAG, "Opened Android document: " + safeForLog(document.getString("displayName")));
            call.resolve(document);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android document open rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android document no longer exists", ex);
            call.reject("This Android document was moved or deleted", "DOCUMENT_NOT_FOUND", ex);
        } catch (SecurityException ex) {
            Log.w(TAG, "Android document read permission is no longer available", ex);
            call.reject("Android document permission is no longer available", "DOCUMENT_PERMISSION_LOST", ex);
        } catch (IOException ex) {
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

    private JSObject buildOpenWithDocumentResult(Uri uri, Intent grantIntent) throws IOException, DocumentReadException {
        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri, grantIntent);
        if (!isOpenWithMarkdownCandidate(uri, displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_OPEN_WITH_DOCUMENT",
                "Open a Markdown document"
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

    private JSObject createDocumentResult(Uri uri, Intent grantIntent, String markdown) throws IOException, DocumentReadException {
        byte[] bytes = validateMarkdownBytes(markdown);
        writeText(uri, bytes);

        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri);
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

    private JSObject writeDocumentResult(Uri uri, String markdown) throws IOException, DocumentReadException {
        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri);
        if (!isMarkdownCandidate(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_DOCUMENT",
                "Choose a Markdown or plain text document"
            );
        }

        byte[] bytes = validateMarkdownBytes(markdown);
        writeText(uri, bytes);
        JSObject result = new JSObject();
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        result.put("canWrite", canWrite(uri, null));
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

    private byte[] validateMarkdownBytes(String markdown) throws DocumentReadException {
        byte[] bytes = markdown.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_MARKDOWN_BYTES) {
            throw new DocumentReadException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }
        return bytes;
    }

    private String normalizeSuggestedMarkdownName(String suggestedName) {
        String cleaned = suggestedName == null ? "" : suggestedName.trim();
        cleaned = cleaned.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", " ");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        if (cleaned.length() == 0) {
            cleaned = "Untitled";
        }

        String lowerName = cleaned.toLowerCase(Locale.US);
        if (
            lowerName.endsWith(".md") ||
            lowerName.endsWith(".markdown") ||
            lowerName.endsWith(".mdown") ||
            lowerName.endsWith(".mkdn") ||
            lowerName.endsWith(".mkd")
        ) {
            return cleaned;
        }
        return cleaned + ".md";
    }

    private void persistUriPermission(Uri uri, Intent data) {
        if (data == null) {
            return;
        }

        int grantFlags = data.getFlags() &
            (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (grantFlags == 0) {
            return;
        }

        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, grantFlags);
        } catch (SecurityException ex) {
            Log.w(TAG, "Could not persist Android document URI permission", ex);
        }
    }

    private void writeText(Uri uri, byte[] bytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
            if (output == null) {
                throw new IOException("Content resolver returned no output stream");
            }
            output.write(bytes);
            output.flush();
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

    private String getMimeType(Uri uri, Intent grantIntent) {
        String resolverType = getMimeType(uri);
        String intentType = grantIntent == null ? null : grantIntent.getType();
        String normalizedIntentType = intentType == null ? "" : intentType.toLowerCase(Locale.US);
        if (isMarkdownMimeType(normalizedIntentType)) {
            return normalizedIntentType;
        }

        if (resolverType.length() > 0) {
            return resolverType;
        }

        return normalizedIntentType;
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
        if (hasMarkdownExtension(displayName)) {
            return true;
        }

        return (
            isMarkdownMimeType(mimeType) ||
            "text/plain".equals(mimeType)
        );
    }

    private boolean isOpenWithMarkdownCandidate(Uri uri, String displayName, String mimeType) {
        return (
            hasMarkdownExtension(displayName) ||
            hasMarkdownExtension(uri.getLastPathSegment()) ||
            isMarkdownMimeType(mimeType)
        );
    }

    private boolean hasMarkdownExtension(String value) {
        String lowerName = value == null ? "" : value.toLowerCase(Locale.US);
        return (
            lowerName.endsWith(".md") ||
            lowerName.endsWith(".markdown") ||
            lowerName.endsWith(".mdown") ||
            lowerName.endsWith(".mkdn") ||
            lowerName.endsWith(".mkd")
        );
    }

    private boolean isMarkdownMimeType(String mimeType) {
        return (
            "text/markdown".equals(mimeType) ||
            "text/x-markdown".equals(mimeType) ||
            "text/vnd.daringfireball.markdown".equals(mimeType)
        );
    }

    private boolean hasOnlyAllowedViewCategories(Intent intent) {
        Set<String> categories = intent.getCategories();
        if (categories == null) {
            return true;
        }

        for (String category : categories) {
            if (
                !Intent.CATEGORY_DEFAULT.equals(category) &&
                !Intent.CATEGORY_BROWSABLE.equals(category) &&
                !Intent.CATEGORY_OPENABLE.equals(category)
            ) {
                return false;
            }
        }
        return true;
    }

    private void notifyOpenWithRejected(String code, String message) {
        JSObject event = new JSObject();
        event.put("source", "open-with");
        event.put("errorCode", code);
        event.put("message", message);
        notifyListeners(EVENT_OPEN_WITH_DOCUMENT, event, true);
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
