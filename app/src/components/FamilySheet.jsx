import { Avatar, Button, EmptyState, Sheet } from './ui'
import { IconBattery, IconChevron } from './Icons'
import { distance, formatDistance, isStale, timeAgo } from '../lib/geo'

export default function FamilySheet({
  open,
  onClose,
  members,
  places,
  selfLocation,
  circle,
  onSelect,
  onInvite,
}) {
  const now = Date.now()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={circle?.name || 'המשפחה'}
      subtitle={`${members.length} מחוברים`}
      height={0.68}
      footer={
        <Button onClick={onInvite} className="mb-1 w-full">
          הזמנת בן משפחה
        </Button>
      }
    >
      {members.length === 0 ? (
        <EmptyState
          emoji="👨‍👩‍👧‍👦"
          title="עדיין אין אף אחד על המפה"
          body="שלחו קוד הזמנה לבני המשפחה כדי לראות אותם כאן."
        />
      ) : (
        <ul className="space-y-2 pb-2">
          {members.map((member) => {
            const away = selfLocation && !member.isSelf ? distance(selfLocation, member) : null
            const stale = isStale(member, now)
            const atPlace = places.find(
              (p) => (distance(member, p) ?? Infinity) <= (p.radius || 150),
            )

            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(member.id)
                    onClose()
                  }}
                  className="flex w-full items-center gap-3.5 rounded-2xl bg-white/5 p-3 text-start transition active:scale-[.99] active:bg-white/9"
                >
                  <Avatar member={member} size={48} dimmed={stale || member.sharing === false} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15.5px] font-bold text-white">{member.name}</p>
                      {member.isSelf && (
                        <span className="shrink-0 rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[9.5px] font-black text-sky-400">
                          אני
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[12.5px] text-white/50">
                      {member.sharing === false
                        ? 'שיתוף מיקום כבוי'
                        : atPlace
                          ? `${atPlace.emoji} ב${atPlace.name}`
                          : away != null
                            ? `${formatDistance(away)} ממך`
                            : 'על המפה'}
                    </p>

                    <div className="mt-1 flex items-center gap-3 text-[11.5px] font-semibold text-white/35">
                      <span>{timeAgo(member.updatedAt, now)}</span>
                      {typeof member.battery === 'number' && (
                        <span
                          className={`flex items-center gap-1 ${
                            member.battery <= 0.2 ? 'text-rose-400' : ''
                          }`}
                        >
                          <IconBattery size={15} level={member.battery} charging={member.charging} />
                          {Math.round(member.battery * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-white/25 rtl:rotate-180">
                    <IconChevron size={18} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
