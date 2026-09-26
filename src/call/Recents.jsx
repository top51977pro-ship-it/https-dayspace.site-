import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video, Trash2 } from 'lucide-react'
import { Avatar } from './Contacts'
import { formatDuration, formatWhen } from './utils'

function describe(r) {
  if (r.kind === 'phone') return { icon: PhoneOutgoing, color: 'text-emerald-600', text: 'חיוג טלפוני' }
  if (r.dir === 'missed') return { icon: PhoneMissed, color: 'text-rose-600', text: 'שיחה שלא נענתה' }
  const media = r.video ? 'וידאו' : 'קולית'
  if (r.dir === 'in') {
    return r.answered
      ? { icon: PhoneIncoming, color: 'text-indigo-600', text: `נכנסת · ${media}` }
      : { icon: PhoneMissed, color: 'text-rose-600', text: `נדחתה · ${media}` }
  }
  return r.answered
    ? { icon: PhoneOutgoing, color: 'text-indigo-600', text: `יוצאת · ${media}` }
    : { icon: PhoneOutgoing, color: 'text-[color:var(--color-muted)]', text: `יוצאת · לא נענתה` }
}

export default function Recents({ recents, nameFor, onClear, onCallApp, onDial }) {
  if (recents.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm p-10 text-center text-[color:var(--color-muted)]">
        עוד אין שיחות. השיחות שלכם יופיעו כאן.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => window.confirm('למחוק את כל היסטוריית השיחות?') && onClear()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--color-muted)] hover:text-rose-600 px-3 py-1.5 rounded-full hover:bg-white transition"
        >
          <Trash2 size={15} /> ניקוי
        </button>
      </div>
      <ul className="bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm overflow-hidden divide-y divide-[color:var(--color-line)]">
        {recents.map((r) => {
          const name = nameFor(r.kind, r.target, r.name)
          const { icon: Icon, color, text } = describe(r)
          return (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={name} kind={r.kind} />
              <div className="flex-1 min-w-0">
                <div className={`font-semibold truncate ${r.dir === 'missed' ? 'text-rose-600' : ''}`} dir="auto">{name}</div>
                <div className="text-sm text-[color:var(--color-muted)] flex items-center gap-1.5">
                  <Icon size={13} className={color} />
                  <span className="truncate">{text}</span>
                  {r.duration > 0 && <span>· {formatDuration(r.duration)}</span>}
                </div>
              </div>
              <div className="text-xs text-[color:var(--color-muted)] shrink-0">{formatWhen(r.at)}</div>
              {r.kind === 'phone' ? (
                <a href={`tel:${r.target}`} onClick={() => onDial(r)} aria-label={`חיוג חוזר אל ${name}`} className="grid place-items-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition">
                  <Phone size={18} />
                </a>
              ) : (
                <button onClick={() => onCallApp(r.target, Boolean(r.video), name)} aria-label={`התקשרות חוזרת אל ${name}`} className="grid place-items-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                  {r.video ? <Video size={18} /> : <Phone size={18} />}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
