import { Phone, PhoneOff, Video } from 'lucide-react'
import { initials } from './utils'

export default function IncomingCall({ incoming, displayName, onAnswer, onDecline }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#14122a]/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="incoming-name">
      <div className="w-full max-w-sm bg-[#14122a] text-white rounded-[32px] p-7 text-center shadow-2xl animate-fadeup">
        <div className="text-sm text-white/60">{incoming.video ? 'שיחת וידאו נכנסת' : 'שיחה קולית נכנסת'}</div>
        <div className="relative mx-auto mt-6 w-24 h-24">
          <span className="absolute inset-0 rounded-full brand-gradient animate-ping opacity-40" />
          <div className="relative grid place-items-center w-24 h-24 rounded-full brand-gradient text-3xl font-black">
            {initials(displayName)}
          </div>
        </div>
        <div id="incoming-name" className="mt-5 text-2xl font-extrabold truncate" dir="auto">{displayName}</div>
        {displayName !== incoming.from && <div className="text-sm text-white/50 mt-1" dir="ltr">{incoming.from}</div>}

        <div className="mt-8 flex items-start justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onDecline} aria-label="דחייה" className="grid place-items-center w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 transition shadow-lg shadow-rose-500/30">
              <PhoneOff size={26} />
            </button>
            <span className="text-sm text-white/70">דחייה</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => onAnswer({ video: incoming.video })} aria-label="מענה" autoFocus className="grid place-items-center w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/30">
              {incoming.video ? <Video size={26} /> : <Phone size={26} fill="currentColor" />}
            </button>
            <span className="text-sm text-white/70">מענה</span>
          </div>
        </div>
        {incoming.video && (
          <button onClick={() => onAnswer({ video: false })} className="mt-6 text-sm font-semibold text-white/70 hover:text-white underline underline-offset-4">
            מענה בקול בלבד (בלי מצלמה)
          </button>
        )}
      </div>
    </div>
  )
}
