import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { KEYS, loadJSON, removeKey, saveJSON } from '../lib/storage'
import { uid, pickColor, CODE_LENGTH, EMOJIS, normalizeCode } from '../lib/id'
import { distance, isStale } from '../lib/geo'
import { readBattery, tap } from '../lib/device'
import { getCurrentLocation, requestLocationPermission, watchLocation } from '../lib/location'
import { notify, ensureNotificationPermission } from '../lib/notify'
import { getProvider } from '../sync'

const AppContext = createContext(null)

export const DEFAULT_SETTINGS = {
  sharing: true, // publish my location to the family
  ghost: false, // temporarily invisible
  alerts: true, // arrival / departure notifications
  mapStyle: 'streets',
  showTraffic: false,
  trails: true, // keep a local movement trail
  keepScreenAwake: false,
}

const PUBLISH_INTERVAL_MS = 20_000
const TRAIL_MIN_MOVE_M = 25
const TRAIL_MAX_POINTS = 150
const EVENT_MAX = 120

export function AppProvider({ children }) {
  const provider = useMemo(() => getProvider(), [])

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [circle, setCircle] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const [remoteMembers, setRemoteMembers] = useState([])
  const [places, setPlaces] = useState([])
  const [remoteEvents, setRemoteEvents] = useState([])
  const [localEvents, setLocalEvents] = useState([])
  const [trails, setTrails] = useState({})

  const [selfLocation, setSelfLocation] = useState(null)
  const [permission, setPermission] = useState('prompt')
  const [locating, setLocating] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [backendSwitched, setBackendSwitched] = useState(false)
  const [connection, setConnection] = useState('connecting')
  const [toasts, setToasts] = useState([])

  const battery = useRef({ level: null, charging: null })
  const lastPublishAt = useRef(0)
  const placeOf = useRef({}) // memberId -> placeId, for geofence transitions
  const stopWatchRef = useRef(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  /* ---------------------------------------------------------------- bootstrap */

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [savedProfile, savedCircle, savedSettings, savedEvents, savedTrails] = await Promise.all(
        [
          loadJSON(KEYS.profile),
          loadJSON(KEYS.circle),
          loadJSON(KEYS.settings),
          loadJSON(KEYS.events, []),
          loadJSON(KEYS.trails, {}),
        ],
      )
      if (!alive) return
      if (savedProfile) setProfile(savedProfile)

      // A family created in demo mode does not exist in the cloud (and vice versa).
      // After a rebuild that flips the backend, drop it instead of showing an
      // empty map that never syncs.
      const staleBackend = savedCircle?.syncMode && savedCircle.syncMode !== provider.mode
      if (savedCircle && !staleBackend) {
        setCircle(savedCircle)
        setLocalEvents(savedEvents || [])
        setTrails(savedTrails || {})
      } else if (staleBackend) {
        await Promise.all([removeKey(KEYS.circle), removeKey(KEYS.events), removeKey(KEYS.trails)])
        setBackendSwitched(true)
      }

      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings })
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  /* ------------------------------------------------------------- persistence */

  useEffect(() => {
    if (ready && profile) saveJSON(KEYS.profile, profile)
  }, [ready, profile])

  useEffect(() => {
    if (ready) saveJSON(KEYS.settings, settings)
  }, [ready, settings])

  useEffect(() => {
    if (ready) saveJSON(KEYS.events, localEvents.slice(0, EVENT_MAX))
  }, [ready, localEvents])

  useEffect(() => {
    if (ready && settings.trails) saveJSON(KEYS.trails, trails)
  }, [ready, trails, settings.trails])

  /* ------------------------------------------------------------ subscription */

  useEffect(() => {
    if (!circle?.id) return undefined
    setSyncError(null)
    const unsubscribe = provider.subscribe(
      circle.id,
      (snapshot) => {
        setRemoteMembers(snapshot.members || [])
        setPlaces(snapshot.places || [])
        setRemoteEvents(snapshot.events || [])
        setSyncError(null)
        // Someone who joined by code only learns the family's real name once the
        // owner's retained "meta" message arrives.
        const name = snapshot.meta?.name
        if (name) {
          setCircle((current) =>
            current && current.name !== name ? { ...current, name } : current,
          )
        }
      },
      (err) => setSyncError(err?.message || 'שגיאת סנכרון'),
      (status) => setConnection(status),
    )
    return unsubscribe
  }, [provider, circle?.id])

  // Providers without a live socket (demo, firebase) are simply always "online".
  useEffect(() => {
    if (provider.mode !== 'mqtt') setConnection('online')
  }, [provider.mode])

  useEffect(() => {
    if (ready && circle) saveJSON(KEYS.circle, circle)
  }, [ready, circle])

  /* --------------------------------------------------------- location engine */

  const publish = useCallback(
    async (location, { force = false } = {}) => {
      if (!circle?.id || !profile) return
      const s = settingsRef.current
      if (!s.sharing || s.ghost) return
      if (!force && Date.now() - lastPublishAt.current < PUBLISH_INTERVAL_MS) return
      lastPublishAt.current = Date.now()
      try {
        await provider.publishMember(circle.id, {
          id: profile.id,
          name: profile.name,
          emoji: profile.emoji,
          color: profile.color,
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          heading: location.heading,
          speed: location.speed,
          battery: battery.current.level,
          charging: battery.current.charging,
          sharing: true,
          updatedAt: Date.now(),
        })
      } catch (err) {
        setSyncError(err?.message || 'לא הצלחנו לעדכן את המיקום')
      }
    },
    [provider, circle?.id, profile],
  )

  // The position watcher is started once, so it must not capture a stale `publish`
  // (which closes over the profile) — go through a ref instead.
  const publishRef = useRef(publish)
  publishRef.current = publish

  const handleLocation = useCallback((location) => {
    setSelfLocation(location)
    publishRef.current(location)
  }, [])

  const startTracking = useCallback(async () => {
    setLocating(true)
    const status = await requestLocationPermission()
    setPermission(status)
    if (status === 'denied') {
      setLocating(false)
      return status
    }
    try {
      const first = await getCurrentLocation()
      handleLocation(first)
      setPermission('granted')
    } catch {
      /* the watcher below may still succeed */
    }
    try {
      stopWatchRef.current?.()
      stopWatchRef.current = await watchLocation(handleLocation, () => {})
    } catch {
      /* watch unavailable */
    }
    setLocating(false)
    return status
  }, [handleLocation])

  useEffect(() => {
    if (!ready || !profile || !circle) return undefined
    startTracking()
    ensureNotificationPermission()
    const stopBattery = pollBattery(battery)
    return () => {
      stopBattery()
      stopWatchRef.current?.()
      stopWatchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile?.id, circle?.id])

  // A renamed / recoloured profile should reach the family right away.
  useEffect(() => {
    if (!circle?.id || !profile?.id || !selfLocation) return
    if (!settingsRef.current.sharing || settingsRef.current.ghost) return
    publish(selfLocation, { force: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name, profile?.emoji, profile?.color])

  // Ghost mode / sharing off should take effect immediately, not on next tick.
  useEffect(() => {
    if (!circle?.id || !profile?.id) return
    if (settings.ghost || !settings.sharing) {
      provider
        .publishMember(circle.id, { id: profile.id, sharing: false, updatedAt: Date.now() })
        .catch(() => {})
    } else if (selfLocation) {
      publish(selfLocation, { force: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.ghost, settings.sharing])

  /* ----------------------------------------------------------------- members */

  const members = useMemo(() => {
    const list = remoteMembers.filter((m) => m && Number.isFinite(m.lat) && Number.isFinite(m.lng))
    if (!profile) return list

    const selfFromServer = list.find((m) => m.id === profile.id)
    const selfEntry = {
      ...selfFromServer,
      id: profile.id,
      name: profile.name,
      emoji: profile.emoji,
      color: profile.color,
      isSelf: true,
      sharing: settings.sharing && !settings.ghost,
      battery: battery.current.level ?? selfFromServer?.battery ?? null,
      charging: battery.current.charging ?? selfFromServer?.charging ?? null,
      ...(selfLocation
        ? {
            lat: selfLocation.lat,
            lng: selfLocation.lng,
            accuracy: selfLocation.accuracy,
            heading: selfLocation.heading,
            speed: selfLocation.speed,
            updatedAt: Date.now(),
          }
        : {}),
    }

    const others = list.filter((m) => m.id !== profile.id)
    const hasSelfPosition = Number.isFinite(selfEntry.lat) && Number.isFinite(selfEntry.lng)
    return hasSelfPosition ? [selfEntry, ...others] : others
  }, [remoteMembers, profile, selfLocation, settings.sharing, settings.ghost])

  /* -------------------------------------------------- geofences & activity */

  const addLocalEvent = useCallback((event) => {
    setLocalEvents((prev) => [event, ...prev].slice(0, EVENT_MAX))
  }, [])

  useEffect(() => {
    if (!places.length || !members.length) return
    const alerts = settingsRef.current.alerts

    for (const member of members) {
      if (isStale(member)) continue
      const inside = places.find((p) => (distance(member, p) ?? Infinity) <= (p.radius || 150))
      const previous = placeOf.current[member.id]
      const currentId = inside?.id || null

      // First sighting only seeds the baseline — we do not announce it.
      if (previous === undefined) {
        placeOf.current[member.id] = currentId
        continue
      }
      if (previous === currentId) continue
      placeOf.current[member.id] = currentId

      if (currentId) {
        const event = {
          id: uid('ev'),
          type: 'arrive',
          memberId: member.id,
          memberName: member.name,
          memberEmoji: member.emoji,
          placeId: inside.id,
          placeName: inside.name,
          placeEmoji: inside.emoji,
          ts: Date.now(),
        }
        addLocalEvent(event)
        if (alerts && !member.isSelf) notify('הגעה', `${member.name} הגיע/ה ל${inside.name}`)
      } else {
        const left = places.find((p) => p.id === previous)
        if (!left) continue
        const event = {
          id: uid('ev'),
          type: 'leave',
          memberId: member.id,
          memberName: member.name,
          memberEmoji: member.emoji,
          placeId: left.id,
          placeName: left.name,
          placeEmoji: left.emoji,
          ts: Date.now(),
        }
        addLocalEvent(event)
        if (alerts && !member.isSelf) notify('יציאה', `${member.name} יצא/ה מ${left.name}`)
      }
    }
  }, [members, places, addLocalEvent])

  // Surface SOS alerts raised by other people in the circle.
  const seenSos = useRef(new Set())
  useEffect(() => {
    for (const event of remoteEvents) {
      if (event?.type !== 'sos' || seenSos.current.has(event.id)) continue
      seenSos.current.add(event.id)
      if (Date.now() - event.ts > 10 * 60 * 1000) continue // stale on first load
      if (event.memberId === profile?.id) continue
      notify('🆘 קריאת מצוקה', `${event.memberName} צריך/ה עזרה!`)
      pushToast(`🆘 ${event.memberName} שלח/ה קריאת מצוקה`, 'danger')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteEvents, profile?.id])

  /* ------------------------------------------------------------------ trails */

  useEffect(() => {
    if (!settings.trails || !members.length) return
    setTrails((prev) => {
      let changed = false
      const next = { ...prev }
      for (const member of members) {
        const points = next[member.id] || []
        const last = points[points.length - 1]
        if (last && (distance(last, member) ?? 0) < TRAIL_MIN_MOVE_M) continue
        next[member.id] = [...points, { lat: member.lat, lng: member.lng, ts: member.updatedAt }]
          .slice(-TRAIL_MAX_POINTS)
        changed = true
      }
      return changed ? next : prev
    })
  }, [members, settings.trails])

  /* ------------------------------------------------------------------ toasts */

  const pushToast = useCallback((message, tone = 'default') => {
    const id = uid('toast')
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /* ----------------------------------------------------------------- actions */

  const saveProfile = useCallback((patch) => {
    setProfile((prev) => {
      const base = prev || {
        id: uid('me'),
        emoji: EMOJIS[0],
        color: pickColor(String(Date.now())),
        createdAt: Date.now(),
      }
      return { ...base, ...patch }
    })
  }, [])

  const createFamily = useCallback(
    async (name, profilePatch) => {
      const backendId = await provider.identity?.()
      const nextProfile = {
        createdAt: profile?.createdAt || Date.now(),
        ...profile,
        ...profilePatch,
        id: backendId || profile?.id || uid('me'),
      }
      setProfile(nextProfile)
      await saveJSON(KEYS.profile, nextProfile)
      const created = { ...(await provider.createCircle({ name, profile: nextProfile })), syncMode: provider.mode }
      await registerMembership(provider, created.id, nextProfile)
      setCircle(created)
      await saveJSON(KEYS.circle, created)
      return created
    },
    [provider, profile],
  )

  const joinFamily = useCallback(
    async (rawCode, profilePatch) => {
      const code = normalizeCode(rawCode)
      if (code.length < CODE_LENGTH) {
        const err = new Error('code-too-short')
        err.code = 'code-too-short'
        throw err
      }
      const backendId = await provider.identity?.()
      const nextProfile = {
        createdAt: profile?.createdAt || Date.now(),
        ...profile,
        ...profilePatch,
        id: backendId || profile?.id || uid('me'),
      }
      setProfile(nextProfile)
      await saveJSON(KEYS.profile, nextProfile)
      const joined = { ...(await provider.joinCircle(code, nextProfile)), syncMode: provider.mode }
      // Claim membership before anything else — the database rules read it.
      await registerMembership(provider, joined.id, nextProfile)
      setCircle(joined)
      await saveJSON(KEYS.circle, joined)
      await provider.pushEvent(joined.id, {
        id: uid('ev'),
        type: 'join',
        memberId: nextProfile.id,
        memberName: nextProfile.name,
        memberEmoji: nextProfile.emoji,
        ts: Date.now(),
      })
      return joined
    },
    [provider, profile],
  )

  const leaveFamily = useCallback(async () => {
    if (circle?.id && profile?.id) {
      try {
        await provider.leave(circle.id, profile.id)
      } catch {
        /* leaving locally is what matters */
      }
    }
    stopWatchRef.current?.()
    stopWatchRef.current = null
    placeOf.current = {}
    setCircle(null)
    setRemoteMembers([])
    setPlaces([])
    setRemoteEvents([])
    setLocalEvents([])
    setTrails({})
    await Promise.all([removeKey(KEYS.circle), removeKey(KEYS.events), removeKey(KEYS.trails)])
    await provider.reset?.()
  }, [provider, circle?.id, profile?.id])

  const addPlace = useCallback(
    async (place) => {
      if (!circle?.id) return null
      const record = {
        id: place.id || uid('place'),
        name: place.name?.trim() || 'מקום חדש',
        emoji: place.emoji || '📍',
        lat: place.lat,
        lng: place.lng,
        radius: place.radius || 150,
        address: place.address || null,
        createdAt: place.createdAt || Date.now(),
      }
      await provider.savePlace(circle.id, record)
      return record
    },
    [provider, circle?.id],
  )

  const removePlace = useCallback(
    async (placeId) => {
      if (!circle?.id) return
      await provider.deletePlace(circle.id, placeId)
      delete placeOf.current[placeId]
    },
    [provider, circle?.id],
  )

  const sendSOS = useCallback(async () => {
    if (!circle?.id || !profile) return
    let location = selfLocation
    if (!location) {
      try {
        location = await getCurrentLocation()
        setSelfLocation(location)
      } catch {
        /* send the alert regardless */
      }
    }
    const event = {
      id: uid('ev'),
      type: 'sos',
      memberId: profile.id,
      memberName: profile.name,
      memberEmoji: profile.emoji,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      ts: Date.now(),
    }
    seenSos.current.add(event.id)
    await provider.pushEvent(circle.id, event)
    if (location) await publish(location, { force: true })
    addLocalEvent(event)
    tap('heavy')
    pushToast('קריאת המצוקה נשלחה למשפחה', 'danger')
  }, [provider, circle?.id, profile, selfLocation, publish, addLocalEvent, pushToast])

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const refreshLocation = useCallback(async () => {
    setLocating(true)
    try {
      const location = await getCurrentLocation()
      handleLocation(location)
      setPermission('granted')
      return location
    } catch {
      const status = await requestLocationPermission()
      setPermission(status)
      if (status === 'denied') pushToast('אין הרשאת מיקום — בדקו בהגדרות המכשיר', 'warn')
      return null
    } finally {
      setLocating(false)
    }
  }, [handleLocation, pushToast])

  /* ------------------------------------------------------------------ merged */

  const events = useMemo(() => {
    const byId = new Map()
    for (const event of [...localEvents, ...remoteEvents]) {
      if (event?.id) byId.set(event.id, event)
    }
    return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, EVENT_MAX)
  }, [localEvents, remoteEvents])

  const value = {
    ready,
    mode: provider.mode,
    profile,
    circle,
    settings,
    members,
    places,
    events,
    trails,
    selfLocation,
    permission,
    locating,
    syncError,
    connection,
    backendSwitched,
    toasts,
    // actions
    saveProfile,
    createFamily,
    joinFamily,
    leaveFamily,
    addPlace,
    removePlace,
    sendSOS,
    setSetting,
    refreshLocation,
    startTracking,
    pushToast,
    dismissToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/**
 * Write the member record straight after creating or joining, so the circle has a
 * membership entry even before the first GPS fix lands.
 */
async function registerMembership(provider, circleId, profile) {
  await provider.publishMember(circleId, {
    id: profile.id,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

/** Keep the cached battery reading fresh for outgoing location updates. */
function pollBattery(ref) {
  let alive = true
  const read = async () => {
    const info = await readBattery()
    if (alive) ref.current = info
  }
  read()
  const timer = setInterval(read, 60_000)
  return () => {
    alive = false
    clearInterval(timer)
  }
}
