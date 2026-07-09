import { useState } from 'react'
import { Plus } from 'lucide-react'
import Reveal from './Reveal'

const QA = [
  { q: 'האם האפליקציה חינמית?', a: 'כן. DaySpace חינמית לחלוטין. אין מנוי, אין רכישות בתוך האפליקציה, אין פרסומות.' },
  { q: 'האם יש עברית?', a: 'לגמרי. DaySpace תוכננה מהיום הראשון בעברית ובכיווניות RTL מלאה. אין תרגומים חצי-רשמיים.' },
  { q: 'צריך חשבון או התחברות?', a: 'לא. פותחים את האפליקציה ומתחילים. הכול נשמר מקומית במכשיר שלכם.' },
  { q: 'האם היא עובדת אופליין?', a: 'כן, לחלוטין. אין תלות בשרתים או באינטרנט. אתם יכולים להשתמש בה גם במטוס.' },
  { q: 'יש תזכורות?', a: 'כן. אפשר להוסיף תזכורת לכל משימה — בזמן, 5, 15, 30 דקות או שעה לפני.' },
  { q: 'יש משימות חוזרות?', a: 'בהחלט. כל יום, ימים א׳–ה׳, או כל שבוע. ההשלמה נשמרת לפי תאריך, כך שכל יום מתחיל מחדש.' },
  { q: 'מה זה בעצם ציר הזמן הוויזואלי?', a: 'במקום רשימה של שורות, היום שלכם מוצג כציר אנכי מ-00:00 עד 23:00, וכל משימה היא בלוק צבעוני בגובה של המשך שלה. אתם רואים עומס, זמן פנוי, ומה קורה עכשיו — במבט אחד.' },
  { q: 'מה קורה למשימות שלא הושלמו בסוף היום?', a: 'DaySpace מציעה לכם בקליק להעביר אותן להיום הבא — בלי שהן ילכו לאיבוד ובלי שיערמו לחץ.' },
  { q: 'איפה נשמרים הנתונים?', a: 'הכול נשמר מקומית במכשיר, בזיכרון של הדפדפן/האפליקציה. אין שרתים שלנו שמאחסנים משהו.' },
  { q: 'מתי האפליקציה תהיה זמינה?', a: 'בפיתוח פעיל. גרסה 1.0 בקרוב ב-Google Play. השאירו מייל בסוף העמוד כדי לקבל עדכון.' },
]

export default function FAQ() {
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="py-24 px-5">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center">
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">שאלות נפוצות</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">כל מה שאולי רציתם לשאול.</h2>
        </Reveal>
        <div className="mt-12 space-y-3">
          {QA.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal key={i} delay={i * 30}>
                <div className={`bg-white rounded-2xl border transition ${isOpen ? 'border-[color:var(--color-brand)]/30 shadow-lg shadow-indigo-500/10' : 'border-[color:var(--color-line)]'}`}>
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-right"
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 font-bold">{item.q}</span>
                    <span className={`shrink-0 w-8 h-8 rounded-full grid place-items-center transition ${isOpen ? 'brand-gradient text-white rotate-45' : 'bg-[color:var(--color-bg)] text-[color:var(--color-brand)]'}`}>
                      <Plus size={16} />
                    </span>
                  </button>
                  <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? 300 : 0 }}>
                    <p className="px-5 pb-5 text-[color:var(--color-ink-soft)] leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
