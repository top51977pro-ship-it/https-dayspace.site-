import Reveal from './Reveal'

const STEPS = [
  { n: '01', title: 'יוצרים משימה', text: 'בהקלדה קצרה, בלחיצה על שעה בציר, או מתוך שגרה שכבר שמרתם.' },
  { n: '02', title: 'קובעים זמן', text: 'שעה, משך, צבע ואייקון — או נכנסת לתיבה למי שאין שעה קבועה.' },
  { n: '03', title: 'רואים את היום', text: 'כל היום נפתח לפניכם כציר זמן חי — עם עכשיו, הבא, ומה שנשאר.' },
  { n: '04', title: 'משלימים ונהנים', text: 'סימון מהיר, סיפוק מיידי, ורצף ימים שנבנה מעצמו.' },
]

export default function HowItWorks() {
  return (
    <section id="how" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">איך זה עובד</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">ארבעה שלבים, בלי חיכוך.</h2>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="relative bg-white rounded-3xl p-6 border border-[color:var(--color-line)] h-full">
                <div className="text-5xl font-black brand-text leading-none">{s.n}</div>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-[color:var(--color-ink-soft)] leading-relaxed">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
