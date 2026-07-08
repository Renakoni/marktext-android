package io.github.renakoni.marktextandroid;

import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import java.lang.ref.WeakReference;
import java.util.ArrayDeque;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MarkTextSelection";
    private static final int MAX_SELECTION_ACTION_MODE_EVENTS = 80;

    private boolean suppressEditorSelectionActionMode = false;
    private boolean selectionActionModeHookInstalled = false;
    private boolean suppressedSelectionActionModeRequestInFlight = false;
    private int suppressedActionModeCreateCount = 0;
    private int suppressedActionModeStartCount = 0;
    private int allowedActionModeCreateCount = 0;
    private int allowedActionModeStartCount = 0;
    private int actionModeFinishCount = 0;
    private int selectionActionModeEventSequence = 0;
    private ActionMode activeSelectionActionMode = null;
    private long activeSelectionActionModeStartUptimeMs = 0L;
    private WeakReference<ActionMode> suppressedSelectionActionMode = new WeakReference<>(null);
    private WeakReference<HiddenSelectionActionModeCallback> suppressedSelectionActionModeCallback =
        new WeakReference<>(null);
    private final ArrayDeque<String> selectionActionModeEvents = new ArrayDeque<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidDocumentsPlugin.class);
        registerPlugin(NativeLoggerPlugin.class);
        registerPlugin(AndroidAppInfoPlugin.class);
        registerPlugin(AndroidSelectionPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void load() {
        super.load();
        refreshSelectionActionModeHookState();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (intent != null) {
            setIntent(intent);
        }
        super.onNewIntent(intent);
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) {
        // Counting happens in the typed overload only: the framework routes
        // TYPE_PRIMARY through it and its default implementation delegates
        // here, so counting in both would double-count primary modes.
        recordSelectionActionModeEvent("window-start-primary", callbackName(callback));
        return super.onWindowStartingActionMode(callback);
    }

    @Override
    public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
        recordSelectionActionModeEvent("window-start-typed", "type=" + type + " callback=" + callbackName(callback));

        // Never replace the ActionMode here. Chromium requires the real
        // system/OEM floating ActionMode for a stable selection lifecycle;
        // suppression happens by keeping that real mode hidden
        // (MarkTextWebView + HiddenSelectionActionModeCallback).
        if (suppressedSelectionActionModeRequestInFlight && type == ActionMode.TYPE_FLOATING) {
            recordSuppressedSelectionActionModeCreate(type);
        } else {
            recordAllowedSelectionActionModeCreate(type);
        }
        return super.onWindowStartingActionMode(callback, type);
    }

    @Override
    public void onActionModeStarted(ActionMode mode) {
        super.onActionModeStarted(mode);
        if (mode == null) {
            recordSelectionActionModeEvent("action-mode-started", "mode=null");
            return;
        }

        if (isSuppressedSelectionActionMode(mode)) {
            suppressedActionModeStartCount++;
        } else {
            allowedActionModeStartCount++;
        }
        activeSelectionActionMode = mode;
        activeSelectionActionModeStartUptimeMs = SystemClock.uptimeMillis();
        recordSelectionActionModeEvent("action-mode-started", modeDescription(mode));
    }

    @Override
    public void onActionModeFinished(ActionMode mode) {
        super.onActionModeFinished(mode);
        actionModeFinishCount++;
        if (mode == activeSelectionActionMode) {
            activeSelectionActionMode = null;
            activeSelectionActionModeStartUptimeMs = 0L;
        }
        if (mode != null && mode == suppressedSelectionActionMode.get()) {
            suppressedSelectionActionMode = new WeakReference<>(null);
        }
        recordSelectionActionModeEvent("action-mode-finished", modeDescription(mode));
    }

    void noteSuppressedSelectionActionModeRequest(boolean inFlight) {
        suppressedSelectionActionModeRequestInFlight = inFlight;
    }

    void registerSuppressedSelectionActionMode(
        ActionMode mode,
        HiddenSelectionActionModeCallback callback
    ) {
        suppressedSelectionActionMode = new WeakReference<>(mode);
        suppressedSelectionActionModeCallback = new WeakReference<>(callback);
    }

    boolean isSuppressedSelectionActionMode(ActionMode mode) {
        return mode != null && mode == suppressedSelectionActionMode.get();
    }

    boolean hasActiveSuppressedSelectionActionMode() {
        return activeSelectionActionMode != null
            && isSuppressedSelectionActionMode(activeSelectionActionMode);
    }

    long getActiveSuppressedSelectionActionModeStartUptimeMs() {
        return hasActiveSuppressedSelectionActionMode()
            ? activeSelectionActionModeStartUptimeMs
            : 0L;
    }

    // Drive Chromium's own select-all through the hidden ActionMode's menu:
    // a native select-all keeps the touch-selection session alive, so the
    // system drag handles appear — a JS range replacement never shows them.
    boolean performNativeSelectAll(String reason) {
        ActionMode mode = activeSelectionActionMode;
        HiddenSelectionActionModeCallback callback = suppressedSelectionActionModeCallback.get();
        if (mode == null || callback == null || !isSuppressedSelectionActionMode(mode)) {
            recordSelectionActionModeEvent("native-select-all-unavailable", safeReason(reason));
            return false;
        }

        Menu menu = mode.getMenu();
        MenuItem item = menu == null ? null : menu.findItem(android.R.id.selectAll);
        if (item == null && menu != null) {
            // Chromium/OEM menus use their own generated ids; their Select All
            // title comes from the same framework resource, so match on it.
            String expected = String.valueOf(getText(android.R.string.selectAll)).trim();
            for (int index = 0; index < menu.size(); index++) {
                MenuItem candidate = menu.getItem(index);
                CharSequence title = candidate.getTitle();
                if (title != null && title.toString().trim().equalsIgnoreCase(expected)) {
                    item = candidate;
                    break;
                }
            }
        }
        if (item == null) {
            recordSelectionActionModeEvent(
                "native-select-all-item-missing",
                safeReason(reason) + " menu=" + describeMenuItemIds(menu)
            );
            return false;
        }

        recordSelectionActionModeEvent("native-select-all", safeReason(reason));
        callback.onActionItemClicked(mode, item);
        return true;
    }

    private String describeMenuItemIds(Menu menu) {
        if (menu == null) {
            return "null";
        }

        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < menu.size(); index++) {
            if (builder.length() > 0) {
                builder.append(',');
            }
            builder.append(menu.getItem(index).getItemId());
        }
        return builder.toString();
    }

    void notifySelectionTap(float cssX, float cssY) {
        recordSelectionActionModeEvent(
            "selection-tap-native",
            String.format(Locale.US, "x=%.1f y=%.1f", cssX, cssY)
        );

        if (getBridge() == null) {
            return;
        }

        PluginHandle handle = getBridge().getPlugin("AndroidSelection");
        Plugin plugin = handle == null ? null : handle.getInstance();
        if (plugin instanceof AndroidSelectionPlugin) {
            ((AndroidSelectionPlugin) plugin).emitSelectionTap(cssX, cssY);
        }
    }

    boolean finishActiveSelectionActionMode(String reason) {
        ActionMode mode = activeSelectionActionMode;
        if (mode == null) {
            recordSelectionActionModeEvent("action-mode-finish-request-empty", safeReason(reason));
            return false;
        }

        recordSelectionActionModeEvent(
            "action-mode-finish-request",
            safeReason(reason) + " " + modeDescription(mode)
        );
        mode.finish();
        return true;
    }

    void setEditorSelectionActionModeSuppressed(boolean suppressed, String reason) {
        suppressEditorSelectionActionMode = suppressed;
        refreshSelectionActionModeHookState();
        Log.d(TAG, "Editor selection ActionMode suppression " + (suppressed ? "enabled" : "disabled")
            + " reason=" + safeReason(reason));
    }

    boolean shouldSuppressEditorSelectionActionMode() {
        return suppressEditorSelectionActionMode;
    }

    boolean isEditorSelectionActionModeSuppressed() {
        return suppressEditorSelectionActionMode;
    }

    boolean isSelectionActionModeHookInstalled() {
        return selectionActionModeHookInstalled;
    }

    int getSuppressedActionModeCreateCount() {
        return suppressedActionModeCreateCount;
    }

    int getSuppressedActionModeStartCount() {
        return suppressedActionModeStartCount;
    }

    int getAllowedActionModeCreateCount() {
        return allowedActionModeCreateCount;
    }

    int getAllowedActionModeStartCount() {
        return allowedActionModeStartCount;
    }

    int getActionModeFinishCount() {
        return actionModeFinishCount;
    }

    String getActiveActionModeClassName() {
        return activeSelectionActionMode == null ? null : modeName(activeSelectionActionMode);
    }

    int getActiveActionModeType() {
        return activeSelectionActionMode == null ? -1 : activeSelectionActionMode.getType();
    }

    int getActiveActionModeMenuSize() {
        return activeSelectionActionMode == null ? -1 : menuSize(activeSelectionActionMode);
    }

    String getSelectionActionModeEventLog() {
        StringBuilder builder = new StringBuilder();
        for (String event : selectionActionModeEvents) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(event);
        }
        return builder.toString();
    }

    void recordSuppressedSelectionActionModeCreate(int type) {
        suppressedActionModeCreateCount++;
        recordSelectionActionModeEvent("action-mode-create-suppressed", "type=" + type);
    }

    void recordAllowedSelectionActionModeCreate(int type) {
        allowedActionModeCreateCount++;
        recordSelectionActionModeEvent("action-mode-create-allowed", "type=" + type);
    }

    void recordSelectionActionModeEvent(String stage, String detail) {
        String event = String.format(
            Locale.US,
            "#%03d t=%d %s suppressed=%s hook=%s %s",
            ++selectionActionModeEventSequence,
            SystemClock.uptimeMillis(),
            stage,
            suppressEditorSelectionActionMode,
            selectionActionModeHookInstalled,
            safeReason(detail)
        );

        if (selectionActionModeEvents.size() >= MAX_SELECTION_ACTION_MODE_EVENTS) {
            selectionActionModeEvents.removeFirst();
        }
        selectionActionModeEvents.addLast(event);
        Log.d(TAG, event);
    }

    private void refreshSelectionActionModeHookState() {
        selectionActionModeHookInstalled =
            getBridge() != null && getBridge().getWebView() instanceof MarkTextWebView;
    }

    private String safeReason(String reason) {
        if (reason == null || reason.trim().length() == 0) {
            return "unspecified";
        }

        return reason.trim();
    }

    private String callbackName(ActionMode.Callback callback) {
        return callback == null ? "null" : callback.getClass().getName();
    }

    private String modeName(ActionMode mode) {
        return mode == null ? "null" : mode.getClass().getName();
    }

    private String modeDescription(ActionMode mode) {
        if (mode == null) {
            return "mode=null";
        }

        return "type=" + mode.getType()
            + " mode=" + modeName(mode)
            + " title=" + safeReason(String.valueOf(mode.getTitle()))
            + " menuSize=" + menuSize(mode);
    }

    private int menuSize(ActionMode mode) {
        try {
            return mode.getMenu() == null ? -1 : mode.getMenu().size();
        } catch (RuntimeException exception) {
            return -2;
        }
    }
}
