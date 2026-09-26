import { useRef, useState } from 'react'
import { Phone, Delete, MessageCircle, UserPlus, Check } from 'lucide-react'
import { cleanPhone, whatsappLink } from './utils'

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
]

export default function Dialer({ onDial, onSave }) {
  const [number, setNumber] = useState('')
  const [saved, setSaved] = useState(false)
  const holdTimer = useRef(null)
  const held = useRef(false)

  const press = (key) => setNumber((n) => (n + key).slice(0, 20))

  // Long-press 0 for "+", like a phone keypad.
  const down = (key) => {
    held.current = false
    if (key !== '0') return
    holdTimer.current = setTimeout(() => { held.current = true; press('+') }, 500)
  }
  const up = (key) => {
    clearTimeout(holdTimer.current)
    if (!held.current) press(key)
  }

  const save = () => {
    const who = window.prompt('איך לשמור את איש הקשר?')
    if (!who?.trim()) return
    onSave({ name: who.trim(), value: number, kind: 'phone' })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const has = number.length > 0

  return (
    <div className="bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm p-5">
      <div className="flex items-center gap-2">
        <input
          type="tel"
          value={number}
          onChange={(e) => setNumber(cleanPhone(e.target.value).slice(0, 20))}
          placeholder="הקלידו מספר"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          aria-label="מספר טלפון"
          className="flex-1 min-w-0 text-center text-3xl font-bold tracking-wider bg-transparent outline-none py-3 placeholder:text-lg placeholder:font-medium placeholder:tracking-normal placeholder:text-[color:var(--color-muted)]"
        />
        {has && (
          <button onClick={() => setNumber((n) => n.slice(0, -1))} aria-label="מחיקה" className="p-3 rounded-full text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)] transition">
            <Delete size={22} />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 max-w-xs mx-auto" dir="ltr">
        {KEYS.map(([key, sub]) => (
          <button
            key={key}
            onPointerDown={() => down(key)}
            onPointerUp={() => up(key)}
            onPointerLeave={() => clearTimeout(holdTimer.current)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(key) } }}
            aria-label={key}
            className="aspect-square rounded-full bg-[color:var(--color-bg)] hover:bg-[color:var(--color-line)] active:scale-95 transition flex flex-col items-center justify-center select-none touch-manipulation"
          >
            <span className="text-2xl font-semibold leading-none">{key}</span>
            <span className="text-[10px] font-semibold tracking-widest text-[color:var(--color-muted)] h-3 mt-1">{sub}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <a
          href={has ? whatsappLink(number) : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!has}
          aria-label="פתיחה בוואטסאפ"
          title="פתיחה בוואטסאפ"
          className={`grid place-items-center w-14 h-14 rounded-full bg-[#25D366]/10 text-[#128C4B] transition ${has ? 'hover:bg-[#25D366]/20' : 'opacity-40 pointer-events-none'}`}
        >
          <MessageCircle size={22} />
        </a>
        <a
          href={has ? `tel:${number}` : undefined}
          onClick={() => has && onDial(number)}
          aria-disabled={!has}
          aria-label="חיוג"
          className={`grid place-items-center w-20 h-20 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition ${has ? 'hover:bg-emerald-600 hover:-translate-y-0.5' : 'opacity-40 pointer-events-none'}`}
        >
          <Phone size={30} fill="currentColor" />
        </a>
        <button
          onClick={save}
          disabled={!has}
          aria-label="שמירה באנשי קשר"
          title="שמירה באנשי קשר"
          className="grid place-items-center w-14 h-14 rounded-full bg-[color:var(--color-bg)] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-line)] disabled:opacity-40 transition"
        >
          {saved ? <Check size={22} className="text-emerald-600" /> : <UserPlus size={22} />}
        </button>
      </div>

      <p className="mt-5 text-xs text-center text-[color:var(--color-muted)] leading-relaxed">
        בטלפון נייד — החיוג נפתח באפליקציית הטלפון שלכם.
        <br />
        במחשב — דרך אפליקציה מקושרת (Phone Link, FaceTime, Skype וכו׳).
      </p>
    </div>
  )
}
