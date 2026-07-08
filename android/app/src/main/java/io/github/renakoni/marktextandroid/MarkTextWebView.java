package io.github.renakoni.marktextandroid;

import android.content.Context;
import android.content.ContextWrapper;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.MotionEvent;
import com.getcapacitor.CapacitorWebView;
import java.util.Locale;

public class MarkTextWebView extends CapacitorWebView {
    private static final long SELECTION_TAP_MAX_DURATION_MS = 500L;
    private static final float SELECTION_TAP_MAX_TRAVEL_DP = 24f;
    // A qualifying tap must have started clearly after the selection session
    // began, otherwise the tap that CREATED the selection (a double-tap word
    // select finishes before its own ACTION_UP) dismisses it immediately.
    private static final long SELECTION_TAP_MIN_MODE_AGE_MS = 250L;

    private float touchDownX = 0f;
    private float touchDownY = 0f;
    private long touchDownUptimeMs = 0L;

    public MarkTextWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback) {
        recordSelectionDiagnosticEvent("webview-start-action-mode-primary", callbackName(callback));
        return super.startActionMode(callback);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        MainActivity activity = findMainActivity(getContext());
        boolean suppress = activity != null
            && callback != null
            && type == ActionMode.TYPE_FLOATING
            && activity.shouldSuppressEditorSelectionActionMode();

        recordSelectionDiagnosticEvent(
            "webview-start-action-mode-typed",
            "type=" + type + " suppress=" + suppress + " callback=" + callbackName(callback)
        );

        if (!suppress) {
            return super.startActionMode(callback, type);
        }

        // Let the real system/OEM floating ActionMode start with a wrapped
        // callback that keeps its toolbar hidden. Returning null or a fake
        // ActionMode here makes Chromium clear the selection and dismiss the
        // touch handles (SelectionPopupControllerImpl.showActionModeOrClearOnFailure
        // and onDestroyActionMode).
        HiddenSelectionActionModeCallback hiddenCallback =
            new HiddenSelectionActionModeCallback(activity, this, callback);
        activity.noteSuppressedSelectionActionModeRequest(true);
        try {
            ActionMode mode = super.startActionMode(hiddenCallback, type);
            if (mode == null) {
                activity.recordSelectionActionModeEvent(
                    "hidden-mode-start-null",
                    "type=" + type + " callback=" + callbackName(callback)
                );
            }
            return mode;
        } finally {
            activity.noteSuppressedSelectionActionModeRequest(false);
        }
    }

    @Override
    public boolean performLongClick() {
        recordSelectionDiagnosticEvent("webview-perform-long-click", "focus=" + hasFocus());
        return super.performLongClick();
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        int action = event == null ? MotionEvent.ACTION_CANCEL : event.getActionMasked();
        boolean shouldRecord = action == MotionEvent.ACTION_DOWN
            || action == MotionEvent.ACTION_UP
            || action == MotionEvent.ACTION_CANCEL;

        boolean handled = super.onTouchEvent(event);

        if (shouldRecord) {
            recordSelectionDiagnosticEvent(
                "webview-touch",
                motionEventDescription(event) + " handled=" + handled
            );
        }

        if (event != null && action == MotionEvent.ACTION_DOWN) {
            touchDownX = event.getX();
            touchDownY = event.getY();
            touchDownUptimeMs = event.getEventTime();
        } else if (event != null && action == MotionEvent.ACTION_UP) {
            maybeNotifySelectionTap(event);
        }

        return handled;
    }

    // MIUI can consume a tap that lands inside an active text selection
    // without dispatching any DOM touch event, which strands the user inside
    // select-all. The WebView always sees the raw MotionEvents, so report
    // qualifying taps to the web layer while a suppressed selection ActionMode
    // is active; the web layer decides whether to collapse the selection.
    private void maybeNotifySelectionTap(MotionEvent event) {
        MainActivity activity = findMainActivity(getContext());
        if (activity == null
            || !activity.shouldSuppressEditorSelectionActionMode()
            || !activity.hasActiveSuppressedSelectionActionMode()) {
            return;
        }

        long modeStartUptimeMs = activity.getActiveSuppressedSelectionActionModeStartUptimeMs();
        if (modeStartUptimeMs <= 0L
            || touchDownUptimeMs < modeStartUptimeMs + SELECTION_TAP_MIN_MODE_AGE_MS) {
            return;
        }

        long duration = event.getEventTime() - touchDownUptimeMs;
        if (duration > SELECTION_TAP_MAX_DURATION_MS) {
            return;
        }

        float density = getResources().getDisplayMetrics().density;
        float travelX = event.getX() - touchDownX;
        float travelY = event.getY() - touchDownY;
        float maxTravelPx = SELECTION_TAP_MAX_TRAVEL_DP * density;
        if ((travelX * travelX + travelY * travelY) > maxTravelPx * maxTravelPx) {
            return;
        }

        activity.notifySelectionTap(event.getX() / density, event.getY() / density);
    }

    private void recordSelectionDiagnosticEvent(String stage, String detail) {
        MainActivity activity = findMainActivity(getContext());
        if (activity != null) {
            activity.recordSelectionActionModeEvent(stage, detail);
        }
    }

    private MainActivity findMainActivity(Context context) {
        Context current = context;
        while (current instanceof ContextWrapper) {
            if (current instanceof MainActivity) {
                return (MainActivity) current;
            }

            Context baseContext = ((ContextWrapper) current).getBaseContext();
            if (baseContext == current) {
                break;
            }
            current = baseContext;
        }

        return current instanceof MainActivity ? (MainActivity) current : null;
    }

    private String callbackName(ActionMode.Callback callback) {
        return callback == null ? "null" : callback.getClass().getName();
    }

    private String motionEventDescription(MotionEvent event) {
        if (event == null) {
            return "event=null";
        }

        return String.format(
            Locale.US,
            "action=%s x=%.1f y=%.1f rawX=%.1f rawY=%.1f pointers=%d focus=%s",
            motionActionName(event.getActionMasked()),
            event.getX(),
            event.getY(),
            event.getRawX(),
            event.getRawY(),
            event.getPointerCount(),
            hasFocus()
        );
    }

    private String motionActionName(int action) {
        switch (action) {
            case MotionEvent.ACTION_DOWN:
                return "down";
            case MotionEvent.ACTION_UP:
                return "up";
            case MotionEvent.ACTION_CANCEL:
                return "cancel";
            default:
                return String.valueOf(action);
        }
    }
}
