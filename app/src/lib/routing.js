// Routing via the public OSRM demo server (key-less). If it is unreachable we fall
// back to a straight line + a rough ETA so the UI still has something to show.

import { distance } from './geo'

const OSRM = 'https://router.project-osrm.org/route/v1'

const PROFILES = {
  drive: { osrm: 'driving', label: 'נסיעה', emoji: '🚗', fallbackSpeed: 11.1 }, // ~40 km/h
  walk: { osrm: 'walking', label: 'הליכה', emoji: '🚶', fallbackSpeed: 1.35 },
  bike: { osrm: 'cycling', label: 'אופניים', emoji: '🚴', fallbackSpeed: 4.2 },
}

export const ROUTE_PROFILES = Object.entries(PROFILES).map(([id, p]) => ({
  id,
  label: p.label,
  emoji: p.emoji,
}))

/**
 * @returns {{coords:[number,number][], meters:number, seconds:number, approximate:boolean}}
 */
export async function fetchRoute(from, to, profileId = 'drive', signal) {
  const profile = PROFILES[profileId] || PROFILES.drive
  const coordsParam = `${from.lng},${from.lat};${to.lng},${to.lat}`

  try {
    const res = await fetch(
      `${OSRM}/${profile.osrm}/${coordsParam}?overview=full&geometries=geojson&alternatives=false&steps=false`,
      { signal },
    )
    if (!res.ok) throw new Error(`osrm ${res.status}`)
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) throw new Error('no route')
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      meters: route.distance,
      seconds: route.duration,
      approximate: false,
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const meters = distance(from, to)
    return {
      coords: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      // Straight-line distance under-reports road distance; 1.35 is a decent fudge.
      meters: meters * 1.35,
      seconds: (meters * 1.35) / profile.fallbackSpeed,
      approximate: true,
    }
  }
}

/** Hand off to whatever navigation app the phone has. */
export function externalNavUrl(to, profileId = 'drive') {
  const mode = { drive: 'driving', walk: 'walking', bike: 'bicycling' }[profileId] || 'driving'
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${mode}`
}
