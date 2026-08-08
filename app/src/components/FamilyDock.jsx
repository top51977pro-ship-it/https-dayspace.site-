import { Avatar } from './ui'
import { IconBell, IconPin, IconShare, IconUsers } from './Icons'
import { isStale, timeAgo } from '../lib/geo'
import { tap } from '../lib/device'

export default function FamilyDock({
  members,
  selectedId,
  unreadCount,
  onSelect,
  onShowFamily,
  onShowPlaces,
  onShowActivity,
  onShowInvite,
}) {
  const now = Date.now()

  const tabs = [
    { id: 'family', label: 'משפחה', icon: <IconUsers size={19} />, onClick: onShowFamily },
    { id: 'places', label: 'מקומות', icon: <IconPin size={19} />, onClick: onShowPlaces },
    {
      id: 'activity',
      label: 'פעילות',
      icon: <IconBell size={19} />,
      onClick: onShowActivity,
      badge: unreadCount,
    },
    { id: 'invite', label: 'הזמנה', icon: <IconShare size={19} />, onClick: onShowInvite },
  ]

  return (
    <div className="glass-strong pad-bottom rounded-t-[28px] px-3 pt-3 shadow-float">
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-3">
        {members.length === 0 && (
          <p className="w-full py-3 text-center text-[13px] text-white/40">
            עדיין אין מיקומים — הזמינו את המשפחה 👋
          </p>
        )}

        {members.map((member) => {
          const stale = isStale(member, now)
          const selected = member.id === selectedId
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                tap()
                onSelect(member.id)
              }}
              className={`flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition active:scale-95 ${
                selected ? 'bg-white/10' : ''
              }`}
            >
              <span className="relative">
                <Avatar member={member} size={46} dimmed={stale || member.sharing === false} />
                {member.isSelf && (
                  <span className="absolute -bottom-0.5 -start-0.5 rounded-full bg-sky-400 px-1.5 text-[9px] font-black text-ink-950">
                    אני
                  </span>
                )}
                {!stale && member.sharing !== false && (
                  <span className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-mint-400" />
                )}
              </span>
              <span className="w-full truncate text-center text-[11.5px] font-bold text-white/85">
                {member.name}
              </span>
              <span className="w-full truncate text-center text-[9.5px] text-white/40">
                {member.sharing === false ? 'מוסתר' : timeAgo(member.updatedAt, now)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-stretch gap-1.5 border-t border-white/8 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              tap()
              tab.onClick?.()
            }}
            className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-white/65 transition active:scale-95 active:bg-white/6"
          >
            {tab.icon}
            <span className="text-[11px] font-bold">{tab.label}</span>
            {tab.badge > 0 && (
              <span className="absolute top-1 end-[22%] grid h-4 min-w-4 place-items-center rounded-full bg-rose-400 px-1 text-[9px] font-black text-white">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
