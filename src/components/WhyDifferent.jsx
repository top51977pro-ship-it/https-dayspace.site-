import { X, Check } from 'lucide-react'
import Reveal from './Reveal'

const ROWS = [
  { label: 'רשימה שטוחה של משימות', them: true, us: false },
  { label: 'לוח שנה של אירועים', them: true, us: false },
  { label: 'ציר זמן ויזואלי של היום', them: false, us: true },
  { label: 'תיבת משימות ללא שעה', them: false, us: true },
  { label: 'תזכורות, חזרות, פומודורו', them: true, us: true },
  { label: 'הבנה של היום ב-3 שניות', them: false, us: true },
]

export default function WhyDifferent() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-4xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">במה שונים</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">לא עוד רשימה. לא רק לוח שנה. משהו שלישי.</h2>
          <p className="mt-4 text-lg text-[color:var(--color-ink-soft)]">שילוב של תכנון זמן ורשימת מטלות — בממשק אחד שבנוי לעברית ולמובייל.</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 bg-white rounded-3xl border border-[color:var(--color-line)] overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-6 py-4 border-b border-[color:var(--color-line)] bg-[color:var(--color-bg)] text-sm font-bold text-[color:var(--color-muted)]">
              <span> </span>
              <span className="text-center">אחרים</span>
              <span className="text-center brand-text">DaySpace</span>
            </div>
            {ROWS.map((r, i) => (
              <div key={i} className={`grid grid-cols-[1fr_100px_100px] gap-2 px-6 py-4 items-center ${i < ROWS.length - 1 ? 'border-b border-[color:var(--color-line)]' : ''}`}>
                <span className="font-medium">{r.label}</span>
                <span className="flex justify-center">{r.them ? <Check size={20} className="text-[color:var(--color-muted)]" /> : <X size={20} className="text-slate-300" />}</span>
                <span className="flex justify-center">
                  {r.us ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full brand-gradient text-white shadow"><Check size={17} /></span>
                  ) : (
                    <X size={20} className="text-slate-300" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
