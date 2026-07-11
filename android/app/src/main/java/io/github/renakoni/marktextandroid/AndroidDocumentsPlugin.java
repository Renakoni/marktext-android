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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "AndroidDocuments")
public class AndroidDocumentsPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final int MAX_IMAGE_BYTES = 15 * 1024 * 1024;
    private static final String CALLBACK_OPEN_MARKDOWN_DOCUMENT = "openMarkdownDocumentResult";
    private static final String CALLBACK_CREATE_MARKDOWN_DOCUMENT = "createMarkdownDocumentResult";
    private static final String CALLBACK_PICK_IMAGE_DOCUMENT = "pickImageDocumentResult";
    private static final String EVENT_OPEN_WITH_DOCUMENT = "openWithDocument";
    private static final String EVENT_SHARE_DOCUMENT = "shareDocument";
    private static final String IMPORTED_IMAGE_DIRECTORY = "images";
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
            MarkdownCodec.validateBytes(markdown, writeOptions);
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
        intent.putExtra(Intent.EXTRA_TITLE, SharePreparation.normalizeSuggestedMarkdownName(call.getString("suggestedName", "")));
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

        String suggestedName = SharePreparation.normalizeSuggestedMarkdownName(call.getString("suggestedName", ""));
        boolean attachImages = call.getBoolean("attachImages", true);
        MarkdownWriteOptions writeOptions = getMarkdownWriteOptions(call);
        ShareMarkdownPayload sharePayload = attachImages
            ? SharePreparation.buildShareMarkdownPayload(markdown, getImportedImageDirectoryFile())
            : new ShareMarkdownPayload(markdown, new LinkedHashMap<>());
        byte[] bytes;
        try {
            bytes = MarkdownCodec.validateBytes(sharePayload.markdown, writeOptions);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share rejected: " + ex.getMessage());
            call.reject(ex.getMessage(), ex.code, ex);
            return;
        }

        try {
            File shareDirectory = SharePreparation.getShareCacheDirectory(getContext());
            Uri markdownUri = SharePreparation.writeShareCacheFile(getContext(), shareDirectory, suggestedName, bytes);
            ArrayList<Uri> streamUris = new ArrayList<>();
            streamUris.add(markdownUri);

            for (Map.Entry<String, File> imageEntry : sharePayload.images.entrySet()) {
                File sharedImage = SharePreparation.copyShareImageFile(shareDirectory, imageEntry.getKey(), imageEntry.getValue());
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
            shareIntent.setClipData(SharePreparation.buildShareClipData(getContext(), suggestedName, streamUris));

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
            File shareDirectory = SharePreparation.getShareCacheDirectory(getContext());
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

                byte[] bytes = MarkdownCodec.validateBytes(markdown, writeOptions);
                String fileName = SharePreparation.uniqueShareFileName(
                    SharePreparation.normalizeSuggestedMarkdownName(document.optString("suggestedName", "")),
                    usedNames
                );
                if (firstName == null) {
                    firstName = fileName;
                }

                streamUris.add(SharePreparation.writeShareCacheFile(getContext(), shareDirectory, fileName, bytes));
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
            shareIntent.setClipData(SharePreparation.buildShareClipData(getContext(), firstName, streamUris));

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
    public void exportMarkdownPdf(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No Android activity is available for sharing", "SHARE_TARGET_UNAVAILABLE");
            return;
        }

        String html = call.getString("html", null);
        if (html == null || html.trim().length() == 0) {
            call.reject("Rendered document content is required", "PDF_EXPORT_FAILED");
            return;
        }

        String suggestedName = SharePreparation.normalizeSuggestedPdfName(call.getString("suggestedName", ""));
        File outputFile;
        try {
            File exportDirectory = SharePreparation.getPdfExportCacheDirectory(getContext());
            outputFile = new File(exportDirectory, suggestedName);
            if (!SharePreparation.isFileInDirectory(outputFile, exportDirectory)) {
                throw new SecurityException("PDF export path escaped the expected directory");
            }
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to prepare PDF export directory", ex);
            call.reject("Could not prepare the PDF file for sharing", "PDF_WRITE_FAILED", ex);
            return;
        }

        final File pdfFile = outputFile;
        final String displayName = suggestedName;
        activity.runOnUiThread(() ->
            PdfExporter.export(activity, html, displayName, pdfFile, new PdfExporter.Callback() {
                @Override
                public void onSuccess() {
                    sharePdfExport(call, activity, pdfFile, displayName);
                }

                @Override
                public void onFailure(String code, String message) {
                    call.reject(message, code);
                }
            })
        );
    }

    private void sharePdfExport(PluginCall call, Activity activity, File pdfFile, String displayName) {
        try {
            Uri pdfUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                pdfFile
            );
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/pdf");
            shareIntent.putExtra(Intent.EXTRA_STREAM, pdfUri);
            shareIntent.putExtra(Intent.EXTRA_TITLE, displayName);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, displayName);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            ArrayList<Uri> streamUris = new ArrayList<>();
            streamUris.add(pdfUri);
            shareIntent.setClipData(SharePreparation.buildShareClipData(getContext(), displayName, streamUris));

            Intent chooser = Intent.createChooser(shareIntent, "Share PDF");
            chooser.putExtra(
                Intent.EXTRA_EXCLUDE_COMPONENTS,
                new ComponentName[] { new ComponentName(getContext(), MainActivity.class) }
            );
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(chooser);

            JSObject result = new JSObject();
            result.put("displayName", displayName);
            result.put("mimeType", "application/pdf");
            result.put("bytes", pdfFile.length());
            Log.i(
                TAG,
                "Opened Android share sheet for exported PDF: " +
                safeForLog(displayName) +
                ", bytes=" +
                pdfFile.length()
            );
            call.resolve(result);
        } catch (ActivityNotFoundException ex) {
            Log.w(TAG, "No Android share target is available", ex);
            call.reject("No Android share target is available", "SHARE_TARGET_UNAVAILABLE", ex);
        } catch (RuntimeException ex) {
            Log.e(TAG, "Failed to share exported PDF", ex);
            call.reject("Could not prepare the PDF file for sharing", "PDF_WRITE_FAILED", ex);
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
        String newName = SharePreparation.normalizeSuggestedMarkdownName(rawName);

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
        if (intent == null || !IncomingIntentParser.isIncomingAction(intent.getAction())) {
            return;
        }

        if (!markIncomingIntentForHandling(intent)) {
            return;
        }

        IncomingIntentParser.Result result = IncomingIntentParser.parse(intent);
        switch (result.kind) {
            case OPEN_WITH_DOCUMENT:
                emitOpenWithDocument(result.uri, intent);
                return;
            case SHARE_STREAM:
                emitSharedStream(result.uri, intent);
                return;
            case SHARE_TEXT:
                emitSharedText(result.text, result.mimeType, result.rawTitle);
                return;
            case REJECTED_OPEN_WITH:
                notifyOpenWithRejected(result.code, result.message);
                return;
            case REJECTED_SHARE:
                notifyShareRejected(result.code, result.message);
                return;
            default:
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

    private void emitOpenWithDocument(Uri uri, Intent intent) {
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
    private void emitSharedStream(Uri uri, Intent intent) {
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

    private void emitSharedText(String markdown, String mimeType, String rawTitle) {
        // The parser already gated the MIME type and validated the byte size.
        String displayName = SharePreparation.normalizeSuggestedMarkdownName(rawTitle);
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
        if (!IncomingIntentParser.isMarkdownCandidate(displayName, mimeType)) {
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
        if (!IncomingIntentParser.isOpenWithMarkdownCandidate(uri, displayName, mimeType)) {
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
        if (!IncomingIntentParser.isSharedStreamMarkdownCandidate(uri, displayName, mimeType)) {
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
        byte[] bytes = MarkdownCodec.validateBytes(markdown, writeOptions);
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
        if (!IncomingIntentParser.isMarkdownCandidate(displayName, mimeType)) {
            throw new DocumentReadException(
                "UNSUPPORTED_DOCUMENT",
                "Choose a Markdown or plain text document"
            );
        }

        byte[] bytes = MarkdownCodec.validateBytes(markdown, writeOptions);
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

        // Rebuild the mask from the two allowed constants instead of masking the
        // raw Intent flags; lint's WrongConstant check cannot narrow a bitwise-and
        // of the broader @Intent.Flags value down to the persistable grant set.
        int intentFlags = data.getFlags();
        int grantFlags = 0;
        if ((intentFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0) {
            grantFlags |= Intent.FLAG_GRANT_READ_URI_PERMISSION;
        }
        if ((intentFlags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != 0) {
            grantFlags |= Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        }
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
                if (totalBytes > MarkdownCodec.MAX_MARKDOWN_BYTES) {
                    throw new DocumentReadException(
                        "DOCUMENT_TOO_LARGE",
                        "Markdown document is larger than the current 5 MB limit"
                    );
                }
                output.write(buffer, 0, read);
            }
            return MarkdownCodec.decode(output.toByteArray(), defaultMarkdownEncoding, autoDetectMarkdownEncoding);
        }
    }

    private void applyMarkdownSettingsFromCall(PluginCall call) {
        defaultMarkdownEncoding = MarkdownCodec.normalizeEncoding(call.getString("defaultEncoding", defaultMarkdownEncoding));
        autoDetectMarkdownEncoding = call.getBoolean("autoDetectEncoding", autoDetectMarkdownEncoding);
    }

    private MarkdownWriteOptions getMarkdownWriteOptions(PluginCall call) {
        String encoding = MarkdownCodec.normalizeEncoding(call.getString("encoding", defaultMarkdownEncoding));
        boolean writeBom = call.getBoolean("writeBom", false);
        return new MarkdownWriteOptions(encoding, writeBom);
    }

    private void putMarkdownEncodingMetadata(JSObject result, DecodedMarkdown decoded) {
        putMarkdownEncodingMetadata(result, decoded.encoding, decoded.hasBom);
    }

    private void putMarkdownEncodingMetadata(JSObject result, String encoding, boolean hasBom) {
        result.put("encoding", MarkdownCodec.normalizeEncoding(encoding));
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
        String normalizedIntentType = IncomingIntentParser.normalizeMimeType(intentType);
        if (IncomingIntentParser.isMarkdownMimeType(normalizedIntentType)) {
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

    private boolean isSupportedImage(String displayName, String mimeType) {
        if (isSupportedImageMimeType(mimeType)) {
            return true;
        }

        return (
            mimeType.length() == 0 ||
            "application/octet-stream".equals(mimeType)
        ) && SharePreparation.hasSupportedImageExtension(displayName);
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

    private String normalizeImageDisplayName(String displayName, String mimeType) {
        String cleaned = displayName == null ? "" : displayName.trim();
        cleaned = cleaned.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", " ");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        if (cleaned.length() == 0) {
            cleaned = "Image";
        }

        if (SharePreparation.hasSupportedImageExtension(cleaned)) {
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

}
