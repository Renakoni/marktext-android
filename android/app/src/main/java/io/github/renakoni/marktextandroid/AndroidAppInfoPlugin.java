package io.github.renakoni.marktextandroid;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.view.textservice.SpellCheckerInfo;
import android.view.textservice.TextServicesManager;
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
        result.put("spellCheckerInfo", buildSpellCheckerInfo());
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

    private String buildSpellCheckerInfo() {
        try {
            TextServicesManager manager =
                (TextServicesManager) getContext().getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE);
            if (manager == null) {
                return "No TextServicesManager";
            }

            SpellCheckerInfo info = manager.getCurrentSpellCheckerInfo();
            if (info == null) {
                return "No current system spell checker";
            }

            String packageName = info.getPackageName();
            String serviceName = info.getServiceInfo() == null
                ? "unknown"
                : info.getServiceInfo().name;
            return packageName + " / " + serviceName + " / subtypes=" + info.getSubtypeCount();
        } catch (RuntimeException ex) {
            return "Unavailable: " + ex.getClass().getSimpleName();
        }
    }

    private String safeValue(String value) {
        if (value == null || value.trim().length() == 0) {
            return "Unknown";
        }
        return value.trim();
    }
}
