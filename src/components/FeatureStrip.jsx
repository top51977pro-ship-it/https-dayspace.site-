import { WifiOff, Languages, Lock, Zap, Palette, Smartphone } from 'lucide-react'
import Reveal from './Reveal'

const F = [
  { icon: WifiOff, title: 'עובד אופליין', text: 'כל הנתונים אצלכם במכשיר. בלי אינטרנט, בלי חשבון.' },
  { icon: Languages, title: 'עברית ו-RTL מלא', text: 'כל פיקסל, כל פונט, כל אינטראקציה — מותאמים לעברית.' },
  { icon: Lock, title: 'פרטיות מלאה', text: 'אין שרתים. אין מעקב. הנתונים לא עוזבים את המכשיר.' },
  { icon: Zap, title: 'מהיר וקליל', text: 'נטען בהינף עין. תגובה מיידית לכל לחיצה.' },
  { icon: Palette, title: '12 צבעים ו-48 אייקונים', text: 'כל משימה מקבלת זהות ויזואלית משלה.' },
  { icon: Smartphone, title: 'מובייל-פירסט', text: 'תוכנן מהיום הראשון לשימוש נוח ביד אחת.' },
]

export default function FeatureStrip() {
  return (
    <section id="features" className="py-24 px-5 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">יכולות</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">שקט מנטלי, מתחת למכסה המנוע.</h2>
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {F.map((f, i) => (
            <Reveal key={f.title} delay={i * 40}>
              <div className="flex gap-4">
                <div className="shrink-0 w-11 h-11 rounded-2xl bg-indigo-50 text-[color:var(--color-brand)] grid place-items-center">
                  <f.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{f.title}</h3>
                  <p className="mt-1 text-[color:var(--color-ink-soft)] leading-relaxed">{f.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
