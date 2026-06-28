package io.github.renakoni.marktextandroid;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

@CapacitorPlugin(name = "NativeLogger")
public class NativeLoggerPlugin extends Plugin {

    private static final String TAG = "MarkTextAndroid";
    private static final String LOG_DIR = "logs";

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
}
