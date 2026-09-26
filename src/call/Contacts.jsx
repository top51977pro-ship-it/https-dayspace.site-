import { useState } from 'react'
import { Phone, Video, MessageCircle, Trash2, UserPlus, Globe, X } from 'lucide-react'
import { cleanPhone, initials, parseTarget, whatsappLink } from './utils'

const input = 'w-full bg-[color:var(--color-bg)] border border-[color:var(--color-line)] rounded-2xl px-4 py-3 outline-none focus:border-[color:var(--color-brand)] focus:bg-white transition'
const iconBtn = 'grid place-items-center w-10 h-10 rounded-full transition'

export function Avatar({ name, kind }) {
  return (
    <div className={`shrink-0 grid place-items-center w-11 h-11 rounded-full font-bold text-white ${kind === 'phone' ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'brand-gradient'}`}>
      {initials(name)}
    </div>
  )
}

function AddForm({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [kind, setKind] = useState('app')

  const submit = (e) => {
    e.preventDefault()
    const v = kind === 'app' ? parseTarget(value) : cleanPhone(value)
    if (!name.trim() || !v) return
    onSave({ name: name.trim(), value: v, kind })
    onClose()
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">איש קשר חדש</h2>
        <button type="button" onClick={onClose} aria-label="סגירה" className="p-1.5 rounded-full hover:bg-[color:var(--color-bg)]"><X size={18} /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" className={input} autoFocus />
      <div className="grid grid-cols-2 gap-2 p-1 bg-[color:var(--color-bg)] rounded-2xl" role="radiogroup" aria-label="סוג">
        {[['app', 'מזהה אינטרנט', Globe], ['phone', 'מספר טלפון', Phone]].map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition ${kind === k ? 'bg-white shadow-sm text-[color:var(--color-ink)]' : 'text-[color:var(--color-muted)]'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={kind === 'app' ? 'ds-abc123 או קישור' : '050-1234567'}
        type={kind === 'phone' ? 'tel' : 'text'}
        dir="ltr"
        className={`${input} text-right`}
        autoCapitalize="off"
        spellCheck={false}
      />
      <button type="submit" disabled={!name.trim() || !value.trim()} className="w-full brand-gradient text-white font-bold rounded-2xl py-3 disabled:opacity-40 transition">
        שמירה
      </button>
    </form>
  )
}

export default function Contacts({ contacts, onSave, onDelete, onCallApp, onDial }) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const list = q ? contacts.filter((c) => c.name.toLowerCase().includes(q) || c.value.includes(q)) : contacts

  return (
    <div className="space-y-4">
      {adding ? (
        <AddForm onSave={onSave} onClose={() => setAdding(false)} />
      ) : (
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש…" className={`${input} bg-white`} aria-label="חיפוש אנשי קשר" />
          <button onClick={() => setAdding(true)} className="shrink-0 inline-flex items-center gap-1.5 brand-gradient text-white font-semibold px-4 rounded-2xl shadow-md shadow-indigo-500/25">
            <UserPlus size={17} /> הוספה
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm overflow-hidden">
        {list.length === 0 ? (
          <div className="p-10 text-center text-[color:var(--color-muted)]">
            {contacts.length === 0 ? 'עוד אין אנשי קשר. הוסיפו מישהו כדי להתקשר בלחיצה אחת.' : 'לא נמצאו תוצאות.'}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--color-line)]">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={c.name} kind={c.kind} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" dir="auto">{c.name}</div>
                  <div className="text-sm text-[color:var(--color-muted)] truncate flex items-center gap-1">
                    {c.kind === 'app' ? <Globe size={12} /> : <Phone size={12} />}
                    <span dir="ltr">{c.value}</span>
                  </div>
                </div>
                {c.kind === 'app' ? (
                  <>
                    <button onClick={() => onCallApp(c.value, false, c.name)} aria-label={`שיחה קולית עם ${c.name}`} className={`${iconBtn} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}><Phone size={18} /></button>
                    <button onClick={() => onCallApp(c.value, true, c.name)} aria-label={`שיחת וידאו עם ${c.name}`} className={`${iconBtn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}><Video size={18} /></button>
                  </>
                ) : (
                  <>
                    <a href={`tel:${c.value}`} onClick={() => onDial(c)} aria-label={`חיוג אל ${c.name}`} className={`${iconBtn} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}><Phone size={18} /></a>
                    <a href={whatsappLink(c.value)} target="_blank" rel="noreferrer" aria-label={`וואטסאפ אל ${c.name}`} className={`${iconBtn} bg-[#25D366]/10 text-[#128C4B] hover:bg-[#25D366]/20`}><MessageCircle size={18} /></a>
                  </>
                )}
                <button
                  onClick={() => window.confirm(`למחוק את ${c.name}?`) && onDelete(c.id)}
                  aria-label={`מחיקת ${c.name}`}
                  className={`${iconBtn} text-[color:var(--color-muted)] hover:bg-rose-50 hover:text-rose-600`}
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
