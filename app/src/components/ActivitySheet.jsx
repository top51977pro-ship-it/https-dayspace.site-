import { EmptyState, Sheet } from './ui'
import { formatClock } from '../lib/geo'

const STYLES = {
  arrive: { emoji: '📍', tone: 'text-mint-400', verb: 'הגיע/ה ל' },
  leave: { emoji: '🚪', tone: 'text-sun-400', verb: 'יצא/ה מ' },
  sos: { emoji: '🆘', tone: 'text-rose-400', verb: 'שלח/ה קריאת מצוקה' },
  join: { emoji: '🎉', tone: 'text-brand-400', verb: 'הצטרף/ה למשפחה' },
}

function dayLabel(ts) {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(date, today)) return 'היום'
  if (same(date, yesterday)) return 'אתמול'
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ActivitySheet({ open, onClose, events, onFocusEvent }) {
  const groups = []
  for (const event of events) {
    const label = dayLabel(event.ts)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(event)
    else groups.push({ label, items: [event] })
  }

  return (
    <Sheet open={open} onClose={onClose} title="פעילות" subtitle="הגעות, יציאות והתראות" height={0.7}>
      {!events.length ? (
        <EmptyState
          emoji="🔔"
          title="עדיין שקט כאן"
          body="ברגע שמישהו יגיע או יצא ממקום ששמרתם, זה יופיע כאן."
        />
      ) : (
        <div className="space-y-5 pb-2">
          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="mb-2 px-1 text-[12px] font-black tracking-wide text-white/35">
                {group.label}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((event) => {
                  const style = STYLES[event.type] || STYLES.arrive
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onFocusEvent?.(event)}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-start transition active:scale-[.99] active:bg-white/9"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-lg">
                          {style.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold text-white">
                            <span className="font-extrabold">{event.memberName}</span>{' '}
                            <span className={style.tone}>
                              {style.verb}
                              {event.placeName || ''}
                            </span>
                          </p>
                          <p className="text-[11.5px] text-white/35">{formatClock(event.ts)}</p>
                        </div>
                        {event.memberEmoji && (
                          <span className="shrink-0 text-lg opacity-70">{event.memberEmoji}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  )
}
