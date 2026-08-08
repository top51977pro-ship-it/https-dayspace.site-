import { Button } from './ui'
import { IconClose, IconPin, IconRoute } from './Icons'
import { formatDistance, formatDuration, distance } from '../lib/geo'
import { ROUTE_PROFILES } from '../lib/routing'
import { tap } from '../lib/device'

/** Card for a searched / long-pressed destination, before a route is drawn. */
export function DestinationCard({ destination: target, selfLocation, onClose, onRoute, onSavePlace, onNavigate }) {
  if (!target) return null
  const away = selfLocation ? distance(selfLocation, target) : null

  return (
    <div className="glass-strong animate-sheet-in mx-3 mb-2 rounded-3xl p-4 shadow-float">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8 text-xl">
          {target.emoji || '📌'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-extrabold text-white">
            {target.name || 'נקודה על המפה'}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/50">
            {target.address || `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`}
          </p>
          {away != null && (
            <p className="mt-1 text-[12px] font-semibold text-white/40">
              {formatDistance(away)} ממך
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 text-white/60 active:scale-90"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className="mt-3.5 flex gap-2">
        <Button onClick={onRoute} className="flex-1 !py-2.5 !text-[14px]">
          <span className="flex items-center justify-center gap-1.5">
            <IconRoute size={17} /> מסלול
          </span>
        </Button>
        <Button variant="ghost" onClick={onSavePlace} className="!py-2.5 !text-[14px]">
          <span className="flex items-center justify-center gap-1.5">
            <IconPin size={17} /> שמירה
          </span>
        </Button>
        <Button variant="ghost" onClick={onNavigate} className="!px-3 !py-2.5 !text-[14px]">
          ניווט
        </Button>
      </div>
    </div>
  )
}

/** Active-route summary with travel-mode switcher. */
export function RouteBar({ route, target, profileId, loading, onProfile, onClose, onNavigate }) {
  if (!route && !loading) return null

  return (
    <div className="glass-strong animate-sheet-in mx-3 mb-2 rounded-3xl p-4 shadow-float">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-white/45">
            מסלול אל {target?.name || 'היעד'}
          </p>
          {loading ? (
            <div className="skeleton mt-1.5 h-7 w-40 rounded-lg" />
          ) : (
            <p className="mt-0.5 text-[20px] font-black text-white">
              {formatDuration(route.seconds)}
              <span className="ms-2 text-[14px] font-bold text-white/50">
                {formatDistance(route.meters)}
              </span>
            </p>
          )}
          {route?.approximate && (
            <p className="mt-0.5 text-[11px] text-sun-400">הערכה בקו אווירי — שירות הניווט לא זמין</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירת מסלול"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-white/60 active:scale-90"
        >
          <IconClose size={17} />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {ROUTE_PROFILES.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => {
              tap()
              onProfile(profile.id)
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-[13px] font-bold transition active:scale-95 ${
              profileId === profile.id
                ? 'border-brand-400 bg-brand-500/20 text-white'
                : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <span>{profile.emoji}</span>
            {profile.label}
          </button>
        ))}
        <Button onClick={onNavigate} className="!px-4 !py-2.5 !text-[13.5px]">
          ניווט
        </Button>
      </div>
    </div>
  )
}
