import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

// On device we use Capacitor Preferences (survives WebView data clears better than
// localStorage); in the browser we fall back to localStorage so `npm run dev` works.
const native = Capacitor.isNativePlatform()

export async function loadJSON(key, fallback = null) {
  try {
    const raw = native
      ? (await Preferences.get({ key })).value
      : globalThis.localStorage?.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function saveJSON(key, value) {
  const raw = JSON.stringify(value)
  try {
    if (native) await Preferences.set({ key, value: raw })
    else globalThis.localStorage?.setItem(key, raw)
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export async function removeKey(key) {
  try {
    if (native) await Preferences.remove({ key })
    else globalThis.localStorage?.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  profile: 'ds.profile',
  circle: 'ds.circle',
  settings: 'ds.settings',
  places: 'ds.places',
  events: 'ds.events',
  trails: 'ds.trails',
  demoState: 'ds.demo',
}
