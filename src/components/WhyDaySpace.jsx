import { CalendarClock, Inbox, Sparkles, Repeat, Timer, TrendingUp, Flame, Bell, ListTree } from 'lucide-react'
import Reveal from './Reveal'

const ITEMS = [
  { icon: CalendarClock, title: 'Timeline ויזואלי', text: 'היום כולו על ציר זמן אנכי. עומס במבט אחד.' },
  { icon: Inbox, title: 'תיבת משימות', text: 'רעיונות בלי שעה קבועה — נגררים ליום מתי שמתאים.' },
  { icon: Sparkles, title: 'תכנון מהיר', text: 'הקלידו "פגישה מחר 10:00 שעה" — DaySpace תבין.' },
  { icon: Repeat, title: 'משימות חוזרות', text: 'שגרות בוקר, פגישות שבועיות, אימונים יומיים.' },
  { icon: Timer, title: 'Pomodoro מובנה', text: 'טיימר ריכוז בכל משימה. בלי אפליקציה נוספת.' },
  { icon: TrendingUp, title: 'התקדמות יומית', text: 'פס התקדמות חי בכותרת. תמיד יודעים איפה עומדים.' },
  { icon: Flame, title: 'רצף ימים', text: 'מוטיבציה עדינה. יום מוצלח = שרשרת שלא רוצים לנתק.' },
  { icon: Bell, title: 'תזכורות', text: 'בזמן, 5, 15, 30 דקות או שעה לפני. פשוט ומדויק.' },
  { icon: ListTree, title: 'תת-משימות והערות', text: 'לפרק משימה גדולה לצעדים קטנים ברי-ביצוע.' },
]

export default function WhyDaySpace() {
  return (
    <section id="why" className="py-24 px-5 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">למה DaySpace</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">כל מה שצריך לתכנן יום שמח.</h2>
          <p className="mt-4 text-lg text-[color:var(--color-ink-soft)]">בלי הגדרות מסובכות. בלי חשבון. פשוט פותחים ומתחילים.</p>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ITEMS.map((it, i) => (
            <Reveal key={it.title} delay={i * 50}>
              <Card {...it} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Card({ icon: Icon, title, text }) {
  return (
    <div className="group relative bg-[color:var(--color-bg)] rounded-3xl p-6 border border-transparent hover:border-[color:var(--color-line)] hover:bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition duration-300">
      <div className="w-12 h-12 rounded-2xl brand-gradient text-white grid place-items-center shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition">
        <Icon size={22} />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-[color:var(--color-ink-soft)] leading-relaxed">{text}</p>
    </div>
  )
}
