import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { formatDuration, initials } from './utils'

const ENDED = {
  ended: 'השיחה הסתיימה',
  noanswer: 'אין מענה',
  declined: 'השיחה נדחתה',
  busy: 'הצד השני נמצא בשיחה אחרת',
  unavailable: 'המשתמש לא מחובר כרגע',
  lost: 'החיבור נותק',
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  return startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0
}

function MediaEl({ stream, as: Tag = 'video', muted = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream || null
    if (stream) el.play?.().catch(() => {})
  }, [stream])
  return <Tag ref={ref} autoPlay playsInline muted={muted} className={className} />
}

export default function InCall({ call, displayName, localStream, remoteStream, onHangup }) {
  const [micOff, setMicOff] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const elapsed = useElapsed(call.phase === 'active' ? call.startedAt : null)
  const [, force] = useState(0)

  // Remote video can start (or be added) after the stream arrives.
  useEffect(() => {
    if (!remoteStream) return
    const bump = () => force((n) => n + 1)
    remoteStream.addEventListener('addtrack', bump)
    return () => remoteStream.removeEventListener('addtrack', bump)
  }, [remoteStream])

  useEffect(() => { localStream?.getAudioTracks().forEach((t) => { t.enabled = !micOff }) }, [localStream, micOff])
  useEffect(() => { localStream?.getVideoTracks().forEach((t) => { t.enabled = !camOff }) }, [localStream, camOff])

  const hasLocalVideo = Boolean(localStream?.getVideoTracks().length)
  const hasRemoteVideo = Boolean(remoteStream?.getVideoTracks().length)
  const ended = call.phase === 'ended'

  const statusText = ended
    ? ENDED[call.reason] || ENDED.ended
    : call.phase === 'active'
      ? formatDuration(elapsed)
      : call.phase === 'starting'
        ? 'מבקש גישה למיקרופון…'
        : 'מצלצל…'

  return (
    <div className="fixed inset-0 z-50 bg-[#14122a] text-white flex flex-col" role="dialog" aria-modal="true" aria-label={`שיחה עם ${displayName}`}>
      {hasRemoteVideo && !ended ? (
        <MediaEl stream={remoteStream} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(60% 45% at 50% 30%, #8B5CF6 0%, transparent 70%)' }} />
          {/* Voice call: the remote audio still needs an element to play through. */}
          {remoteStream && <MediaEl stream={remoteStream} as="audio" />}
        </>
      )}

      <div className={`relative flex-1 flex flex-col items-center ${hasRemoteVideo && !ended ? 'justify-start pt-10' : 'justify-center'} px-6 text-center`}>
        {!(hasRemoteVideo && !ended) && (
          <div className="relative w-28 h-28 mb-6">
            {call.phase === 'ringing' && <span className="absolute inset-0 rounded-full brand-gradient animate-ping opacity-30" />}
            <div className="relative grid place-items-center w-28 h-28 rounded-full brand-gradient text-4xl font-black shadow-2xl">
              {initials(displayName)}
            </div>
          </div>
        )}
        <div className={`font-extrabold truncate max-w-full ${hasRemoteVideo && !ended ? 'text-xl drop-shadow' : 'text-3xl'}`} dir="auto">{displayName}</div>
        <div className={`mt-2 tabular-nums ${ended ? 'text-rose-300' : 'text-white/70'} ${hasRemoteVideo && !ended ? 'drop-shadow' : 'text-lg'}`} aria-live="polite">
          {statusText}
        </div>
      </div>

      {hasLocalVideo && !ended && (
        <div className="absolute top-4 left-4 w-28 sm:w-40 aspect-[3/4] rounded-2xl overflow-hidden border border-white/20 shadow-xl bg-black">
          {camOff ? (
            <div className="w-full h-full grid place-items-center text-white/50"><VideoOff size={24} /></div>
          ) : (
            <MediaEl stream={localStream} muted className="w-full h-full object-cover -scale-x-100" />
          )}
        </div>
      )}

      <div className="relative pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 flex items-center justify-center gap-6">
        <button
          onClick={() => setMicOff((v) => !v)}
          disabled={ended || !localStream}
          aria-pressed={micOff}
          aria-label={micOff ? 'הפעלת מיקרופון' : 'השתקה'}
          className={`grid place-items-center w-14 h-14 rounded-full backdrop-blur transition disabled:opacity-40 ${micOff ? 'bg-white text-[#14122a]' : 'bg-white/15 hover:bg-white/25'}`}
        >
          {micOff ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button
          onClick={onHangup}
          disabled={ended}
          aria-label="ניתוק"
          className="grid place-items-center w-18 h-18 rounded-full bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/40 transition disabled:opacity-40"
        >
          <PhoneOff size={30} />
        </button>
        {hasLocalVideo && (
          <button
            onClick={() => setCamOff((v) => !v)}
            disabled={ended}
            aria-pressed={camOff}
            aria-label={camOff ? 'הפעלת מצלמה' : 'כיבוי מצלמה'}
            className={`grid place-items-center w-14 h-14 rounded-full backdrop-blur transition disabled:opacity-40 ${camOff ? 'bg-white text-[#14122a]' : 'bg-white/15 hover:bg-white/25'}`}
          >
            {camOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}
      </div>
    </div>
  )
}
