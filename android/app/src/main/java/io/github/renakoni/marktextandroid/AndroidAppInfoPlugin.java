package io.github.renakoni.marktextandroid;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidAppInfo")
public class AndroidAppInfoPlugin extends Plugin {

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject result = new JSObject();
        result.put("deviceInfo", buildDeviceInfo());
        result.put("webViewInfo", buildWebViewInfo());
        // Structured field for device-specific rendering policy (e.g. the
        // MIUI CJK bold clamp workaround); the display strings above stay
        // human-oriented.
        result.put("manufacturer", safeValue(Build.MANUFACTURER));
        call.resolve(result);
    }

    private String buildDeviceInfo() {
        String manufacturer = safeValue(Build.MANUFACTURER);
        String model = safeValue(Build.MODEL);
        String release = safeValue(Build.VERSION.RELEASE);
        return manufacturer + " " + model + " / Android " + release + " (API " + Build.VERSION.SDK_INT + ")";
    }

    private String buildWebViewInfo() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PackageInfo packageInfo = WebView.getCurrentWebViewPackage();
                if (packageInfo != null) {
                    return packageInfo.packageName + " " + packageInfo.versionName;
                }
            }
        } catch (RuntimeException ex) {
            return "Android WebView";
        }
        return "Android WebView";
    }

    private String safeValue(String value) {
        if (value == null || value.trim().length() == 0) {
            return "Unknown";
        }
        return value.trim();
    }
}
