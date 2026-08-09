import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useApp } from './state/AppContext'
import Onboarding from './components/Onboarding'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import FamilyDock from './components/FamilyDock'
import MemberCard from './components/MemberCard'
import FamilySheet from './components/FamilySheet'
import PlacesSheet from './components/PlacesSheet'
import ActivitySheet from './components/ActivitySheet'
import InviteSheet from './components/InviteSheet'
import SettingsSheet from './components/SettingsSheet'
import { DestinationCard, RouteBar } from './components/RoutePanel'
import { Toasts } from './components/ui'
import { IconLayers, IconLocate, IconSettings, IconSos, IconUsers } from './components/Icons'
import { boundsOf } from './lib/geo'
import { externalNavUrl, fetchRoute } from './lib/routing'
import { watchHeading } from './lib/location'
import { onInviteCode } from './lib/deeplink'
import { placeEmoji } from './lib/geocode'
import { isNative, tap } from './lib/device'
import { MAP_LAYERS } from './components/MapView'

export default function App() {
  const app = useApp()

  if (!app.ready) return <Splash />
  if (!app.profile || !app.circle) return <Onboarding />
  return <MapScreen />
}

function Splash() {
  return (
    <div className="grid h-full place-items-center bg-ink-950">
      <div className="animate-pop-in flex flex-col items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-brand-400 to-brand-600 text-4xl shadow-float">
          🧭
        </div>
        <p className="text-[15px] font-bold text-white/50">טוענים את המפה…</p>
      </div>
    </div>
  )
}

