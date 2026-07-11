import { registerPlugin } from "@capacitor/core";

/**
 * Bridge to the custom native `BatteryOptimization` plugin (see
 * android/app/src/main/java/.../BatteryOptimizationPlugin.java).
 *
 * Samsung's aggressive "Deep sleep" / App power management can kill background
 * alarms, which prevents scheduled wash reminders from firing when the app is
 * closed. Asking the user to exempt the app from battery optimization keeps the
 * AlarmManager-backed local notifications reliable.
 */
export interface BatteryOptimizationPlugin {
  /** Whether the app is already exempt from battery optimization. */
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  /** Prompt the system dialog to add the app to the battery-optimization exemption list. */
  requestIgnoreBatteryOptimizations(): Promise<{ requested: boolean }>;
  /** Open the OS battery-optimization settings screen (fallback for OEMs that block the direct prompt). */
  openBatterySettings(): Promise<void>;
}

export const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>("BatteryOptimization", {
  // Web/no-op implementation so imports are safe outside Android.
  web: {
    async isIgnoringBatteryOptimizations() {
      return { ignoring: true };
    },
    async requestIgnoreBatteryOptimizations() {
      return { requested: false };
    },
    async openBatterySettings() {
      /* noop on web */
    },
  },
});
