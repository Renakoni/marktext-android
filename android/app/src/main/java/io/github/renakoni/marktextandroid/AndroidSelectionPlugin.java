package io.github.renakoni.marktextandroid;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidSelection")
public class AndroidSelectionPlugin extends Plugin {

    @PluginMethod
    public void setEditorSelectionActionModeSuppressed(PluginCall call) {
        boolean suppressed = Boolean.TRUE.equals(call.getBoolean("suppressed", false));
        String reason = call.getString("reason", "unspecified");
        Activity activity = getActivity();

        if (!(activity instanceof MainActivity)) {
            call.reject("AndroidSelection requires MainActivity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        MainActivity mainActivity = (MainActivity) activity;
        mainActivity.runOnUiThread(() -> {
            mainActivity.setEditorSelectionActionModeSuppressed(suppressed, reason);
            call.resolve(buildState(mainActivity));
        });
    }

    @PluginMethod
    public void getEditorSelectionActionModeState(PluginCall call) {
        Activity activity = getActivity();

        if (!(activity instanceof MainActivity)) {
            call.reject("AndroidSelection requires MainActivity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        MainActivity mainActivity = (MainActivity) activity;
        mainActivity.runOnUiThread(() -> call.resolve(buildState(mainActivity)));
    }

    @PluginMethod
    public void finishEditorSelectionActionMode(PluginCall call) {
        String reason = call.getString("reason", "unspecified");
        Activity activity = getActivity();

        if (!(activity instanceof MainActivity)) {
            call.reject("AndroidSelection requires MainActivity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        MainActivity mainActivity = (MainActivity) activity;
        mainActivity.runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("finished", mainActivity.finishActiveSelectionActionMode(reason));
            call.resolve(result);
        });
    }

    void emitSelectionTap(float cssX, float cssY) {
        JSObject data = new JSObject();
        data.put("x", cssX);
        data.put("y", cssY);
        notifyListeners("selectionTap", data);
    }

    void emitSelectionContextRequest() {
        notifyListeners("selectionContextRequest", new JSObject());
    }

    @PluginMethod
    public void performNativeSelectAll(PluginCall call) {
        String reason = call.getString("reason", "unspecified");
        Activity activity = getActivity();

        if (!(activity instanceof MainActivity)) {
            call.reject("AndroidSelection requires MainActivity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        MainActivity mainActivity = (MainActivity) activity;
        mainActivity.runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("performed", mainActivity.performNativeSelectAll(reason));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void readClipboardText(PluginCall call) {
        Activity activity = getActivity();

        if (activity == null) {
            call.reject("AndroidSelection requires a foreground activity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        activity.runOnUiThread(() -> {
            String text = "";
            ClipboardManager manager =
                (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager != null && manager.hasPrimaryClip()) {
                ClipData clip = manager.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence coerced = clip.getItemAt(0).coerceToText(activity);
                    if (coerced != null) {
                        text = coerced.toString();
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("text", text);
            result.put("available", text.length() > 0);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void writeClipboardText(PluginCall call) {
        String text = call.getString("text", "");
        String label = call.getString("label", "MarkText");
        Activity activity = getActivity();

        if (activity == null) {
            call.reject("AndroidSelection requires a foreground activity", "ACTIVITY_UNAVAILABLE");
            return;
        }

        activity.runOnUiThread(() -> {
            ClipboardManager manager =
                (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager == null) {
                call.reject("Clipboard service unavailable", "CLIPBOARD_UNAVAILABLE");
                return;
            }

            manager.setPrimaryClip(ClipData.newPlainText(label, text));
            JSObject result = new JSObject();
            result.put("written", true);
            call.resolve(result);
        });
    }

    private JSObject buildState(MainActivity activity) {
        JSObject result = new JSObject();
        result.put("suppressed", activity.isEditorSelectionActionModeSuppressed());
        result.put("hookInstalled", activity.isSelectionActionModeHookInstalled());
        result.put("suppressedCreateCount", activity.getSuppressedActionModeCreateCount());
        result.put("suppressedStartCount", activity.getSuppressedActionModeStartCount());
        result.put("allowedCreateCount", activity.getAllowedActionModeCreateCount());
        result.put("allowedStartCount", activity.getAllowedActionModeStartCount());
        result.put("finishCount", activity.getActionModeFinishCount());
        result.put("activeModeClass", activity.getActiveActionModeClassName());
        result.put("activeModeType", activity.getActiveActionModeType());
        result.put("activeModeMenuSize", activity.getActiveActionModeMenuSize());
        result.put("nativeEvents", activity.getSelectionActionModeEventLog());
        return result;
    }
}
