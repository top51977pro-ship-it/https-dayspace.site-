package site.dayspace.closetbuddy;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web layer ask the OS to exempt the app from battery optimization.
 *
 * Samsung's aggressive power management ("Deep sleep" / "Put unused apps to
 * sleep") can cancel AlarmManager alarms, which stops scheduled wash reminders
 * from firing when the app is closed. Exempting the app keeps them reliable.
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ignoring", isIgnoring());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();

        if (isIgnoring()) {
            ret.put("requested", false);
            call.resolve(ret);
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("requested", true);
            call.resolve(ret);
        } catch (Exception e) {
            // Some OEMs block the direct request dialog — fall back to the settings screen.
            try {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                ret.put("requested", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Unable to request battery optimization exemption", e2);
            }
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open battery settings", e);
        }
    }

    private boolean isIgnoring() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm == null) {
            return true;
        }
        return pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }
}
