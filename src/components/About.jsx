import Reveal from './Reveal'

export default function About() {
  return (
    <section id="about" className="py-24 px-5">
      <div className="max-w-3xl mx-auto text-center">
        <Reveal>
          <div className="text-sm font-bold text-[color:var(--color-brand)] tracking-widest">הסיפור</div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-balance">
            רשימות משימות פותרות חצי בעיה.
            <br className="hidden sm:inline" />
            <span className="brand-text">DaySpace פותרת את השנייה.</span>
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-8 space-y-5 text-lg text-[color:var(--color-ink-soft)] leading-relaxed text-right md:text-center">
            <p>
              רשימת מטלות אומרת לכם <b className="text-[color:var(--color-ink)]">מה</b> יש לעשות.
              היא לא אומרת <b className="text-[color:var(--color-ink)]">מתי</b>, כמה זמן זה ייקח, או אם בכלל יש לזה מקום ביום שלכם.
            </p>
            <p>
              אז כל בוקר אנשים פותחים את היום עם חמש עשרה שורות טקסט אפור וסימני V, ושואלים את עצמם: "מאיפה מתחילים?"
              בסוף היום — חצי מהמשימות עוברות ליום הבא, ורק מתערמות.
            </p>
            <p>
              בנינו את DaySpace כי רצינו לראות את היום, לא לקרוא אותו.
              כשהיום שלכם מוצג כציר זמן ויזואלי, אתם מבינים תוך שנייה — כמה עמוס, מה קורה עכשיו, ואיפה נשאר אוויר לנשום.
              זו לא רשימה. זה מרחב.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
