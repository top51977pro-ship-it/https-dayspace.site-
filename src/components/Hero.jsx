import { Sparkles, ArrowLeft, Download } from 'lucide-react'
import PhoneMockup from './PhoneMockup'

export default function Hero() {
  return (
    <section className="relative overflow-hidden grid-bg pt-6 md:pt-14 pb-24">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-10 items-center">
        {/* text side */}
        <div className="text-center md:text-right order-2 md:order-1">
          <div className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur border border-[color:var(--color-line)] text-[color:var(--color-brand)] font-semibold text-sm px-3 py-1.5 rounded-full shadow-sm animate-fadeup">
            <Sparkles size={14} /> מתכנן יומי ויזואלי · בעברית
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight text-balance animate-fadeup" style={{ animationDelay: '80ms' }}>
            תכננו את היום שלכם
            <br />
            <span className="brand-text">בצורה ויזואלית.</span>
          </h1>
          <p className="mt-5 text-lg text-[color:var(--color-ink-soft)] max-w-xl mx-auto md:mx-0 leading-relaxed animate-fadeup" style={{ animationDelay: '160ms' }}>
            במקום עוד רשימת משימות משעממת — ראו את כל היום שלכם על ציר זמן צבעוני.
            <br className="hidden sm:inline" />
            שלווה, שליטה, ושמחה של יום מסודר.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start animate-fadeup" style={{ animationDelay: '240ms' }}>
            <a href="#download" className="inline-flex items-center gap-2 brand-gradient text-white font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 transition">
              <Download size={18} /> הורידו את האפליקציה
            </a>
            <a href="#how" className="inline-flex items-center gap-2 bg-white text-[color:var(--color-ink)] font-semibold px-6 py-3.5 rounded-2xl border border-[color:var(--color-line)] hover:bg-[color:var(--color-bg)] transition">
              איך זה עובד <ArrowLeft size={17} />
            </a>
          </div>
          <div className="mt-8 flex items-center gap-5 justify-center md:justify-start text-sm text-[color:var(--color-muted)] animate-fadeup" style={{ animationDelay: '320ms' }}>
            <span>✓ חינם לחלוטין</span>
            <span>✓ עברית ו-RTL</span>
            <span>✓ אופליין</span>
          </div>
        </div>

        {/* phone side */}
        <div className="order-1 md:order-2 flex justify-center">
          <div className="relative w-[260px] sm:w-[300px] md:w-[340px] animate-floaty">
            <div className="absolute -inset-8 -z-10 rounded-[60px] blur-3xl opacity-60 brand-gradient" />
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
