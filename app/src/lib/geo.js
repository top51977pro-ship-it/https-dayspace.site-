const R = 6371000 // earth radius, meters

const toRad = (deg) => (deg * Math.PI) / 180
const toDeg = (rad) => (rad * 180) / Math.PI

/** Great-circle distance between two {lat,lng} points, in meters. */
export function distance(a, b) {
  if (!a || !b) return null
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing from a to b, in degrees clockwise from north. */
export function bearing(a, b) {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Move a point by `meters` along `deg` bearing. Used by the demo simulator. */
export function destination(point, meters, deg) {
  const d = meters / R
  const brng = toRad(deg)
  const lat1 = toRad(point.lat)
  const lng1 = toRad(point.lng)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 }
}

const COMPASS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב']

export function compassLabel(deg) {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '—'
  if (meters < 950) return `${Math.round(meters / 10) * 10} מ׳`
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} ק״מ`
  return `${Math.round(meters / 1000)} ק״מ`
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const mins = Math.round(seconds / 60)
  if (mins < 1) return 'פחות מדקה'
  if (mins < 60) return `${mins} דק׳`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hours} ש׳ ${rest} דק׳` : `${hours} שעות`
}

export function formatSpeed(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond < 0.6) return null
  return `${Math.round(metersPerSecond * 3.6)} קמ״ש`
}

/** Human "time ago" in Hebrew. */
export function timeAgo(ts, now = Date.now()) {
  if (!ts) return 'לא ידוע'
  const diff = Math.max(0, now - ts)
  const secs = Math.round(diff / 1000)
  if (secs < 45) return 'עכשיו'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `לפני ${mins} דק׳`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `לפני ${hours} ש׳`
  const days = Math.round(hours / 24)
  if (days === 1) return 'אתמול'
  if (days < 7) return `לפני ${days} ימים`
  return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
}

export function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

/** A location older than this is drawn as "stale". */
export const STALE_AFTER_MS = 12 * 60 * 1000

export function isStale(member, now = Date.now()) {
  return !member?.updatedAt || now - member.updatedAt > STALE_AFTER_MS
}

/** Bounds that fit every point, with a little breathing room. */
export function boundsOf(points) {
  const valid = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!valid.length) return null
  let minLat = 90
  let maxLat = -90
  let minLng = 180
  let maxLng = -180
  for (const p of valid) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
