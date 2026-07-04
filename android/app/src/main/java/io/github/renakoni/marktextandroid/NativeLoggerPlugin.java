package io.github.renakoni.marktextandroid;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@CapacitorPlugin(name = "NativeLogger")
public class NativeLoggerPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final String LOG_DIR = "logs";
    private static final String LOG_EXPORT_DIR = "log-exports";

    @PluginMethod
    public void write(PluginCall call) {
        String timestamp = call.getString("timestamp", nowIso());
        String level = normalizeLevel(call.getString("level", "info"));
        String category = sanitize(call.getString("category", "app"));
        String message = sanitize(call.getString("message", ""));
        String context = sanitize(call.getString("context", ""));
        String platform = sanitize(call.getString("platform", ""));
        String sessionId = sanitize(call.getString("sessionId", ""));

        if (message.length() == 0) {
            call.reject("Log message is required");
            return;
        }

        String line = formatLine(timestamp, level, category, message, context, platform, sessionId);
        writeLogcat(level, line);

        try {
            appendToFile(timestamp, line);
            call.resolve();
        } catch (IOException ex) {
            Log.e(TAG, "Failed to write native log file", ex);
            call.reject("Failed to write native log file", ex);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        File dir = getLogDirectory();
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile() && file.getName().endsWith(".log") && !file.delete()) {
                    Log.w(TAG, "Failed to delete log file: " + file.getAbsolutePath());
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject result = new JSObject();
        File dir = getLogDirectory();
        result.put("tag", TAG);
        result.put("directory", dir.getAbsolutePath());
        result.put("currentFile", getLogFile(nowIso()).getAbsolutePath());
        call.resolve(result);
    }

    @PluginMethod
    public void exportLogs(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No Android activity is available for sharing logs", "LOG_SHARE_TARGET_UNAVAILABLE");
            return;
        }

        String webLogs = call.getString("webLogs", "");
        String displayName = "marktext-android-logs-" + utcDateFormat("yyyyMMdd-HHmmss").format(new Date()) + ".zip";

        try {
            File exportDirectory = getLogExportDirectory();
            if (!exportDirectory.exists() && !exportDirectory.mkdirs()) {
                throw new IOException("Cannot create log export directory: " + exportDirectory.getAbsolutePath());
            }

            File exportFile = new File(exportDirectory, displayName);
            if (!isFileInDirectory(exportFile, exportDirectory)) {
                throw new SecurityException("Log export path escaped the expected directory");
            }

            int fileCount = writeLogZip(exportFile, webLogs);
            Uri exportUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                exportFile
            );
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/zip");
            shareIntent.putExtra(Intent.EXTRA_STREAM, exportUri);
            shareIntent.putExtra(Intent.EXTRA_TITLE, displayName);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, displayName);
            shareIntent.setClipData(ClipData.newUri(getContext().getContentResolver(), displayName, exportUri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, "Export logs");
            chooser.putExtra(
                Intent.EXTRA_EXCLUDE_COMPONENTS,
                new ComponentName[] { new ComponentName(getContext(), MainActivity.class) }
            );
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(chooser);

            JSObject result = new JSObject();
            result.put("displayName", displayName);
            result.put("bytes", exportFile.length());
            result.put("fileCount", fileCount);
            call.resolve(result);
        } catch (ActivityNotFoundException ex) {
            Log.w(TAG, "No Android share target is available for logs", ex);
            call.reject("No Android share target is available for logs", "LOG_SHARE_TARGET_UNAVAILABLE", ex);
        } catch (IOException | SecurityException ex) {
            Log.e(TAG, "Failed to export native logs", ex);
            call.reject("Failed to export native logs", "LOG_EXPORT_FAILED", ex);
        }
    }

    private static String normalizeLevel(String level) {
        if (level == null) {
            return "info";
        }

        String normalized = level.toLowerCase(Locale.US);
        if (
            normalized.equals("debug") ||
            normalized.equals("info") ||
            normalized.equals("warn") ||
            normalized.equals("error")
        ) {
            return normalized;
        }
        return "info";
    }

    private static String sanitize(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\r', ' ').replace('\n', ' ').trim();
    }

    private static String formatLine(
        String timestamp,
        String level,
        String category,
        String message,
        String context,
        String platform,
        String sessionId
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(timestamp);
        builder.append(" | ");
        builder.append(level.toUpperCase(Locale.US));
        builder.append(" | ");
        builder.append(category);
        builder.append(" | ");
        builder.append(message);
        if (context.length() > 0) {
            builder.append(" | ");
            builder.append(context);
        }
        if (platform.length() > 0 || sessionId.length() > 0) {
            builder.append(" | meta=");
            builder.append("{platform:");
            builder.append(platform);
            builder.append(",session:");
            builder.append(sessionId);
            builder.append("}");
        }
        return builder.toString();
    }

    private void writeLogcat(String level, String line) {
        if (level.equals("error")) {
            Log.e(TAG, line);
        } else if (level.equals("warn")) {
            Log.w(TAG, line);
        } else if (level.equals("debug")) {
            Log.d(TAG, line);
        } else {
            Log.i(TAG, line);
        }
    }

    private synchronized void appendToFile(String timestamp, String line) throws IOException {
        File dir = getLogDirectory();
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Cannot create log directory: " + dir.getAbsolutePath());
        }

        File logFile = getLogFile(timestamp);
        try (
            OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(logFile, true),
                StandardCharsets.UTF_8
            )
        ) {
            writer.write(line);
            writer.write('\n');
        }
    }

    private File getLogDirectory() {
        return new File(getContext().getFilesDir(), LOG_DIR);
    }

    private File getLogExportDirectory() {
        return new File(getContext().getCacheDir(), LOG_EXPORT_DIR);
    }

    private File getLogFile(String timestamp) {
        String day = dayFromTimestamp(timestamp);
        return new File(getLogDirectory(), "marktext-android-" + day + ".log");
    }

    private static String dayFromTimestamp(String timestamp) {
        if (timestamp != null && timestamp.length() >= 10) {
            String day = timestamp.substring(0, 10);
            if (day.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return day;
            }
        }
        return utcDateFormat("yyyy-MM-dd").format(new Date());
    }

    private static String nowIso() {
        return utcDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(new Date());
    }

    private static SimpleDateFormat utcDateFormat(String pattern) {
        SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format;
    }

    private int writeLogZip(File outputFile, String webLogs) throws IOException {
        int fileCount = 0;
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(outputFile))) {
            fileCount += writeInfoEntry(zip);
            File[] logFiles = getLogDirectory().listFiles();
            if (logFiles != null) {
                Arrays.sort(logFiles, (left, right) -> left.getName().compareTo(right.getName()));
                for (File logFile : logFiles) {
                    if (logFile.isFile() && logFile.getName().endsWith(".log")) {
                        writeFileEntry(zip, logFile, "native/" + sanitizeZipEntryName(logFile.getName()));
                        fileCount += 1;
                    }
                }
            }

            if (webLogs != null && webLogs.trim().length() > 0) {
                writeTextEntry(zip, "web/debug-logs.jsonl", webLogs);
                fileCount += 1;
            }
        }
        return fileCount;
    }

    private int writeInfoEntry(ZipOutputStream zip) throws IOException {
        StringBuilder builder = new StringBuilder();
        builder.append("createdAt=").append(nowIso()).append('\n');
        builder.append("package=").append(getContext().getPackageName()).append('\n');
        builder.append("androidApi=").append(android.os.Build.VERSION.SDK_INT).append('\n');
        builder.append("device=").append(sanitize(android.os.Build.MANUFACTURER)).append(' ');
        builder.append(sanitize(android.os.Build.MODEL)).append('\n');
        builder.append("logDirectory=").append(getLogDirectory().getAbsolutePath()).append('\n');
        writeTextEntry(zip, "manifest.txt", builder.toString());
        return 1;
    }

    private void writeTextEntry(ZipOutputStream zip, String name, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        ZipEntry entry = new ZipEntry(name);
        zip.putNextEntry(entry);
        zip.write(bytes);
        zip.closeEntry();
    }

    private void writeFileEntry(ZipOutputStream zip, File file, String name) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        zip.putNextEntry(entry);
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                zip.write(buffer, 0, read);
            }
        }
        zip.closeEntry();
    }

    private String sanitizeZipEntryName(String value) {
        String sanitized = value == null ? "" : value.replaceAll("[^A-Za-z0-9._-]+", "_");
        return sanitized.length() == 0 ? "log.txt" : sanitized;
    }

    private boolean isFileInDirectory(File file, File directory) {
        try {
            String directoryPath = directory.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            return filePath.startsWith(directoryPath + File.separator);
        } catch (IOException ex) {
            Log.w(TAG, "Could not validate log export path", ex);
            return false;
        }
    }
}
