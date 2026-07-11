import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "./db";
import { isNative } from "./native";

export const NOTIF_ENABLED_KEY = "notif_enabled";
export const NOTIF_THRESHOLD_KEY = "notif_threshold";
const NOTIF_LAST_KEY = "notif_last_check";
const NOTIF_SHOWN_KEY = "notif_shown_ids";
const NOTIF_CHANNEL_ID = "wash-reminders";

export type NotifPermission = "granted" | "denied" | "prompt" | "unsupported";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db().settings.get(key);
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await db().settings.put({ key, value });
}

export function notificationsSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Native shell always supports local notifications; on web we need the browser API.
  return isNative() || "Notification" in window;
}

function normalizePermission(state: string): NotifPermission {
  switch (state) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    default:
      // "prompt" | "prompt-with-rationale"
      return "prompt";
  }
}

/** Ensure the Android notification channel exists so scheduled reminders are delivered reliably. */
async function ensureChannel() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: NOTIF_CHANNEL_ID,
      name: "תזכורות כביסה",
      description: "התראות כשבגד נלבש יותר מדי פעמים ללא כביסה",
      importance: 4, // IMPORTANCE_HIGH — heads-up notification
      visibility: 1,
    });
  } catch {
    /* channel APIs are Android-only / best-effort */
  }
}

export async function getNotificationPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return normalizePermission(display);
  } catch {
    return "denied";
  }
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return "unsupported";
  try {
    await ensureChannel();
    // On Android 13+ this triggers the POST_NOTIFICATIONS runtime prompt.
    const { display } = await LocalNotifications.requestPermissions();
    return normalizePermission(display);
  } catch {
    return "denied";
  }
}

/** Stable positive 31-bit int id derived from a string, required by LocalNotifications. */
function notifId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647 || 1;
}

/**
 * Schedule an OS-level notification a few seconds out. Unlike the web Notification API,
 * a scheduled local notification is handed to the platform (AlarmManager on Android with
 * allowWhileIdle), so it fires even if the app is backgrounded or fully closed.
 */
async function scheduleNotification(title: string, body: string, tag: string) {
  const id = notifId(tag);
  const at = new Date(Date.now() + 5000);

  if (isNative()) {
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          channelId: NOTIF_CHANNEL_ID,
          smallIcon: "ic_stat_icon_config_sample",
          schedule: { at, allowWhileIdle: true },
          extra: { tag },
        },
      ],
    });
    return;
  }

  // Web fallback: LocalNotifications' web implementation proxies to the browser
  // Notification API. It cannot fire while closed, but keeps PWA behaviour working.
  try {
    await LocalNotifications.schedule({
      notifications: [{ id, title, body, schedule: { at } }],
    });
  } catch {
    /* noop */
  }
}

export async function checkWashReminders(force = false) {
  if (typeof window === "undefined") return;
  const enabled = await getSetting<boolean>(NOTIF_ENABLED_KEY, false);
  if (!enabled) return;
  if (!notificationsSupported()) return;
  if ((await getNotificationPermission()) !== "granted") return;

  // Throttle to once every 6 hours unless forced
  const now = Date.now();
  const last = await getSetting<number>(NOTIF_LAST_KEY, 0);
  if (!force && now - last < 6 * 60 * 60 * 1000) return;
  await setSetting(NOTIF_LAST_KEY, now);

  const threshold = await getSetting<number>(NOTIF_THRESHOLD_KEY, 5);
  const items = await db().items.where("wearCount").aboveOrEqual(threshold).toArray();
  if (items.length === 0) return;

  const shown = await getSetting<Record<string, number>>(NOTIF_SHOWN_KEY, {});
  const day = 24 * 60 * 60 * 1000;
  const toShow = items.filter((i) => !shown[i.id] || now - shown[i.id] > 3 * day);
  if (toShow.length === 0) return;

  if (toShow.length === 1) {
    const it = toShow[0];
    await scheduleNotification(
      "זמן לכביסה 🧺",
      `הבגד "${it.name}" נלבש ${it.wearCount} פעמים — מומלץ לכבס`,
      `wash-${it.id}`,
    );
  } else {
    await scheduleNotification(
      "יש בגדים לכביסה 🧺",
      `${toShow.length} בגדים נלבשו יותר מ־${threshold} פעמים ומומלצים לכביסה`,
      `wash-multi`,
    );
  }

  const next = { ...shown };
  for (const it of toShow) next[it.id] = now;
  await setSetting(NOTIF_SHOWN_KEY, next);
}
