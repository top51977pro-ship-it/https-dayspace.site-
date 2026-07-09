import { useState } from 'react'
import { Bell } from 'lucide-react'
import Reveal from './Reveal'

function GooglePlayBadge() {
  return (
    <div className="inline-flex items-center gap-3 bg-[#0D0C17] text-white rounded-2xl px-5 py-3 opacity-60 cursor-not-allowed" aria-disabled="true" title="בקרוב">
      <svg width="26" height="28" viewBox="0 0 512 512" aria-hidden="true">
        <path fill="#00D7FE" d="M325.3 234.3L104.6 13.9c-5.2-5.3-13.8-4.4-17.3 2.1L346.4 275l-21.1-40.7z" />
        <path fill="#FFCE00" d="M480 236.8l-73.4-40.3-49.7 55.8 49.7 55.8L480 267.8c14.7-8.4 14.7-22.5 0-31z" />
        <path fill="#01F176" d="M87.3 15.9c-2.1 3.6-2.2 8.5 1.4 12.2l236.6 227.7 31-31L87.3 15.9z" />
        <path fill="#F63448" d="M88.7 484c-3.6 3.7-3.5 8.6-1.4 12.2l268.7-208.6-31-31L88.7 484z" />
      </svg>
      <div className="text-right leading-tight">
        <div className="text-[10px] uppercase tracking-widest opacity-70">בקרוב ב-</div>
        <div className="font-bold text-lg">Google Play</div>
      </div>
    </div>
  )
}

export default function Download() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setSent(true)
  }

  return (
    <section id="download" className="py-24 px-5">
      <div className="max-w-5xl mx-auto brand-gradient rounded-[36px] p-10 md:p-16 text-white shadow-2xl shadow-indigo-500/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(80% 60% at 100% 0%, #fff, transparent 60%)' }} />
        <div className="relative text-center max-w-2xl mx-auto">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-black text-balance leading-tight">מוכנים לתכנן יום שנעים לחזור אליו?</h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-4 text-lg text-white/90">האפליקציה נמצאת בפיתוח פעיל ותהיה זמינה בקרוב ב-Google Play. השאירו מייל — נעדכן אתכם ברגע שהיא עולה.</p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <GooglePlayBadge />
            </div>
          </Reveal>

          <Reveal delay={220}>
            <form onSubmit={submit} className="mt-8 max-w-md mx-auto">
              {sent ? (
                <div className="bg-white/15 border border-white/25 rounded-2xl py-4 px-5 flex items-center gap-2 justify-center">
                  <span className="text-2xl">✅</span>
                  <span className="font-semibold">שלחתם! נשלח לכם עדכון ברגע שיש חדש.</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 bg-white/10 border border-white/20 rounded-2xl p-2 backdrop-blur">
                  <div className="flex items-center gap-2 px-3 flex-1">
                    <Bell size={18} className="text-white/70 shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="המייל שלכם"
                      required
                      className="flex-1 bg-transparent outline-none text-white placeholder:text-white/60 py-2"
                    />
                  </div>
                  <button type="submit" className="bg-white text-[color:var(--color-brand)] font-bold px-6 py-2.5 rounded-xl hover:bg-white/95 active:scale-95 transition">
                    עדכנו אותי
                  </button>
                </div>
              )}
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
