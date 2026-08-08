import { useEffect, useState } from 'react'
import { Avatar, Button } from './ui'
import { IconBattery, IconClose, IconHistory, IconRoute, IconWalk } from './Icons'
import { compassLabel, bearing, distance, formatDistance, formatSpeed, isStale, timeAgo } from '../lib/geo'
import { reverseGeocode } from '../lib/geocode'

/** The floating card that appears above the dock when a family member is selected. */
export default function MemberCard({
  member,
  selfLocation,
  trailShown,
  onClose,
  onRoute,
  onToggleTrail,
  onOpenExternal,
}) {
  const [address, setAddress] = useState(null)

  useEffect(() => {
    let alive = true
    setAddress(null)
    if (!member) return undefined
    const controller = new AbortController()
    reverseGeocode(member.lat, member.lng, controller.signal).then((result) => {
      if (alive) setAddress(result?.short || null)
    })
    return () => {
      alive = false
      controller.abort()
    }
  }, [member?.id, member && Math.round(member.lat * 2000), member && Math.round(member.lng * 2000)])

  if (!member) return null

  const away = selfLocation ? distance(selfLocation, member) : null
  const direction = selfLocation ? compassLabel(bearing(selfLocation, member)) : null
  const speed = formatSpeed(member.speed)
  const stale = isStale(member)

  return (
    <div className="glass-strong animate-sheet-in mx-3 mb-2 rounded-3xl p-4 shadow-float">
      <div className="flex items-start gap-3.5">
        <Avatar member={member} size={54} dimmed={stale} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[18px] font-extrabold text-white">{member.name}</h3>
            {member.isSelf && (
              <span className="shrink-0 rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-black text-sky-400">
                אני
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-[13px] text-white/55">
            {address || (stale ? 'המיקום לא עודכן לאחרונה' : 'מאתרים כתובת…')}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-white/45">
            <span>{timeAgo(member.updatedAt)}</span>
            {away != null && !member.isSelf && (
              <span>
                {formatDistance(away)} · {direction}
              </span>
            )}
            {speed && (
              <span className="flex items-center gap-1">
                <IconWalk size={13} /> {speed}
              </span>
            )}
            {typeof member.battery === 'number' && (
              <span
                className={`flex items-center gap-1 ${member.battery <= 0.2 ? 'text-rose-400' : ''}`}
              >
                <IconBattery size={16} level={member.battery} charging={member.charging} />
                {Math.round(member.battery * 100)}%
              </span>
            )}
          </div>
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

      {!member.isSelf && (
        <div className="mt-3.5 flex gap-2">
          <Button onClick={onRoute} className="flex-1 !py-2.5 !text-[14px]">
            <span className="flex items-center justify-center gap-1.5">
              <IconRoute size={17} /> מסלול
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={onToggleTrail}
            className={`!py-2.5 !text-[14px] ${trailShown ? '!bg-brand-500/25 !text-brand-400' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <IconHistory size={17} /> מסלול היום
            </span>
          </Button>
          <Button variant="ghost" onClick={onOpenExternal} className="!px-3 !py-2.5 !text-[14px]">
            ניווט
          </Button>
        </div>
      )}
    </div>
  )
}
