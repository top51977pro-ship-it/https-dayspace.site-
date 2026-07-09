import Logo from './Logo'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-[color:var(--color-line)] bg-white">
      <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo size={34} />
          <p className="mt-4 max-w-sm text-[color:var(--color-ink-soft)]">
            מתכנן יומי ויזואלי לאנדרואיד. עברית מלאה. חינמי. עובד אופליין.
          </p>
        </div>
        <div>
          <div className="text-sm font-bold mb-3">המוצר</div>
          <ul className="space-y-2 text-[color:var(--color-ink-soft)]">
            <li><a href="#why" className="hover:text-[color:var(--color-brand)] transition">למה DaySpace</a></li>
            <li><a href="#how" className="hover:text-[color:var(--color-brand)] transition">איך זה עובד</a></li>
            <li><a href="#features" className="hover:text-[color:var(--color-brand)] transition">יכולות</a></li>
            <li><a href="#faq" className="hover:text-[color:var(--color-brand)] transition">שאלות</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-bold mb-3">חוקי</div>
          <ul className="space-y-2 text-[color:var(--color-ink-soft)]">
            <li><a href="#" className="hover:text-[color:var(--color-brand)] transition">מדיניות פרטיות</a></li>
            <li><a href="#" className="hover:text-[color:var(--color-brand)] transition">תנאי שימוש</a></li>
            <li><a href="mailto:hello@dayspace.app" className="hover:text-[color:var(--color-brand)] transition">צרו קשר</a></li>
            <li><a href="mailto:hello@dayspace.app" className="hover:text-[color:var(--color-brand)] transition">hello@dayspace.app</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[color:var(--color-line)] py-5 text-center text-sm text-[color:var(--color-muted)]">
        © {year} DaySpace · כל הזכויות שמורות · נבנה בעברית ובאהבה
      </div>
    </footer>
  )
}
