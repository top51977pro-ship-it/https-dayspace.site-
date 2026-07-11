import { Device } from "@capacitor/device";
import { BatteryOptimization } from "./battery-optimization";
import { isAndroidNative, isNative } from "./native";
import {
  NOTIF_ENABLED_KEY,
  getNotificationPermission,
  getSetting,
  requestNotificationPermission,
  setSetting,
} from "./notifications";

const FIRST_LAUNCH_KEY = "native_first_launch_done";
const BATTERY_PROMPTED_KEY = "battery_opt_prompted";

/**
 * One-time native bootstrap, run on the client after the app mounts.
 *
 *  1. On the first launch, request the POST_NOTIFICATIONS runtime permission so
 *     scheduled wash reminders can be delivered on Android 13+.
 *  2. On Samsung devices, ask the user to exempt the app from battery
 *     optimization so background alarms aren't killed by "Deep sleep".
 *
 * Safe to call in any environment — it no-ops on the web.
 */
export async function initNative() {
  if (!isNative()) return;

  try {
    const firstLaunch = !(await getSetting<boolean>(FIRST_LAUNCH_KEY, false));

    if (firstLaunch) {
      // Ask for notification permission up front so reminders work later.
      if ((await getNotificationPermission()) === "prompt") {
        const perm = await requestNotificationPermission();
        if (perm === "granted") {
          // Enable wash reminders by default once the user has granted access.
          const already = await getSetting<boolean>(NOTIF_ENABLED_KEY, false);
          if (!already) await setSetting(NOTIF_ENABLED_KEY, true);
        }
      }
      await setSetting(FIRST_LAUNCH_KEY, true);
    }

    await maybeRequestBatteryExemption();
  } catch (e) {
    console.error("native init failed", e);
  }
}

async function maybeRequestBatteryExemption() {
  if (!isAndroidNative()) return;

  // Only relevant for Samsung's aggressive power management, and only ask once.
  const alreadyPrompted = await getSetting<boolean>(BATTERY_PROMPTED_KEY, false);
  if (alreadyPrompted) return;

  let manufacturer = "";
  try {
    manufacturer = (await Device.getInfo()).manufacturer ?? "";
  } catch {
    return;
  }
  if (!/samsung/i.test(manufacturer)) return;

  try {
    const { ignoring } = await BatteryOptimization.isIgnoringBatteryOptimizations();
    if (!ignoring) {
      await BatteryOptimization.requestIgnoreBatteryOptimizations();
    }
  } catch {
    /* best-effort */
  } finally {
    // Mark as prompted regardless so we don't nag on every launch.
    await setSetting(BATTERY_PROMPTED_KEY, true);
  }
}
