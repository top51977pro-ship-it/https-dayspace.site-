import { Geolocation } from '@capacitor/geolocation'
import { isNative } from './device'

/**
 * Ask for location permission.
 * @returns {'granted'|'denied'|'prompt'}
 */
export async function requestLocationPermission() {
  try {
    if (isNative) {
      const current = await Geolocation.checkPermissions()
      if (current.location === 'granted' || current.coarseLocation === 'granted') return 'granted'
      const asked = await Geolocation.requestPermissions({ permissions: ['location'] })
      return asked.location === 'granted' || asked.coarseLocation === 'granted'
        ? 'granted'
        : 'denied'
    }
    if (!navigator.geolocation) return 'denied'
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      return status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt'
    }
    return 'prompt'
  } catch {
    return 'denied'
  }
}

const OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }

function normalize(position) {
  const c = position.coords
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy ?? null,
    heading: Number.isFinite(c.heading) ? c.heading : null,
    speed: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
    altitude: Number.isFinite(c.altitude) ? c.altitude : null,
    timestamp: position.timestamp || Date.now(),
  }
}

export async function getCurrentLocation() {
  const position = await Geolocation.getCurrentPosition(OPTIONS)
  return normalize(position)
}

/**
 * Continuous position updates.
 * @returns {Promise<() => void>} stop function
 */
export async function watchLocation(onUpdate, onError) {
  const id = await Geolocation.watchPosition(OPTIONS, (position, err) => {
    if (err) {
      onError?.(err)
      return
    }
    if (position) onUpdate(normalize(position))
  })
  return () => {
    Geolocation.clearWatch({ id }).catch(() => {})
  }
}

/**
 * Device compass heading (degrees from north), for rotating the "you" cone.
 * @returns {() => void} stop function
 */
export function watchHeading(onHeading) {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return () => {}

  const handler = (event) => {
    // iOS exposes webkitCompassHeading; Android reports alpha counter-clockwise.
    const heading = Number.isFinite(event.webkitCompassHeading)
      ? event.webkitCompassHeading
      : Number.isFinite(event.alpha)
        ? (360 - event.alpha) % 360
        : null
    if (heading != null) onHeading(heading)
  }

  const start = () => {
    window.addEventListener('deviceorientationabsolute', handler, true)
    window.addEventListener('deviceorientation', handler, true)
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((res) => res === 'granted' && start())
      .catch(() => {})
  } else {
    start()
  }

  return () => {
    window.removeEventListener('deviceorientationabsolute', handler, true)
    window.removeEventListener('deviceorientation', handler, true)
  }
}