function MapScreen() {
  const {
    members,
    places,
    events,
    trails,
    circle,
    profile,
    settings,
    selfLocation,
    permission,
    locating,
    syncError,
    connection,
    toasts,
    mode,
    saveProfile,
    setSetting,
    addPlace,
    removePlace,
    leaveFamily,
    sendSOS,
    refreshLocation,
    pushToast,
    dismissToast,
  } = useApp()

  const mapApi = useRef(null)
  const dockRef = useRef(null)
  const [sheet, setSheet] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [destination, setDestination] = useState(null)
  const [placeDraft, setPlaceDraft] = useState(null)
  const [route, setRoute] = useState(null)
  const [routeTarget, setRouteTarget] = useState(null)
  const [routeProfile, setRouteProfile] = useState('drive')
  const [routeLoading, setRouteLoading] = useState(false)
  const [trailFor, setTrailFor] = useState(null)
  const [heading, setHeading] = useState(null)
  const [layerPickerOpen, setLayerPickerOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [seenEventTs, setSeenEventTs] = useState(() => Date.now())
  const routeAbort = useRef(null)

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId],
  )

  const unreadCount = useMemo(
    () => events.filter((e) => e.ts > seenEventTs).length,
    [events, seenEventTs],
  )

  /* ------------------------------------------------------------- platform */

  useEffect(() => {
    const stop = watchHeading(setHeading)
    return stop
  }, [])

  // Leaflet's bottom controls (scale, attribution) sit above whatever the dock needs.
  useEffect(() => {
    const node = dockRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--dock-height',
        `${Math.round(entry.contentRect.height) + 8}px`,
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // An invite link arrived while we are already in a family.
  useEffect(
    () =>
      onInviteCode((code) => {
        if (code === circle?.code) return
        pushToast(`קיבלתם הזמנה (${code}) — צאו מהמשפחה הנוכחית כדי להצטרף`, 'warn')
      }),
    [circle?.code, pushToast],
  )

  useEffect(() => {
    if (!isNative) return undefined
    let handle
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (sosOpen) setSosOpen(false)
      else if (layerPickerOpen) setLayerPickerOpen(false)
      else if (sheet) setSheet(null)
      else if (route) clearRoute()
      else if (destination) setDestination(null)
      else if (selectedId) setSelectedId(null)
      else if (!canGoBack) CapApp.exitApp()
    }).then((listener) => {
      handle = listener
    })
    return () => handle?.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, sosOpen, layerPickerOpen, route, destination, selectedId])

  /* -------------------------------------------------------------- camera */

  const focusPoint = useCallback((point, zoom = 16.5) => {
    mapApi.current?.flyTo(point, zoom)
  }, [])

  const fitEveryone = useCallback(() => {
    const bounds = boundsOf([...members, ...(selfLocation ? [selfLocation] : [])])
    if (bounds) mapApi.current?.fitBounds(bounds)
    else pushToast('אין עדיין מיקומים להצגה', 'warn')
  }, [members, selfLocation, pushToast])

  // Frame the family once, as soon as we have something to frame.
  const framedOnce = useRef(false)
  useEffect(() => {
    if (framedOnce.current || !mapApi.current) return
    const points = [...members, ...(selfLocation ? [selfLocation] : [])]
    if (!points.length) return
    framedOnce.current = true
    const bounds = boundsOf(points)
    if (bounds) mapApi.current.fitBounds(bounds)
  }, [members, selfLocation])

  const selectMember = useCallback(
    (id) => {
      setSelectedId(id)
      if (!id) return
      setDestination(null)
      const member = members.find((m) => m.id === id)
      if (member) focusPoint(member)
    },
    [members, focusPoint],
  )

  /* --------------------------------------------------------------- route */

  const clearRoute = useCallback(() => {
    routeAbort.current?.abort()
    setRoute(null)
    setRouteTarget(null)
    setRouteLoading(false)
  }, [])

  const buildRoute = useCallback(
    async (target, profileId = routeProfile) => {
      if (!selfLocation) {
        pushToast('צריך את המיקום שלכם כדי לחשב מסלול', 'warn')
        refreshLocation()
        return
      }
      routeAbort.current?.abort()
      const controller = new AbortController()
      routeAbort.current = controller

      setRouteTarget(target)
      setRouteLoading(true)
      setDestination(null)
      try {
        const result = await fetchRoute(selfLocation, target, profileId, controller.signal)
        setRoute(result)
      } catch (err) {
        if (err?.name !== 'AbortError') {
          pushToast('לא הצלחנו לחשב מסלול', 'warn')
          setRouteTarget(null)
        }
      } finally {
        setRouteLoading(false)
      }
    },
    [selfLocation, routeProfile, pushToast, refreshLocation],
  )

  const changeRouteProfile = useCallback(
    (profileId) => {
      setRouteProfile(profileId)
      if (routeTarget) buildRoute(routeTarget, profileId)
    },
    [routeTarget, buildRoute],
  )

  const openExternalNav = useCallback(
    async (target) => {
      const url = externalNavUrl(target, routeProfile)
      try {
        if (isNative) await Browser.open({ url })
        else window.open(url, '_blank', 'noopener')
      } catch {
        window.open(url, '_blank', 'noopener')
      }
    },
    [routeProfile],
  )

  /* ------------------------------------------------------------ handlers */

  const handleLongPress = useCallback((point) => {
    tap('medium')
    setSelectedId(null)
    setDestination({ ...point, name: 'נקודה על המפה' })
  }, [])

  const handleSearchPlace = useCallback(
    (result) => {
      const target = {
        lat: result.lat,
        lng: result.lng,
        name: result.name,
        address: result.address,
        emoji: placeEmoji(result),
      }
      setSelectedId(null)
      setDestination(target)
      focusPoint(target, 16)
    },
    [focusPoint],
  )

  const handleLocate = useCallback(async () => {
    const location = await refreshLocation()
    if (location) focusPoint(location, 17)
    else if (selfLocation) focusPoint(selfLocation, 17)
  }, [refreshLocation, focusPoint, selfLocation])

  const openSheet = useCallback((name) => {
    setSheet(name)
    if (name === 'activity') setSeenEventTs(Date.now())
  }, [])

  const layerConfig = MAP_LAYERS[settings.mapStyle] || MAP_LAYERS.streets

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <MapView
        members={members}
        places={places}
        trails={trails}
        selfLocation={selfLocation}
        selfHeading={heading}
        selectedId={selectedId}
        layer={settings.mapStyle}
        route={route}
        searchPin={destination}
        showTrailFor={trailFor}
        onSelectMember={selectMember}
        onSelectPlace={(place) => {
          setSelectedId(null)
          setDestination({ ...place, address: place.address })
        }}
        onLongPress={handleLongPress}
        onReady={(api) => {
          mapApi.current = api
        }}
      />

      {/* ---------------------------------------------------------- top */}
      <div className="pad-top pointer-events-none absolute inset-x-0 top-0 z-[900] px-3">
        <div className="pointer-events-auto flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              members={members}
              selfLocation={selfLocation}
              onPickPlace={handleSearchPlace}
              onPickMember={(member) => selectMember(member.id)}
            />
          </div>
          <MapChip onClick={() => openSheet('settings')} label="הגדרות">
            <IconSettings size={20} />
          </MapChip>
        </div>

        {mode === 'demo' ? (
          <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-2xl bg-sun-400/15 px-3 py-2 text-[11.5px] font-semibold text-sun-400 backdrop-blur">
            <span>🧪</span>
            <span>מצב הדגמה — בני המשפחה על המפה הם לדוגמה</span>
          </div>
        ) : connection === 'offline' ? (
          <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-2xl bg-rose-400/15 px-3 py-2 text-[11.5px] font-semibold text-rose-400 backdrop-blur">
            <span>📡</span>
            <span>אין חיבור — המיקומים לא מתעדכנים כרגע</span>
          </div>
        ) : connection === 'connecting' ? (
          <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2 text-[11.5px] font-semibold text-white/60 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sun-400" />
            <span>מתחבר למשפחה…</span>
          </div>
        ) : null}

        {permission === 'denied' && (
          <button
            type="button"
            onClick={handleLocate}
            className="pointer-events-auto mt-2 flex w-full items-center gap-2 rounded-2xl bg-rose-400/15 px-3 py-2 text-start text-[11.5px] font-semibold text-rose-400 backdrop-blur"
          >
            <span>📍</span>
            <span>אין הרשאת מיקום — הקישו לאישור מחדש</span>
          </button>
        )}

        {syncError && (
          <div className="pointer-events-auto mt-2 rounded-2xl bg-rose-400/15 px-3 py-2 text-[11.5px] font-semibold text-rose-400 backdrop-blur">
            בעיית סנכרון: {syncError}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- side */}
      <div
        className="pointer-events-none absolute end-3 z-[900] flex flex-col items-end gap-2.5"
        style={{ bottom: 'calc(var(--dock-height, 200px) + 0.75rem)' }}
      >
        <MapChip onClick={fitEveryone} label="כל המשפחה">
          <IconUsers size={20} />
        </MapChip>
        <div className="pointer-events-auto relative">
          <MapChip onClick={() => setLayerPickerOpen((v) => !v)} label="שכבות מפה" active={layerPickerOpen}>
            <IconLayers size={20} />
          </MapChip>
          {layerPickerOpen && (
            <div className="glass-strong animate-pop-in absolute end-14 bottom-0 w-40 overflow-hidden rounded-2xl shadow-float">
              {Object.entries(MAP_LAYERS).map(([id, config]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    tap()
                    setSetting('mapStyle', id)
                    setLayerPickerOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-start text-[14px] font-semibold transition active:bg-white/8 ${
                    settings.mapStyle === id ? 'bg-brand-500/25 text-white' : 'text-white/70'
                  }`}
                >
                  <span className="text-base">{config.emoji}</span>
                  {config.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapChip onClick={handleLocate} label="המיקום שלי" active={locating}>
          <IconLocate size={20} />
        </MapChip>
        <MapChip onClick={() => setSosOpen(true)} label="מצוקה" tone="danger">
          <IconSos size={20} />
        </MapChip>
      </div>

      {/* ------------------------------------------------------- bottom */}
      <div ref={dockRef} className="absolute inset-x-0 bottom-0 z-[950]">
        {route || routeLoading ? (
          <RouteBar
            route={route}
            target={routeTarget}
            profileId={routeProfile}
            loading={routeLoading}
            onProfile={changeRouteProfile}
            onClose={clearRoute}
            onNavigate={() => routeTarget && openExternalNav(routeTarget)}
          />
        ) : destination ? (
          <DestinationCard
            destination={destination}
            selfLocation={selfLocation}
            onClose={() => setDestination(null)}
            onRoute={() => buildRoute(destination)}
            onSavePlace={() => {
              setPlaceDraft(destination)
              openSheet('places')
            }}
            onNavigate={() => openExternalNav(destination)}
          />
        ) : selectedMember ? (
          <MemberCard
            member={selectedMember}
            selfLocation={selfLocation}
            trailShown={trailFor === selectedMember.id}
            onClose={() => setSelectedId(null)}
            onRoute={() => buildRoute({ ...selectedMember, name: selectedMember.name })}
            onToggleTrail={() =>
              setTrailFor((current) => (current === selectedMember.id ? null : selectedMember.id))
            }
            onOpenExternal={() => openExternalNav(selectedMember)}
          />
        ) : null}

        <FamilyDock
          members={members}
          selectedId={selectedId}
          unreadCount={unreadCount}
          onSelect={selectMember}
          onShowFamily={() => openSheet('family')}
          onShowPlaces={() => openSheet('places')}
          onShowActivity={() => openSheet('activity')}
          onShowInvite={() => openSheet('invite')}
        />
      </div>

      {/* -------------------------------------------------------- sheets */}
      <FamilySheet
        open={sheet === 'family'}
        onClose={() => setSheet(null)}
        members={members}
        places={places}
        selfLocation={selfLocation}
        circle={circle}
        onSelect={selectMember}
        onInvite={() => setSheet('invite')}
      />

      <PlacesSheet
        open={sheet === 'places'}
        onClose={() => setSheet(null)}
        places={places}
        members={members}
        selfLocation={selfLocation}
        draft={placeDraft}
        onClearDraft={() => setPlaceDraft(null)}
        onAdd={async (place) => {
          await addPlace(place)
          pushToast(`${place.emoji} ${place.name} נשמר`, 'success')
        }}
        onRemove={removePlace}
        onFocus={(place) => focusPoint(place, 16)}
      />

      <ActivitySheet
        open={sheet === 'activity'}
        onClose={() => setSheet(null)}
        events={events}
        onFocusEvent={(event) => {
          const place = places.find((p) => p.id === event.placeId)
          const target = place || (event.lat ? { lat: event.lat, lng: event.lng } : null)
          if (target) {
            focusPoint(target, 16)
            setSheet(null)
          }
        }}
      />

      <InviteSheet
        open={sheet === 'invite'}
        onClose={() => setSheet(null)}
        circle={circle}
        profile={profile}
        onToast={pushToast}
      />

      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        profile={profile}
        circle={circle}
        settings={settings}
        mode={mode}
        onSaveProfile={saveProfile}
        onSetSetting={setSetting}
        onLeave={leaveFamily}
      />

      {sosOpen && (
        <SosDialog
          onCancel={() => setSosOpen(false)}
          onConfirm={async () => {
            await sendSOS()
            setSosOpen(false)
          }}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function MapChip({ children, onClick, label, active, tone = 'glass' }) {
  const tones = {
    glass: 'glass text-white/85',
    danger: 'bg-rose-400 text-white animate-sos',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        tap()
        onClick?.()
      }}
      className={`pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-float transition active:scale-90 ${
        active ? 'ring-2 ring-brand-400/70' : ''
      } ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function SosDialog({ onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-[1400] grid place-items-center px-6">
      <button
        type="button"
        aria-label="ביטול"
        onClick={onCancel}
        className="absolute inset-0 animate-fade-in bg-black/65"
      />
      <div className="glass-strong animate-pop-in relative w-full max-w-sm rounded-3xl p-6 text-center shadow-float">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-400/20 text-3xl">
          🆘
        </div>
        <h2 className="mt-4 text-[21px] font-black text-white">לשלוח קריאת מצוקה?</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">
          כל בני המשפחה יקבלו התראה מיידית עם המיקום המדויק שלכם.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-white/8 py-3 text-[15px] font-bold text-white/80 active:scale-95"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm()
            }}
            className="flex-[1.4] rounded-2xl bg-rose-400 py-3 text-[15px] font-black text-white shadow-float active:scale-95 disabled:opacity-60"
          >
            {busy ? 'שולחים…' : 'שליחה'}
          </button>
        </div>
      </div>
    </div>
  )
}
