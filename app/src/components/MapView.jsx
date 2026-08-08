import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { isStale } from '../lib/geo'

const RETINA = L.Browser.retina ? '@2x' : ''

export const MAP_LAYERS = {
  streets: {
    label: 'מפה',
    emoji: '🗺️',
    dark: false,
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}${RETINA}.png`,
    attribution: '© OpenStreetMap · © CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  dark: {
    label: 'לילה',
    emoji: '🌙',
    dark: true,
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}${RETINA}.png`,
    attribution: '© OpenStreetMap · © CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  satellite: {
    label: 'לוויין',
    emoji: '🛰️',
    dark: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    subdomains: '',
    maxZoom: 19,
  },
  classic: {
    label: 'קלאסי',
    emoji: '🧭',
    dark: false,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
}

const DEFAULT_VIEW = { center: [32.0853, 34.7818], zoom: 13 }

function memberIcon(member, { selected, stale }) {
  const battery =
    typeof member.battery === 'number' && member.battery <= 0.2
      ? `<span class="member-pin__badge">${Math.round(member.battery * 100)}</span>`
      : ''
  const classes = [
    'member-pin',
    selected ? 'member-pin--selected' : '',
    stale ? 'member-pin--stale' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return L.divIcon({
    className: '',
    html: `
      <div class="${classes}" style="--pin-color:${member.color || '#6D5EF6'}">
        <div class="member-pin__tail"></div>
        <div class="member-pin__bubble">${member.emoji || '🙂'}${battery}</div>
        <div class="member-pin__label">${escapeHtml(shortName(member.name))}</div>
      </div>`,
    iconSize: [54, 66],
    iconAnchor: [27, 62],
  })
}

const placeIcon = (place) =>
  L.divIcon({
    className: '',
    html: `<div class="place-pin">${place.emoji || '📍'}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })

const searchIcon = L.divIcon({
  className: '',
  html: '<div class="search-pin">📌</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

function selfIcon(heading) {
  const cone =
    heading == null
      ? ''
      : `<div class="self-cone" style="rotate:${heading}deg"></div>`
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:grid;place-items:center;width:22px;height:22px">${cone}<div class="self-dot"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function shortName(name = '') {
  return name.length > 10 ? `${name.slice(0, 9)}…` : name
}

function escapeHtml(str = '') {
  return str.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

export default function MapView({
  members,
  places,
  trails,
  selfLocation,
  selfHeading,
  selectedId,
  layer = 'streets',
  route,
  searchPin,
  showTrailFor,
  onSelectMember,
  onSelectPlace,
  onLongPress,
  onMapMove,
  onReady,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const markersRef = useRef(new Map())
  const placesRef = useRef(new Map())
  const selfRef = useRef({ marker: null, circle: null })
  const routeRef = useRef(null)
  const trailRef = useRef(null)
  const searchRef = useRef(null)
  const handlersRef = useRef({})

  handlersRef.current = { onSelectMember, onSelectPlace, onLongPress, onMapMove }

  /* ------------------------------------------------------------------ setup */

  useEffect(() => {
    if (mapRef.current) return undefined

    const map = L.map(containerRef.current, {
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      // A gentler wheel/pinch feel than Leaflet's default.
      wheelPxPerZoomLevel: 110,
      zoomSnap: 0.25,
      maxZoom: 20,
    })
    mapRef.current = map

    // Bottom-right so it never collides with the control column (which sits on the
    // inline-end edge — physically the left in this RTL layout).
    L.control.scale({ imperial: false, position: 'bottomright', maxWidth: 110 }).addTo(map)
    map.attributionControl.setPrefix('')

    // Long-press anywhere to drop a pin. Pointer events are used directly because
    // Leaflet's own tap-hold handler only runs on mobile Safari.
    const container = map.getContainer()
    let pressTimer = null
    let pressOrigin = null

    const clearPress = () => {
      clearTimeout(pressTimer)
      pressTimer = null
      pressOrigin = null
    }

    const firePress = (clientX, clientY) => {
      const point = map.mouseEventToLatLng({ clientX, clientY })
      handlersRef.current.onLongPress?.({ lat: point.lat, lng: point.lng })
    }

    const onPointerDown = (e) => {
      // Ignore presses that start on a marker or a control.
      if (e.target.closest('.leaflet-marker-icon, .leaflet-control')) return
      pressOrigin = { x: e.clientX, y: e.clientY }
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        pressTimer = null
        if (pressOrigin) firePress(pressOrigin.x, pressOrigin.y)
      }, 550)
    }

    const onPointerMove = (e) => {
      // A drag cancels the press.
      if (!pressOrigin) return
      if (Math.hypot(e.clientX - pressOrigin.x, e.clientY - pressOrigin.y) > 12) clearPress()
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', clearPress)
    container.addEventListener('pointercancel', clearPress)
    map.on('dragstart zoomstart movestart', clearPress)

    // Desktop right-click (and any browser that emits it on hold).
    map.on('contextmenu', (e) => {
      clearPress()
      handlersRef.current.onLongPress?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    map.on('click', () => handlersRef.current.onSelectMember?.(null))
    map.on('moveend zoomend', () => {
      handlersRef.current.onMapMove?.({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bounds: map.getBounds(),
      })
    })

    onReady?.({
      flyTo(point, zoom = 16) {
        map.flyTo([point.lat, point.lng], Math.max(zoom, map.getZoom() >= zoom ? map.getZoom() : zoom), {
          duration: 0.85,
        })
      },
      fitBounds(bounds, options) {
        map.flyToBounds(bounds, { padding: [64, 190], maxZoom: 16, duration: 0.9, ...options })
      },
      panBy(x, y) {
        map.panBy([x, y], { animate: true })
      },
      zoomIn: () => map.zoomIn(1),
      zoomOut: () => map.zoomOut(1),
      resetNorth: () => map.setBearing?.(0),
      getCenter: () => map.getCenter(),
      getZoom: () => map.getZoom(),
      invalidate: () => map.invalidateSize(),
    })

    return () => {
      clearPress()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', clearPress)
      container.removeEventListener('pointercancel', clearPress)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------------------------------------- basemap */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const config = MAP_LAYERS[layer] || MAP_LAYERS.streets
    if (tileRef.current) map.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: config.subdomains || 'abc',
      maxZoom: config.maxZoom || 19,
      keepBuffer: 3,
    }).addTo(map)
    containerRef.current?.classList.toggle('map-theme-dark', config.dark)
  }, [layer])

  /* ------------------------------------------------------------- members */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const now = Date.now()
    const seen = new Set()

    for (const member of members) {
      if (!Number.isFinite(member.lat) || !Number.isFinite(member.lng)) continue
      if (member.isSelf) continue // drawn as the blue dot instead
      seen.add(member.id)

      const stale = isStale(member, now)
      const icon = memberIcon(member, { selected: member.id === selectedId, stale })
      const existing = markersRef.current.get(member.id)

      if (existing) {
        existing.setLatLng([member.lat, member.lng])
        existing.setIcon(icon)
      } else {
        const marker = L.marker([member.lat, member.lng], {
          icon,
          riseOnHover: true,
          zIndexOffset: 400,
        })
          .addTo(map)
          .on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            handlersRef.current.onSelectMember?.(member.id)
          })
        markersRef.current.set(member.id, marker)
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
      }
    }
  }, [members, selectedId])

  /* ---------------------------------------------------------------- self */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!selfLocation) {
      if (selfRef.current.marker) map.removeLayer(selfRef.current.marker)
      if (selfRef.current.circle) map.removeLayer(selfRef.current.circle)
      selfRef.current = { marker: null, circle: null }
      return
    }

    const position = [selfLocation.lat, selfLocation.lng]
    const heading = selfHeading ?? selfLocation.heading

    if (!selfRef.current.marker) {
      selfRef.current.marker = L.marker(position, {
        icon: selfIcon(heading),
        zIndexOffset: 900,
        interactive: false,
      }).addTo(map)
    } else {
      selfRef.current.marker.setLatLng(position)
      selfRef.current.marker.setIcon(selfIcon(heading))
    }

    const accuracy = selfLocation.accuracy
    if (accuracy && accuracy > 15) {
      if (!selfRef.current.circle) {
        selfRef.current.circle = L.circle(position, {
          radius: accuracy,
          color: '#46B8FF',
          weight: 1,
          opacity: 0.5,
          fillColor: '#46B8FF',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map)
      } else {
        selfRef.current.circle.setLatLng(position).setRadius(accuracy)
      }
    } else if (selfRef.current.circle) {
      map.removeLayer(selfRef.current.circle)
      selfRef.current.circle = null
    }
  }, [selfLocation, selfHeading])

  /* -------------------------------------------------------------- places */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set()

    for (const place of places) {
      seen.add(place.id)
      const existing = placesRef.current.get(place.id)
      if (existing) {
        existing.marker.setLatLng([place.lat, place.lng]).setIcon(placeIcon(place))
        existing.circle.setLatLng([place.lat, place.lng]).setRadius(place.radius || 150)
        continue
      }
      const circle = L.circle([place.lat, place.lng], {
        radius: place.radius || 150,
        color: '#37E0A6',
        weight: 1.5,
        opacity: 0.6,
        dashArray: '5 6',
        fillColor: '#37E0A6',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map)
      const marker = L.marker([place.lat, place.lng], { icon: placeIcon(place), zIndexOffset: 200 })
        .addTo(map)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          handlersRef.current.onSelectPlace?.(place)
        })
      placesRef.current.set(place.id, { marker, circle })
    }

    for (const [id, layers] of placesRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(layers.marker)
        map.removeLayer(layers.circle)
        placesRef.current.delete(id)
      }
    }
  }, [places])

  /* --------------------------------------------------------------- trail */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (trailRef.current) {
      map.removeLayer(trailRef.current)
      trailRef.current = null
    }
    const points = showTrailFor ? trails?.[showTrailFor] : null
    if (!points || points.length < 2) return

    const member = members.find((m) => m.id === showTrailFor)
    trailRef.current = L.polyline(
      points.map((p) => [p.lat, p.lng]),
      {
        color: member?.color || '#6D5EF6',
        weight: 4,
        opacity: 0.75,
        dashArray: '1 9',
        lineCap: 'round',
        interactive: false,
      },
    ).addTo(map)
  }, [showTrailFor, trails, members])

  /* --------------------------------------------------------------- route */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (routeRef.current) {
      routeRef.current.forEach((l) => map.removeLayer(l))
      routeRef.current = null
    }
    if (!route?.coords?.length) return

    const casing = L.polyline(route.coords, {
      color: '#0B1020',
      weight: 11,
      opacity: 0.55,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map)
    const line = L.polyline(route.coords, {
      color: '#46B8FF',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: route.approximate ? '10 12' : null,
      interactive: false,
    }).addTo(map)
    routeRef.current = [casing, line]

    map.flyToBounds(line.getBounds(), { padding: [60, 200], maxZoom: 16, duration: 0.9 })
  }, [route])

  /* ---------------------------------------------------------- search pin */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (searchRef.current) {
      map.removeLayer(searchRef.current)
      searchRef.current = null
    }
    if (!searchPin) return
    searchRef.current = L.marker([searchPin.lat, searchPin.lng], {
      icon: searchIcon,
      zIndexOffset: 800,
      interactive: false,
    }).addTo(map)
  }, [searchPin])

  return <div ref={containerRef} className="absolute inset-0" />
}
