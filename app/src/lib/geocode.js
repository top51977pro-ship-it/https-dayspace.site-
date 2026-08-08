// Geocoding via OpenStreetMap Nominatim — free and key-less.
// The public instance asks for light, cached, rate-limited use, so we do all three.

const ENDPOINT = 'https://nominatim.openstreetmap.org'
const LANG = 'he,en'

const searchCache = new Map()
const reverseCache = new Map()
let lastCallAt = 0

/** Nominatim asks for max 1 request/second. */
async function throttle() {
  const wait = 1100 - (Date.now() - lastCallAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

async function getJSON(url, signal) {
  await throttle()
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json', 'Accept-Language': LANG },
  })
  if (!res.ok) throw new Error(`geocode ${res.status}`)
  return res.json()
}

/**
 * Free-text place search.
 * @param {string} query
 * @param {{lat:number,lng:number}} [near] biases results toward the user
 */
export async function searchPlaces(query, near, signal) {
  const q = query.trim()
  if (q.length < 2) return []

  const key = `${q}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`
  if (searchCache.has(key)) return searchCache.get(key)

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    'accept-language': LANG,
  })
  if (near) {
    // A ~1.5° box around the user, so nearby hits float to the top.
    const d = 1.5
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','))
    params.set('bounded', '0')
  }

  const raw = await getJSON(`${ENDPOINT}/search?${params}`, signal)
  const results = raw.map((r) => ({
    id: `${r.osm_type || 'n'}${r.osm_id || r.place_id}`,
    name: primaryName(r),
    address: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    category: r.category,
    type: r.type,
  }))
  searchCache.set(key, results)
  return results
}

/** Coordinates → a short human address. Returns null rather than throwing. */
export async function reverseGeocode(lat, lng, signal) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  if (reverseCache.has(key)) return reverseCache.get(key)

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
      'accept-language': LANG,
    })
    const r = await getJSON(`${ENDPOINT}/reverse?${params}`, signal)
    const a = r.address || {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.suburb || a.municipality
    const short = [street || a.neighbourhood, city].filter(Boolean).join(', ') || r.display_name
    const value = { short: short || null, full: r.display_name || null }
    reverseCache.set(key, value)
    return value
  } catch {
    return null
  }
}

function primaryName(r) {
  if (r.name) return r.name
  const parts = String(r.display_name || '').split(',')
  return parts[0]?.trim() || 'מיקום'
}

const CATEGORY_EMOJI = {
  amenity: '📍',
  shop: '🛍️',
  school: '🏫',
  college: '🎓',
  university: '🎓',
  hospital: '🏥',
  pharmacy: '💊',
  restaurant: '🍽️',
  cafe: '☕',
  fuel: '⛽',
  supermarket: '🛒',
  park: '🌳',
  place_of_worship: '🕍',
  bank: '🏦',
  hotel: '🏨',
  bus_stop: '🚌',
  station: '🚉',
  highway: '🛣️',
  building: '🏢',
  house: '🏠',
  residential: '🏠',
  city: '🏙️',
  town: '🏙️',
  village: '🏘️',
}

export function placeEmoji(result) {
  return CATEGORY_EMOJI[result?.type] || CATEGORY_EMOJI[result?.category] || '📍'
}
