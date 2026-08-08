import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export const isNative = Capacitor.isNativePlatform()

/** { level: 0..1 | null, charging: bool | null } — works on device and on Chrome. */
export async function readBattery() {
  try {
    if (isNative) {
      const info = await Device.getBatteryInfo()
      return {
        level: typeof info.batteryLevel === 'number' ? info.batteryLevel : null,
        charging: typeof info.isCharging === 'boolean' ? info.isCharging : null,
      }
    }
    if (navigator.getBattery) {
      const b = await navigator.getBattery()
      return { level: b.level, charging: b.charging }
    }
  } catch {
    /* battery info is best-effort */
  }
  return { level: null, charging: null }
}

export async function tap(style = 'light') {
  try {
    if (!isNative) return
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Light })
  } catch {
    /* haptics unsupported */
  }
}

export async function deviceName() {
  try {
    const info = await Device.getInfo()
    return info.name || info.model || null
  } catch {
    return null
  }
}
