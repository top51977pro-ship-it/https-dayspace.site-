import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './device'

let permission = null

export async function ensureNotificationPermission() {
  if (!isNative) return false
  if (permission !== null) return permission
  try {
    const status = await LocalNotifications.checkPermissions()
    let granted = status.display === 'granted'
    if (!granted) {
      const asked = await LocalNotifications.requestPermissions()
      granted = asked.display === 'granted'
    }
    permission = granted
  } catch {
    permission = false
  }
  return permission
}

/** Fires a system notification on device; a no-op in the browser. */
export async function notify(title, body) {
  if (!(await ensureNotificationPermission())) return
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          smallIcon: 'ic_stat_dayspace',
          iconColor: '#6D5EF6',
        },
      ],
    })
  } catch {
    /* notification failures should never break the app */
  }
}
