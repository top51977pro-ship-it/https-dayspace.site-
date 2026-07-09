import PhoneMockup from './PhoneMockup'
import Reveal from './Reveal'

// Second stylized SVG mock — the Inbox / task list view.
function InboxMock() {
  const items = [
    { title: 'להתקשר לרופא', color: '#F43F5E', done: false, priority: true },
    { title: 'לשלם חשבון חשמל', color: '#0EA5E9', done: false },
    { title: 'לקנות חלב', color: '#22C55E', done: true },
    { title: 'לסיים דוח שבועי', color: '#8B5CF6', done: false, sub: '2/4 תת-משימות' },
    { title: 'לקבוע פגישה עם דני', color: '#F59E0B', done: false },
  ]
  return (
    <svg viewBox="0 0 340 700" className="w-full h-auto drop-shadow-[0_40px_80px_rgba(80,50,180,0.35)]" aria-label="מסך התיבה של DaySpace">
      <rect x="6" y="6" width="328" height="688" rx="44" fill="#0D0C17" />
      <rect x="10" y="10" width="320" height="680" rx="40" fill="#F4F4FB" />
      <rect x="132" y="16" width="76" height="20" rx="10" fill="#0D0C17" />
      <g transform="translate(0,52)">
        <text x="306" y="30" fontSize="22" fontWeight="900" fill="#14122a" textAnchor="end" fontFamily="Heebo, sans-serif">משימות</text>
        <text x="306" y="52" fontSize="12" fill="#6E6B84" textAnchor="end" fontFamily="Heebo, sans-serif">דברים לעשות — בלי שעה מסוימת</text>
      </g>
      {items.map((it, i) => (
        <g key={i} transform={`translate(20, ${118 + i * 82})`}>
          <rect width="300" height="68" rx="18" fill="#fff" />
          {/* checkbox */}
          <circle cx="26" cy="34" r="12" fill={it.done ? it.color : 'transparent'} stroke={it.done ? it.color : '#CBD5E1'} strokeWidth="2" />
          {it.done && <path d="M20 34 l5 5 l9 -10" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {/* text */}
          <text x="238" y="32" fontSize="14" fontWeight="700" fill={it.done ? '#94A3B8' : '#14122a'} textAnchor="end" textDecoration={it.done ? 'line-through' : 'none'} fontFamily="Heebo, sans-serif">{it.title}</text>
          {it.sub && <text x="238" y="50" fontSize="10.5" fill="#94A3B8" textAnchor="end" fontFamily="Heebo, sans-serif">{it.sub}</text>}
          {it.priority && <text x="215" y="32" fontSize="12" textAnchor="end">🚩</text>}
          {/* colored icon tile */}
          <rect x="252" y="18" width="34" height="34" rx="10" fill={it.color} />
        </g>
      ))}
    </svg>
  )
}

export default function Showcase() {
  return (
    <section className="py-24 px-5 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">מסכי האפליקציה</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">כמה מסכים, המון מחשבה על כל פיקסל.</h2>
        </Reveal>

        <div className="mt-16 grid md:grid-cols-2 gap-16 items-center">
          <Reveal>
            <div className="w-full max-w-[300px] mx-auto"><PhoneMockup /></div>
          </Reveal>
          <Reveal delay={100} className="text-right">
            <h3 className="text-2xl font-black">היום, על ציר זמן.</h3>
            <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">
              בלוקים צבעוניים בגובה שמשקף את המשך. אינדיקטור "עכשיו" חי. פס התקדמות. רצף ימים 🔥.
              אתם לא קוראים את היום — אתם רואים אותו.
            </p>
          </Reveal>
        </div>

        <div className="mt-24 grid md:grid-cols-2 gap-16 items-center">
          <Reveal className="md:order-2">
            <div className="w-full max-w-[300px] mx-auto"><InboxMock /></div>
          </Reveal>
          <Reveal delay={100} className="text-right md:order-1">
            <h3 className="text-2xl font-black">תיבה למה שעדיין אין לו שעה.</h3>
            <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">
              רעיונות, מטלות, שיחות שצריך להחזיר — נוחתים בתיבה, בלי לחץ. כשהזמן מגיע, גוררים אותם ליום.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
