package io.github.renakoni.marktextandroid;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AndroidDocuments")
public class AndroidDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final int MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;
    private static final int MAX_IMAGE_BYTES = 15 * 1024 * 1024;
    private static final String CALLBACK_OPEN_MARKDOWN_DOCUMENT = "openMarkdownDocumentResult";
    private static final String CALLBACK_CREATE_MARKDOWN_DOCUMENT = "createMarkdownDocumentResult";
    private static final String CALLBACK_PICK_IMAGE_DOCUMENT = "pickImageDocumentResult";
    private static final String EVENT_OPEN_WITH_DOCUMENT = "openWithDocument";
    private static final String EVENT_SHARE_DOCUMENT = "shareDocument";
    private static final String IMPORTED_IMAGE_DIRECTORY = "images";
    private static final String SHARE_CACHE_DIRECTORY = "shared-markdown";
    private static final byte[] UTF8_BOM = new byte[] { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
    private static final byte[] UTF16BE_BOM = new byte[] { (byte) 0xFE, (byte) 0xFF };
    private static final byte[] UTF16LE_BOM = new byte[] { (byte) 0xFF, (byte) 0xFE };
    private static final byte[] UTF32BE_BOM = new byte[] { 0x00, 0x00, (byte) 0xFE, (byte) 0xFF };
    private static final byte[] UTF32LE_BOM = new byte[] { (byte) 0xFF, (byte) 0xFE, 0x00, 0x00 };
    private static final Pattern MARKTEXT_IMAGE_SOURCE_PATTERN = Pattern.compile(
        "marktext-image://local/([^\\s)]+)",
        Pattern.CASE_INSENSITIVE
    );
    private String lastHandledIncomingIntentId = "";
    private String defaultMarkdownEncoding = "utf8";
    private boolean autoDetectMarkdownEncoding = true;

    @Override
    public void load() {
        super.load();
        Activity activity = getActivity();
        if (activity != null) {
            handleIncomingIntent(activity.getIntent());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleIncomingIntent(intent);
    }

    @PluginMethod
    public void configureMarkdownSettings(PluginCall call) {
        applyMarkdownSettingsFromCall(call);
        JSObject result = new JSObject();
        result.put("defaultEncoding", defaultMarkdownEncoding);
        result.put("autoDetectEncoding", autoDetectMarkdownEncoding);
        call.resolve(result);
    }

    @PluginMethod
    public void openMarkdownDocument(PluginCall call) {
        applyMarkdownSettingsFromCall(call);
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

        MarkdownWriteOptions writeOptions = getMarkdownWriteOptions(call);
        try {
            validateMarkdownBytes(markdown, writeOptions);
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
    public void shareMarkdownDocument(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No Android activity is available for sharing", "SHARE_TARGET_UNAVAILABLE");
            return;
        }

        String markdown = call.getString("markdown", null);
        if (markdown == null) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        String suggestedName = normalizeSuggestedMarkdownName(call.getString("suggestedName", ""));
        boolean attachImages = call.getBoolean("attachImages", true);
        MarkdownWriteOptions writeOptions = getMarkdownWriteOptions(call);
        ShareMarkdownPayload sharePayload = attachImages
            ? buildShareMarkdownPayload(markdown)
            : new ShareMarkdownPayload(markdown, new LinkedHashMap<>());
        byte[] bytes;
        try {
            bytes = validateMarkdownBytes(sharePayload.markdown, writeOptions);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
            return;
        }

        try {
            File shareDirectory = getShareCacheDirectory();
            Uri markdownUri = writeShareCacheFile(shareDirectory, suggestedName, bytes);
            ArrayList<Uri> streamUris = new ArrayList<>();
            streamUris.add(markdownUri);

            for (Map.Entry<String, File> imageEntry : sharePayload.images.entrySet()) {
                File sharedImage = copyShareImageFile(shareDirectory, imageEntry.getKey(), imageEntry.getValue());
                streamUris.add(
                    FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        sharedImage
                    )
                );
            }

            boolean sharesImages = streamUris.size() > 1;
            Intent shareIntent = new Intent(sharesImages ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
            shareIntent.setType(sharesImages ? "*/*" : "text/markdown");
            if (sharesImages) {
                shareIntent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, streamUris);
            } else {
                shareIntent.putExtra(Intent.EXTRA_STREAM, markdownUri);
            }
            shareIntent.putExtra(Intent.EXTRA_TITLE, suggestedName);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, suggestedName);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.setClipData(buildShareClipData(suggestedName, streamUris));

            Intent chooser = Intent.createChooser(shareIntent, "Share Markdown");
            chooser.putExtra(
                Intent.EXTRA_EXCLUDE_COMPONENTS,
                new ComponentName[] { new ComponentName(getContext(), MainActivity.class) }
            );
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(chooser);

            JSObject result = new JSObject();
            result.put("displayName", suggestedName);
            result.put("mimeType", "text/markdown");
            result.put("bytes", bytes.length);
            result.put("imageCount", sharePayload.images.size());
            result.put("sharedFileCount", streamUris.size());
            Log.i(
                TAG,
                "Opened Android share sheet for Markdown document: " +
                safeForLog(suggestedName) +
                ", images=" +
                sharePayload.images.size()
            );
            call.resolve(result);
        } catch (ActivityNotFoundException ex) {
            Log.w(TAG, "No Android share target is available", ex);
            call.reject("No Android share target is available", "SHARE_TARGET_UNAVAILABLE", ex);
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to prepare Markdown document for sharing", ex);
            call.reject("Could not prepare Markdown document for sharing", "SHARE_WRITE_FAILED", ex);
        }
    }

    @PluginMethod
    public void shareMarkdownDocuments(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No Android activity is available for sharing", "SHARE_TARGET_UNAVAILABLE");
            return;
        }

        JSArray documents = call.getArray("documents");
        if (documents == null || documents.length() == 0) {
            call.reject("Markdown content is required", "INVALID_MARKDOWN");
            return;
        }

        MarkdownWriteOptions writeOptions = getMarkdownWriteOptions(call);
        try {
            File shareDirectory = getShareCacheDirectory();
            ArrayList<Uri> streamUris = new ArrayList<>();
            Set<String> usedNames = new java.util.HashSet<>();
            long totalBytes = 0;
            String firstName = null;

            for (int index = 0; index < documents.length(); index++) {
                org.json.JSONObject document = documents.getJSONObject(index);
                String markdown = document.optString("markdown", null);
                if (markdown == null) {
                    call.reject("Markdown content is required", "INVALID_MARKDOWN");
                    return;
                }

                byte[] bytes = validateMarkdownBytes(markdown, writeOptions);
                String fileName = uniqueShareFileName(
                    normalizeSuggestedMarkdownName(document.optString("suggestedName", "")),
                    usedNames
                );
                if (firstName == null) {
                    firstName = fileName;
                }

                streamUris.add(writeShareCacheFile(shareDirectory, fileName, bytes));
                totalBytes += bytes.length;
            }

            boolean sharesMultiple = streamUris.size() > 1;
            Intent shareIntent = new Intent(sharesMultiple ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
            shareIntent.setType("text/markdown");
            if (sharesMultiple) {
                shareIntent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, streamUris);
            } else {
                shareIntent.putExtra(Intent.EXTRA_STREAM, streamUris.get(0));
            }
            shareIntent.putExtra(Intent.EXTRA_TITLE, firstName);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, firstName);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.setClipData(buildShareClipData(firstName, streamUris));

            Intent chooser = Intent.createChooser(shareIntent, "Share Markdown");
            chooser.putExtra(
                Intent.EXTRA_EXCLUDE_COMPONENTS,
                new ComponentName[] { new ComponentName(getContext(), MainActivity.class) }
            );
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(chooser);

            JSObject result = new JSObject();
            result.put("displayName", firstName);
            result.put("mimeType", "text/markdown");
            result.put("bytes", totalBytes);
            result.put("imageCount", 0);
            result.put("sharedFileCount", streamUris.size());
            Log.i(TAG, "Opened Android share sheet for " + streamUris.size() + " Markdown documents");
            call.resolve(result);
        } catch (org.json.JSONException ex) {
            Log.w(TAG, "Android multi-share received malformed documents", ex);
            call.reject("Markdown content is required", "INVALID_MARKDOWN", ex);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android multi-share rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (ActivityNotFoundException ex) {
            Log.w(TAG, "No Android share target is available", ex);
            call.reject("No Android share target is available", "SHARE_TARGET_UNAVAILABLE", ex);
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to prepare Markdown documents for sharing", ex);
            call.reject("Could not prepare Markdown documents for sharing", "SHARE_WRITE_FAILED", ex);
        }
    }

    @PluginMethod
    public void renameMarkdownDocument(PluginCall call) {
        String sourceUri = call.getString("sourceUri", "");
        Uri uri = parseContentUri(sourceUri);
        if (uri == null) {
            call.reject("A valid content URI is required", "INVALID_SOURCE_URI");
            return;
        }

        String rawName = call.getString("newName", "");
        if (rawName == null || rawName.trim().length() == 0) {
            call.reject("A document name is required", "INVALID_DOCUMENT_NAME");
            return;
        }
        String newName = normalizeSuggestedMarkdownName(rawName);

        try {
            if (!DocumentsContract.isDocumentUri(getContext(), uri)) {
                call.reject(
                    "This Android document cannot be renamed",
                    "DOCUMENT_RENAME_UNSUPPORTED"
                );
                return;
            }

            int flags = getDocumentFlags(uri);
            if ((flags & DocumentsContract.Document.FLAG_SUPPORTS_RENAME) == 0) {
                call.reject(
                    "This Android storage provider does not support renaming",
                    "DOCUMENT_RENAME_UNSUPPORTED"
                );
                return;
            }

            Uri renamedUri = DocumentsContract.renameDocument(
                getContext().getContentResolver(),
                uri,
                newName
            );
            if (renamedUri == null) {
                call.reject("Could not rename this Android document", "DOCUMENT_RENAME_FAILED");
                return;
            }

            // Renaming can change the document URI; the provider migrates the
            // runtime grant but revokes the old persisted one, so re-persist
            // when possible and report the real state.
            try {
                getContext()
                    .getContentResolver()
                    .takePersistableUriPermission(
                        renamedUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    );
            } catch (SecurityException ignored) {
                // The migrated grant is not persistable on most providers.
            }

            String displayName = getDisplayName(renamedUri);
            JSObject result = new JSObject();
            result.put("sourceUri", renamedUri.toString());
            result.put("displayName", displayName);
            result.put("providerName", getProviderName(renamedUri));
            result.put("pathHint", displayName);
            result.put("canWrite", canWrite(renamedUri, null));
            result.put("persisted", hasPersistedReadPermission(renamedUri));
            Log.i(TAG, "Renamed Android document to: " + safeForLog(displayName));
            call.resolve(result);
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android document no longer exists", ex);
            call.reject("This Android document was moved or deleted", "DOCUMENT_NOT_FOUND", ex);
        } catch (SecurityException ex) {
            Log.w(TAG, "Android document rename permission is no longer available", ex);
            call.reject("Android document permission is no longer available", "DOCUMENT_PERMISSION_LOST", ex);
        } catch (UnsupportedOperationException ex) {
            Log.w(TAG, "Android storage provider does not support renaming", ex);
            call.reject(
                "This Android storage provider does not support renaming",
                "DOCUMENT_RENAME_UNSUPPORTED",
                ex
            );
        } catch (RuntimeException ex) {
            // Storage providers surface arbitrary runtime failures through
            // ContentResolver.call; keep them as a rename failure instead of
            // crashing the WebView bridge.
            Log.e(TAG, "Failed to rename Android document", ex);
            call.reject("Could not rename this Android document", "DOCUMENT_RENAME_FAILED", ex);
        }
    }

    @PluginMethod
    public void getImportedImageDirectory(PluginCall call) {
        JSObject result = new JSObject();
        result.put("fileUri", getFileUri(getImportedImageDirectoryFile()));
        call.resolve(result);
    }

    @PluginMethod
    public void pickImageDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "image/svg+xml"
            }
        );
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        try {
            startActivityForResult(call, intent, CALLBACK_PICK_IMAGE_DOCUMENT);
        } catch (ActivityNotFoundException ex) {
            Log.e(TAG, "No Android image picker is available", ex);
            call.reject("No Android image picker is available", "IMAGE_PICKER_UNAVAILABLE", ex);
        }
    }

    @PluginMethod
    public void readMarkdownDocument(PluginCall call) {
        applyMarkdownSettingsFromCall(call);
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
            JSObject result = writeDocumentResult(uri, markdown, getMarkdownWriteOptions(call));
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

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();
        if (
            !Intent.ACTION_VIEW.equals(action) &&
            !Intent.ACTION_SEND.equals(action) &&
            !Intent.ACTION_SEND_MULTIPLE.equals(action)
        ) {
            return;
        }

        if (!markIncomingIntentForHandling(intent)) {
            return;
        }

        if (Intent.ACTION_VIEW.equals(action)) {
            handleOpenWithIntent(intent);
            return;
        }

        if (Intent.ACTION_SEND.equals(action)) {
            handleShareIntent(intent);
            return;
        }

        if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            Log.w(TAG, "Rejected Android multi-share intent");
            notifyShareRejected("UNSUPPORTED_SHARE_DOCUMENT", "Share one Markdown file at a time");
        }
    }

    private boolean markIncomingIntentForHandling(Intent intent) {
        String intentId = intent.getAction() + ":" + System.identityHashCode(intent);
        if (intentId.equals(lastHandledIncomingIntentId)) {
            Log.d(TAG, "Ignored duplicate Android incoming intent: " + safeForLog(intent.getAction()));
            return false;
        }

        lastHandledIncomingIntentId = intentId;
        return true;
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

    private void handleShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        if (!hasOnlyAllowedShareCategories(intent)) {
            Log.w(TAG, "Rejected Android share intent with unsupported categories");
            notifyShareRejected("INVALID_SHARE_INTENT", "This Android share request is not supported");
            return;
        }

        Uri streamUri;
        try {
            streamUri = getSharedStreamUri(intent);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share stream extra rejected: " + ex.getMessage());
            notifyShareRejected(ex.code, ex.getMessage());
            return;
        }

        if (streamUri != null) {
            handleSharedStream(streamUri, intent);
            return;
        }

        CharSequence sharedText;
        try {
            sharedText = getSharedText(intent);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share text extra rejected: " + ex.getMessage());
            notifyShareRejected(ex.code, ex.getMessage());
            return;
        }

        if (sharedText != null && sharedText.length() > 0) {
            handleSharedText(sharedText.toString(), intent);
            return;
        }

        notifyShareRejected("SHARE_CONTENT_MISSING", "This Android share did not include Markdown content");
    }

    private void handleSharedStream(Uri uri, Intent intent) {
        if (!"content".equals(uri.getScheme())) {
            Log.w(TAG, "Rejected Android shared URI with unsupported scheme: " + safeForLog(uri.getScheme()));
            notifyShareRejected(
                "INVALID_SHARE_SOURCE_URI",
                "This Android share did not provide a supported file URI"
            );
            return;
        }

        try {
            JSObject document = buildSharedStreamDocumentResult(uri, intent);
            if ((intent.getFlags() & Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION) != 0) {
                persistUriPermission(uri, intent);
            }
            document.put("persisted", hasPersistedReadPermission(uri));
            document.put("canWrite", canWrite(uri, intent));
            JSObject event = new JSObject();
            event.put("document", document);
            event.put("source", "share");
            Log.i(TAG, "Received Android shared Markdown file: " + safeForLog(document.getString("displayName")));
            notifyListeners(EVENT_SHARE_DOCUMENT, event, true);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android shared document rejected: " + ex.getMessage());
            notifyShareRejected(ex.code, ex.getMessage());
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android shared document no longer exists", ex);
            notifyShareRejected("DOCUMENT_NOT_FOUND", "This Android document was moved or deleted");
        } catch (SecurityException ex) {
            Log.w(TAG, "Android shared document permission is not available", ex);
            notifyShareRejected("DOCUMENT_PERMISSION_LOST", "Android document permission is no longer available");
        } catch (IOException ex) {
            Log.e(TAG, "Failed to open Android shared document", ex);
            notifyShareRejected("DOCUMENT_READ_FAILED", "Failed to read Android document");
        }
    }

    private void handleSharedText(String markdown, Intent intent) {
        String mimeType = normalizeMimeType(intent.getType());
        if (!isSharedTextMimeType(mimeType)) {
            Log.w(TAG, "Rejected Android shared text with unsupported MIME type: " + safeForLog(mimeType));
            notifyShareRejected("UNSUPPORTED_SHARE_DOCUMENT", "Share Markdown text or a Markdown file");
            return;
        }

        try {
            validateMarkdownBytes(markdown);
            String displayName = getSharedTextDisplayName(intent);
            JSObject document = new JSObject();
            document.put("canceled", false);
            document.put("sourceUri", JSObject.NULL);
            document.put("displayName", displayName);
            document.put("providerName", "Android share");
            document.put("pathHint", displayName);
            document.put("mimeType", mimeType.length() > 0 ? mimeType : "text/plain");
            document.put("markdown", markdown);
            putMarkdownEncodingMetadata(document, defaultMarkdownEncoding, false);
            document.put("canWrite", false);
            document.put("persisted", false);
            document.put("shareKind", "text");

            JSObject event = new JSObject();
            event.put("document", document);
            event.put("source", "share");
            Log.i(TAG, "Received Android shared Markdown text: " + safeForLog(displayName));
            notifyListeners(EVENT_SHARE_DOCUMENT, event, true);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android shared text rejected: " + ex.getMessage());
            notifyShareRejected(ex.code, ex.getMessage());
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
            JSObject document = createDocumentResult(uri, data, markdown, getMarkdownWriteOptions(call));
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

    @ActivityCallback
    private void pickImageDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.w(TAG, "Missing plugin call for Android image picker result");
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
            call.reject("Android image picker returned no URI", "IMAGE_URI_MISSING");
            return;
        }

        try {
            boolean copyImage = call.getBoolean("copyImage", true);
            JSObject image = copyImage ? importImageResult(uri, data) : linkedImageResult(uri, data);
            Log.i(TAG, "Imported Android image: " + safeForLog(image.getString("displayName")));
            call.resolve(image);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android image import rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
        } catch (FileNotFoundException ex) {
            Log.w(TAG, "Android image no longer exists", ex);
            call.reject("This Android image was moved or deleted", "IMAGE_NOT_FOUND", ex);
        } catch (SecurityException ex) {
            Log.w(TAG, "Android image read permission is no longer available", ex);
            call.reject("Android image permission is no longer available", "IMAGE_PERMISSION_LOST", ex);
        } catch (IOException ex) {
            Log.e(TAG, "Failed to import Android image", ex);
            call.reject("Failed to import Android image", "IMAGE_IMPORT_FAILED", ex);
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

        DecodedMarkdown decoded = readText(uri);
        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        result.put("markdown", decoded.markdown);
        putMarkdownEncodingMetadata(result, decoded);
        result.put("canWrite", canWrite(uri, grantIntent));
        result.put("persisted", hasPersistedReadPermission(uri));
        return result;
    }

    private JSObject importImageResult(Uri uri, Intent grantIntent) throws IOException, DocumentReadException {
        String mimeType = getMimeType(uri, grantIntent);
        String displayName = normalizeImageDisplayName(getDisplayName(uri), mimeType);
        if (!isSupportedImage(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_IMAGE",
                "Choose a JPEG, PNG, GIF, WebP, or SVG image"
            );
        }

        File outputDirectory = getImportedImageDirectoryFile();
        if (!outputDirectory.exists() && !outputDirectory.mkdirs()) {
            throw new IOException("Could not create image import directory");
        }

        File outputFile = new File(outputDirectory, createStoredImageName(displayName, mimeType));
        int bytes = copyImage(uri, outputFile);
        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("mimeType", mimeType);
        result.put("markdownSrc", "marktext-image://local/" + Uri.encode(outputFile.getName()));
        result.put("fileUri", getFileUri(outputFile));
        result.put("bytes", bytes);
        return result;
    }

    private JSObject linkedImageResult(Uri uri, Intent grantIntent) throws IOException, DocumentReadException {
        String mimeType = getMimeType(uri, grantIntent);
        String displayName = normalizeImageDisplayName(getDisplayName(uri), mimeType);
        if (!isSupportedImage(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_IMAGE",
                "Choose a JPEG, PNG, GIF, WebP, or SVG image"
            );
        }

        persistUriPermission(uri, grantIntent);

        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("mimeType", mimeType);
        result.put("markdownSrc", "marktext-image://android/" + Uri.encode(uri.toString()));
        result.put("fileUri", uri.toString());
        result.put("bytes", 0);
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

        DecodedMarkdown decoded = readText(uri);
        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        result.put("markdown", decoded.markdown);
        putMarkdownEncodingMetadata(result, decoded);
        result.put("canWrite", canWrite(uri, grantIntent));
        result.put("persisted", hasPersistedReadPermission(uri));
        return result;
    }

    private JSObject buildSharedStreamDocumentResult(Uri uri, Intent grantIntent) throws IOException, DocumentReadException {
        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri, grantIntent);
        if (!isSharedStreamMarkdownCandidate(uri, displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_SHARE_DOCUMENT",
                "Share a Markdown file"
            );
        }

        DecodedMarkdown decoded = readText(uri);
        JSObject result = new JSObject();
        result.put("canceled", false);
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        result.put("markdown", decoded.markdown);
        putMarkdownEncodingMetadata(result, decoded);
        result.put("canWrite", canWrite(uri, grantIntent));
        result.put("persisted", hasPersistedReadPermission(uri));
        result.put("shareKind", "stream");
        return result;
    }

    private JSObject createDocumentResult(
        Uri uri,
        Intent grantIntent,
        String markdown,
        MarkdownWriteOptions writeOptions
    ) throws IOException, DocumentReadException {
        byte[] bytes = validateMarkdownBytes(markdown, writeOptions);
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
        putMarkdownEncodingMetadata(result, writeOptions.encoding, writeOptions.writeBom);
        result.put("canWrite", canWrite(uri, grantIntent));
        result.put("persisted", hasPersistedReadPermission(uri));
        return result;
    }

    private JSObject writeDocumentResult(
        Uri uri,
        String markdown,
        MarkdownWriteOptions writeOptions
    ) throws IOException, DocumentReadException {
        String displayName = getDisplayName(uri);
        String mimeType = getMimeType(uri);
        if (!isMarkdownCandidate(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_DOCUMENT",
                "Choose a Markdown or plain text document"
            );
        }

        byte[] bytes = validateMarkdownBytes(markdown, writeOptions);
        writeText(uri, bytes);
        JSObject result = new JSObject();
        result.put("sourceUri", uri.toString());
        result.put("displayName", displayName);
        result.put("providerName", getProviderName(uri));
        result.put("pathHint", displayName);
        result.put("mimeType", mimeType);
        putMarkdownEncodingMetadata(result, writeOptions.encoding, writeOptions.writeBom);
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
        return validateMarkdownBytes(markdown, new MarkdownWriteOptions("utf8", false));
    }

    private byte[] validateMarkdownBytes(String markdown, MarkdownWriteOptions writeOptions) throws DocumentReadException {
        byte[] bytes = encodeMarkdown(markdown, writeOptions);
        if (bytes.length > MAX_MARKDOWN_BYTES) {
            throw new DocumentReadException(
                "DOCUMENT_TOO_LARGE",
                "Markdown document is larger than the current 5 MB limit"
            );
        }
        return bytes;
    }

    private byte[] encodeMarkdown(String markdown, MarkdownWriteOptions writeOptions) throws DocumentReadException {
        Charset charset = getMarkdownCharset(writeOptions.encoding);
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

        byte[] bom = getEncodingBom(writeOptions);
        if (bom.length == 0) {
            return body;
        }

        byte[] bytes = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, bytes, 0, bom.length);
        System.arraycopy(body, 0, bytes, bom.length, body.length);
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

    private ShareMarkdownPayload buildShareMarkdownPayload(String markdown) {
        Map<String, File> images = new LinkedHashMap<>();
        Matcher matcher = MARKTEXT_IMAGE_SOURCE_PATTERN.matcher(markdown);
        StringBuffer rewrittenMarkdown = new StringBuffer();

        while (matcher.find()) {
            String fileName = normalizeImportedImageFileName(Uri.decode(matcher.group(1)));
            if (fileName.length() == 0) {
                continue;
            }

            File importedImage = new File(getImportedImageDirectoryFile(), fileName);
            if (!isFileInDirectory(importedImage, getImportedImageDirectoryFile()) || !importedImage.isFile()) {
                Log.w(TAG, "Skipping missing Android image during share: " + safeForLog(fileName));
                continue;
            }

            images.put(fileName, importedImage);
            matcher.appendReplacement(rewrittenMarkdown, Matcher.quoteReplacement(fileName));
        }
        // TODO: Add linked Android image attachments when the linked images setting is wired.
        matcher.appendTail(rewrittenMarkdown);

        return new ShareMarkdownPayload(rewrittenMarkdown.toString(), images);
    }

    private ClipData buildShareClipData(String suggestedName, ArrayList<Uri> streamUris) {
        ClipData clipData = ClipData.newUri(getContext().getContentResolver(), suggestedName, streamUris.get(0));
        for (int index = 1; index < streamUris.size(); index++) {
            clipData.addItem(new ClipData.Item(streamUris.get(index)));
        }
        return clipData;
    }

    private String uniqueShareFileName(String fileName, Set<String> usedNames) {
        if (usedNames.add(fileName.toLowerCase(Locale.US))) {
            return fileName;
        }

        int extensionIndex = fileName.lastIndexOf('.');
        String baseName = extensionIndex > 0 ? fileName.substring(0, extensionIndex) : fileName;
        String extension = extensionIndex > 0 ? fileName.substring(extensionIndex) : "";
        for (int counter = 2; ; counter++) {
            String candidate = baseName + " " + counter + extension;
            if (usedNames.add(candidate.toLowerCase(Locale.US))) {
                return candidate;
            }
        }
    }

    private int getDocumentFlags(Uri uri) {
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(uri, new String[] { DocumentsContract.Document.COLUMN_FLAGS }, null, null, null)
        ) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                return cursor.getInt(0);
            }
        }
        return 0;
    }

    private File getShareCacheDirectory() throws IOException {
        File directory = new File(getContext().getCacheDir(), SHARE_CACHE_DIRECTORY);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create share cache directory");
        }
        return directory;
    }

    private Uri writeShareCacheFile(File directory, String displayName, byte[] bytes) throws IOException {
        File outputFile = new File(directory, normalizeSuggestedMarkdownName(displayName));
        if (!isFileInDirectory(outputFile, directory)) {
            throw new SecurityException("Share cache path escaped the expected directory");
        }

        try (OutputStream output = new FileOutputStream(outputFile, false)) {
            output.write(bytes);
            output.flush();
        }

        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            outputFile
        );
    }

    private File copyShareImageFile(File directory, String displayName, File sourceFile) throws IOException {
        String normalizedName = normalizeImportedImageFileName(displayName);
        if (normalizedName.length() == 0) {
            throw new SecurityException("Invalid shared image file name");
        }

        File outputFile = new File(directory, normalizedName);
        if (!isFileInDirectory(outputFile, directory)) {
            throw new SecurityException("Shared image path escaped the expected directory");
        }

        try (
            InputStream input = new java.io.FileInputStream(sourceFile);
            OutputStream output = new FileOutputStream(outputFile, false)
        ) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.flush();
        }

        return outputFile;
    }

    private boolean isFileInDirectory(File file, File directory) {
        try {
            String directoryPath = directory.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            return filePath.startsWith(directoryPath + File.separator);
        } catch (IOException ex) {
            Log.w(TAG, "Could not validate file path", ex);
            return false;
        }
    }

    private File getImportedImageDirectoryFile() {
        return new File(getContext().getFilesDir(), IMPORTED_IMAGE_DIRECTORY);
    }

    private String getFileUri(File file) {
        return "file://" + file.getAbsolutePath();
    }

    private int copyImage(Uri uri, File outputFile) throws IOException, DocumentReadException {
        ContentResolver resolver = getContext().getContentResolver();
        boolean copied = false;
        try {
            try (
                InputStream input = resolver.openInputStream(uri);
                OutputStream output = new FileOutputStream(outputFile)
            ) {
                if (input == null) {
                    throw new IOException("Content resolver returned no image stream");
                }

                byte[] buffer = new byte[8192];
                int totalBytes = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    totalBytes += read;
                    if (totalBytes > MAX_IMAGE_BYTES) {
                        throw new DocumentReadException(
                            "IMAGE_TOO_LARGE",
                            "Image is larger than the current 15 MB limit"
                        );
                    }
                    output.write(buffer, 0, read);
                }
                output.flush();
                copied = true;
                return totalBytes;
            }
        } finally {
            if (!copied && outputFile.exists() && !outputFile.delete()) {
                Log.w(TAG, "Could not delete incomplete imported image: " + safeForLog(outputFile.getName()));
            }
        }
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

    private DecodedMarkdown readText(Uri uri) throws IOException, DocumentReadException {
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
            return decodeMarkdown(output.toByteArray());
        }
    }

    private DecodedMarkdown decodeMarkdown(byte[] bytes) throws DocumentReadException {
        MarkdownBom bom = detectMarkdownBom(bytes);
        boolean useBom = bom.hasBom && (
            autoDetectMarkdownEncoding ||
            normalizeMarkdownEncoding(defaultMarkdownEncoding).equals(bom.encoding)
        );
        String encoding = useBom ? bom.encoding : normalizeMarkdownEncoding(defaultMarkdownEncoding);
        int offset = useBom ? bom.offset : 0;
        Charset charset = getMarkdownCharset(encoding);

        try {
            String markdown = charset
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset))
                .toString();
            // TODO: Add full non-BOM charset detection for Advanced > Encoding.
            return new DecodedMarkdown(markdown, encoding, useBom);
        } catch (CharacterCodingException | IndexOutOfBoundsException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_FAILED",
                "Could not decode Markdown with the selected encoding"
            );
        }
    }

    private void applyMarkdownSettingsFromCall(PluginCall call) {
        defaultMarkdownEncoding = normalizeMarkdownEncoding(call.getString("defaultEncoding", defaultMarkdownEncoding));
        autoDetectMarkdownEncoding = call.getBoolean("autoDetectEncoding", autoDetectMarkdownEncoding);
    }

    private MarkdownWriteOptions getMarkdownWriteOptions(PluginCall call) {
        String encoding = normalizeMarkdownEncoding(call.getString("encoding", defaultMarkdownEncoding));
        boolean writeBom = call.getBoolean("writeBom", false);
        return new MarkdownWriteOptions(encoding, writeBom);
    }

    private String normalizeMarkdownEncoding(String encoding) {
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

    private Charset getMarkdownCharset(String encoding) throws DocumentReadException {
        try {
            return Charset.forName(getMarkdownCharsetName(encoding));
        } catch (IllegalArgumentException ex) {
            throw new DocumentReadException(
                "DOCUMENT_ENCODING_UNSUPPORTED",
                "Selected Markdown encoding is not supported on this device"
            );
        }
    }

    private String getMarkdownCharsetName(String encoding) {
        switch (normalizeMarkdownEncoding(encoding)) {
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

    private byte[] getEncodingBom(MarkdownWriteOptions writeOptions) {
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

    private MarkdownBom detectMarkdownBom(byte[] bytes) {
        if (startsWith(bytes, UTF8_BOM)) {
            return new MarkdownBom("utf8", UTF8_BOM.length, true);
        }
        if (startsWith(bytes, UTF32BE_BOM)) {
            return new MarkdownBom("utf32be", UTF32BE_BOM.length, true);
        }
        if (startsWith(bytes, UTF32LE_BOM)) {
            return new MarkdownBom("utf32le", UTF32LE_BOM.length, true);
        }
        if (startsWith(bytes, UTF16BE_BOM)) {
            return new MarkdownBom("utf16be", UTF16BE_BOM.length, true);
        }
        if (startsWith(bytes, UTF16LE_BOM)) {
            return new MarkdownBom("utf16le", UTF16LE_BOM.length, true);
        }
        return new MarkdownBom(defaultMarkdownEncoding, 0, false);
    }

    private boolean startsWith(byte[] bytes, byte[] prefix) {
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

    private void putMarkdownEncodingMetadata(JSObject result, DecodedMarkdown decoded) {
        putMarkdownEncodingMetadata(result, decoded.encoding, decoded.hasBom);
    }

    private void putMarkdownEncodingMetadata(JSObject result, String encoding, boolean hasBom) {
        result.put("encoding", normalizeMarkdownEncoding(encoding));
        result.put("hasEncodingBom", hasBom);
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
        String normalizedIntentType = normalizeMimeType(intentType);
        if (isMarkdownMimeType(normalizedIntentType)) {
            return normalizedIntentType;
        }

        if (resolverType.length() > 0) {
            return resolverType;
        }

        return normalizedIntentType;
    }

    private String normalizeMimeType(String mimeType) {
        return mimeType == null ? "" : mimeType.toLowerCase(Locale.US);
    }

    private String getSharedTextDisplayName(Intent intent) {
        CharSequence titleValue = getOptionalCharSequenceExtra(intent, Intent.EXTRA_TITLE);
        String title = titleValue == null ? "" : titleValue.toString();
        CharSequence subjectValue = getOptionalCharSequenceExtra(intent, Intent.EXTRA_SUBJECT);
        if (title.trim().length() == 0 && subjectValue != null) {
            title = subjectValue.toString();
        }
        if (title == null || title.trim().length() == 0) {
            title = "Shared Markdown";
        }
        return normalizeSuggestedMarkdownName(title);
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

    private boolean isSharedStreamMarkdownCandidate(Uri uri, String displayName, String mimeType) {
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

    private boolean isSupportedImage(String displayName, String mimeType) {
        if (isSupportedImageMimeType(mimeType)) {
            return true;
        }

        return (
            mimeType.length() == 0 ||
            "application/octet-stream".equals(mimeType)
        ) && hasSupportedImageExtension(displayName);
    }

    private boolean isSupportedImageMimeType(String mimeType) {
        return (
            "image/*".equals(mimeType) ||
            "image/jpeg".equals(mimeType) ||
            "image/png".equals(mimeType) ||
            "image/gif".equals(mimeType) ||
            "image/webp".equals(mimeType) ||
            "image/svg+xml".equals(mimeType)
        );
    }

    private boolean hasSupportedImageExtension(String value) {
        String lowerName = value == null ? "" : value.toLowerCase(Locale.US);
        return (
            lowerName.endsWith(".jpg") ||
            lowerName.endsWith(".jpeg") ||
            lowerName.endsWith(".png") ||
            lowerName.endsWith(".gif") ||
            lowerName.endsWith(".webp") ||
            lowerName.endsWith(".svg")
        );
    }

    private String normalizeImageDisplayName(String displayName, String mimeType) {
        String cleaned = displayName == null ? "" : displayName.trim();
        cleaned = cleaned.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", " ");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        if (cleaned.length() == 0) {
            cleaned = "Image";
        }

        if (hasSupportedImageExtension(cleaned)) {
            return cleaned;
        }
        return cleaned + extensionForImageMimeType(mimeType);
    }

    private String createStoredImageName(String displayName, String mimeType) {
        String normalized = normalizeImageDisplayName(displayName, mimeType);
        String extension = extensionFromImageName(normalized);
        String baseName = extension.length() == 0
            ? normalized
            : normalized.substring(0, normalized.length() - extension.length());
        baseName = baseName.replaceAll("[^A-Za-z0-9._-]+", "-");
        baseName = baseName.replaceAll("-+", "-").replaceAll("^-|-$", "");
        if (baseName.length() == 0) {
            baseName = "image";
        }
        if (baseName.length() > 48) {
            baseName = baseName.substring(0, 48);
        }

        String unique = UUID.randomUUID().toString().substring(0, 8);
        return System.currentTimeMillis() + "-" + unique + "-" + baseName + extension;
    }

    private String normalizeImportedImageFileName(String fileName) {
        String normalized = fileName == null ? "" : fileName.trim();
        if (
            normalized.length() == 0 ||
            normalized.contains("/") ||
            normalized.contains("\\") ||
            !hasSupportedImageExtension(normalized)
        ) {
            return "";
        }
        return normalized;
    }

    private String extensionFromImageName(String displayName) {
        String lowerName = displayName == null ? "" : displayName.toLowerCase(Locale.US);
        if (lowerName.endsWith(".jpeg")) {
            return ".jpeg";
        }
        if (lowerName.endsWith(".jpg")) {
            return ".jpg";
        }
        if (lowerName.endsWith(".png")) {
            return ".png";
        }
        if (lowerName.endsWith(".gif")) {
            return ".gif";
        }
        if (lowerName.endsWith(".webp")) {
            return ".webp";
        }
        if (lowerName.endsWith(".svg")) {
            return ".svg";
        }
        return "";
    }

    private String extensionForImageMimeType(String mimeType) {
        if ("image/jpeg".equals(mimeType)) {
            return ".jpg";
        }
        if ("image/gif".equals(mimeType)) {
            return ".gif";
        }
        if ("image/webp".equals(mimeType)) {
            return ".webp";
        }
        if ("image/svg+xml".equals(mimeType)) {
            return ".svg";
        }
        return ".png";
    }

    private boolean isMarkdownMimeType(String mimeType) {
        return (
            "text/markdown".equals(mimeType) ||
            "text/x-markdown".equals(mimeType) ||
            "text/vnd.daringfireball.markdown".equals(mimeType)
        );
    }

    private boolean isSharedTextMimeType(String mimeType) {
        return (
            mimeType.length() == 0 ||
            "text/plain".equals(mimeType) ||
            mimeType.startsWith("text/") ||
            isMarkdownMimeType(mimeType)
        );
    }

    @SuppressWarnings("deprecation")
    private CharSequence getSharedText(Intent intent) throws DocumentReadException {
        try {
            return intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        } catch (RuntimeException ex) {
            throw new DocumentReadException(
                "INVALID_SHARE_INTENT",
                "This Android share request is not supported"
            );
        }
    }

    private CharSequence getOptionalCharSequenceExtra(Intent intent, String key) {
        try {
            return intent.getCharSequenceExtra(key);
        } catch (RuntimeException ex) {
            Log.w(TAG, "Ignored malformed Android share text metadata: " + safeForLog(key));
            return null;
        }
    }

    private Uri getSharedStreamUri(Intent intent) throws DocumentReadException {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            }
            return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } catch (RuntimeException ex) {
            throw new DocumentReadException(
                "INVALID_SHARE_INTENT",
                "This Android share request is not supported"
            );
        }
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

    private boolean hasOnlyAllowedShareCategories(Intent intent) {
        Set<String> categories = intent.getCategories();
        if (categories == null) {
            return true;
        }

        for (String category : categories) {
            if (!Intent.CATEGORY_DEFAULT.equals(category)) {
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

    private void notifyShareRejected(String code, String message) {
        JSObject event = new JSObject();
        event.put("source", "share");
        event.put("errorCode", code);
        event.put("message", message);
        notifyListeners(EVENT_SHARE_DOCUMENT, event, true);
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

    private static class MarkdownWriteOptions {

        final String encoding;
        final boolean writeBom;

        MarkdownWriteOptions(String encoding, boolean writeBom) {
            this.encoding = encoding;
            this.writeBom = writeBom;
        }
    }

    private static class DecodedMarkdown {

        final String markdown;
        final String encoding;
        final boolean hasBom;

        DecodedMarkdown(String markdown, String encoding, boolean hasBom) {
            this.markdown = markdown;
            this.encoding = encoding;
            this.hasBom = hasBom;
        }
    }

    private static class MarkdownBom {

        final String encoding;
        final int offset;
        final boolean hasBom;

        MarkdownBom(String encoding, int offset, boolean hasBom) {
            this.encoding = encoding;
            this.offset = offset;
            this.hasBom = hasBom;
        }
    }

    private static class ShareMarkdownPayload {

        final String markdown;
        final Map<String, File> images;

        ShareMarkdownPayload(String markdown, Map<String, File> images) {
            this.markdown = markdown;
            this.images = images;
        }
    }
}
