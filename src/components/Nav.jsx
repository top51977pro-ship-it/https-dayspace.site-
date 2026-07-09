import { Download } from 'lucide-react'
import Logo from './Logo'

const LINKS = [
  { href: '#why', label: 'למה DaySpace' },
  { href: '#how', label: 'איך זה עובד' },
  { href: '#features', label: 'יכולות' },
  { href: '#faq', label: 'שאלות' },
]

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-[color:var(--color-line)]">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="#" aria-label="דף הבית" className="shrink-0"><Logo size={32} /></a>
        <nav className="hidden md:flex items-center gap-1.5" aria-label="ראשי">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="px-3 py-2 rounded-full text-sm font-medium text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-bg)] transition">
              {l.label}
            </a>
          ))}
        </nav>
        <a href="#download" className="inline-flex items-center gap-1.5 brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md shadow-indigo-500/25 hover:shadow-lg hover:-translate-y-0.5 transition">
          <Download size={16} /> הורדה
        </a>
      </div>
    </header>
  )
}
