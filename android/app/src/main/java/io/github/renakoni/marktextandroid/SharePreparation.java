package io.github.renakoni.marktextandroid;

import android.content.ClipData;
import android.content.Context;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prepares Markdown shares: the share-cache directory, temporary Markdown
 * files, unique in-batch file names, image attachment collection and copying,
 * and the ClipData over the prepared stream URIs. The plugin keeps the final
 * Capacitor handling and the Android share-Intent dispatch.
 */
final class SharePreparation {

    private static final String TAG = "MarkTextAndroid";
    private static final String SHARE_CACHE_DIRECTORY = "shared-markdown";
    private static final Pattern MARKTEXT_IMAGE_SOURCE_PATTERN = Pattern.compile(
        "marktext-image://local/([^\\s)]+)",
        Pattern.CASE_INSENSITIVE
    );

    private SharePreparation() {}

    static String normalizeSuggestedMarkdownName(String suggestedName) {
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

    static String uniqueShareFileName(String fileName, Set<String> usedNames) {
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

    static ShareMarkdownPayload buildShareMarkdownPayload(String markdown, File importedImageDirectory) {
        Map<String, File> images = new LinkedHashMap<>();
        Matcher matcher = MARKTEXT_IMAGE_SOURCE_PATTERN.matcher(markdown);
        StringBuffer rewrittenMarkdown = new StringBuffer();

        while (matcher.find()) {
            String fileName = normalizeImportedImageFileName(Uri.decode(matcher.group(1)));
            if (fileName.length() == 0) {
                continue;
            }

            File importedImage = new File(importedImageDirectory, fileName);
            if (!isFileInDirectory(importedImage, importedImageDirectory) || !importedImage.isFile()) {
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

    static ClipData buildShareClipData(Context context, String suggestedName, ArrayList<Uri> streamUris) {
        ClipData clipData = ClipData.newUri(context.getContentResolver(), suggestedName, streamUris.get(0));
        for (int index = 1; index < streamUris.size(); index++) {
            clipData.addItem(new ClipData.Item(streamUris.get(index)));
        }
        return clipData;
    }

    static File getShareCacheDirectory(Context context) throws IOException {
        File directory = new File(context.getCacheDir(), SHARE_CACHE_DIRECTORY);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create share cache directory");
        }
        return directory;
    }

    static Uri writeShareCacheFile(
        Context context,
        File directory,
        String displayName,
        byte[] bytes
    ) throws IOException {
        File outputFile = new File(directory, normalizeSuggestedMarkdownName(displayName));
        if (!isFileInDirectory(outputFile, directory)) {
            throw new SecurityException("Share cache path escaped the expected directory");
        }

        try (OutputStream output = new FileOutputStream(outputFile, false)) {
            output.write(bytes);
            output.flush();
        }

        return FileProvider.getUriForFile(
            context,
            context.getPackageName() + ".fileprovider",
            outputFile
        );
    }

    static File copyShareImageFile(File directory, String displayName, File sourceFile) throws IOException {
        String normalizedName = normalizeImportedImageFileName(displayName);
        if (normalizedName.length() == 0) {
            throw new SecurityException("Invalid shared image file name");
        }

        File outputFile = new File(directory, normalizedName);
        if (!isFileInDirectory(outputFile, directory)) {
            throw new SecurityException("Shared image path escaped the expected directory");
        }

        try (
            InputStream input = new FileInputStream(sourceFile);
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

    static boolean hasSupportedImageExtension(String value) {
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

    static String normalizeImportedImageFileName(String fileName) {
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

    private static boolean isFileInDirectory(File file, File directory) {
        try {
            String directoryPath = directory.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            return filePath.startsWith(directoryPath + File.separator);
        } catch (IOException ex) {
            Log.w(TAG, "Could not validate file path", ex);
            return false;
        }
    }

    private static String safeForLog(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\r', ' ').replace('\n', ' ').trim();
    }
}
