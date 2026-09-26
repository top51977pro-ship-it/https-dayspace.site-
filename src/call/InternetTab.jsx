import { useState } from 'react'
import { Phone, Video, Copy, Check, Share2, UserPlus } from 'lucide-react'
import { inviteLink, parseTarget } from './utils'

const card = 'bg-white rounded-3xl border border-[color:var(--color-line)] shadow-sm p-5'
const input = 'w-full bg-[color:var(--color-bg)] border border-[color:var(--color-line)] rounded-2xl px-4 py-3 outline-none focus:border-[color:var(--color-brand)] focus:bg-white transition'

export default function InternetTab({ myId, status, name, setName, inviteTarget, inviteName, onCall, onSave }) {
  const [target, setTarget] = useState(inviteTarget)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const ready = status === 'ready'
  const link = myId ? inviteLink(myId) : ''
  const canShare = typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked — the link is visible and selectable */ }
  }

  const share = () => {
    navigator.share({ title: 'התקשרו אליי', text: `${name ? name + ' מזמין/ה אותך' : 'הוזמנת'} לשיחה ב-DaySpace Call:`, url: link }).catch(() => {})
  }

  const save = () => {
    const value = parseTarget(target)
    if (!value) return
    const who = window.prompt('איך לשמור את איש הקשר?', inviteName || '')
    if (!who?.trim()) return
    onSave({ name: who.trim(), value, kind: 'app' })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const submit = (video) => (e) => {
    e?.preventDefault()
    if (target.trim()) onCall(target, video)
  }

  return (
    <div className="space-y-4">
      {inviteTarget && (
        <div className="brand-gradient text-white rounded-3xl p-5 shadow-lg shadow-indigo-500/25">
          <div className="text-sm opacity-90">הוזמנתם לשיחה עם</div>
          <div className="text-2xl font-extrabold mt-0.5" dir="auto">{inviteName || inviteTarget}</div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onCall(inviteTarget, false)} disabled={!ready} className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[color:var(--color-ink)] font-bold rounded-2xl py-3 disabled:opacity-60 transition hover:-translate-y-0.5">
              <Phone size={18} /> שיחה קולית
            </button>
            <button onClick={() => onCall(inviteTarget, true)} disabled={!ready} className="flex-1 inline-flex items-center justify-center gap-2 bg-white/15 border border-white/40 font-bold rounded-2xl py-3 disabled:opacity-60 transition hover:bg-white/25">
              <Video size={18} /> וידאו
            </button>
          </div>
          {!ready && <div className="mt-3 text-sm opacity-90">מתחבר לשרת…</div>}
        </div>
      )}

      <section className={card} aria-labelledby="me-title">
        <h2 id="me-title" className="font-bold">הקישור האישי שלכם</h2>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">שלחו אותו למי שרוצה להתקשר אליכם. כל עוד הדף הזה פתוח — תוכלו לקבל שיחות.</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[color:var(--color-muted)]">המזהה שלכם</div>
            <div className="text-2xl font-black tracking-wide" dir="ltr" style={{ textAlign: 'right' }}>
              {myId || <span className="inline-block w-32 h-7 rounded-lg bg-[color:var(--color-line)] animate-pulse align-middle" />}
            </div>
          </div>
        </div>
        {link && <div className="mt-2 text-sm text-[color:var(--color-ink-soft)] break-all select-all" dir="ltr" style={{ textAlign: 'right' }}>{link}</div>}

        <div className="mt-4 flex gap-2">
          <button onClick={copy} disabled={!link} className="flex-1 inline-flex items-center justify-center gap-2 bg-[color:var(--color-bg)] border border-[color:var(--color-line)] font-semibold rounded-2xl py-3 hover:bg-white disabled:opacity-50 transition">
            {copied ? <><Check size={17} className="text-emerald-600" /> הועתק</> : <><Copy size={17} /> העתקת קישור</>}
          </button>
          {canShare && (
            <button onClick={share} disabled={!link} className="flex-1 inline-flex items-center justify-center gap-2 brand-gradient text-white font-semibold rounded-2xl py-3 shadow-md shadow-indigo-500/25 disabled:opacity-50 transition hover:-translate-y-0.5">
              <Share2 size={17} /> שיתוף
            </button>
          )}
        </div>

        <label className="block mt-5">
          <span className="text-sm font-semibold">השם שלכם</span>
          <span className="text-xs text-[color:var(--color-muted)] block">יוצג למי שמקבל מכם שיחה</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="לדוגמה: דנה" className={`${input} mt-2`} autoComplete="name" />
        </label>
      </section>

      <form className={card} onSubmit={submit(false)} aria-labelledby="call-title">
        <h2 id="call-title" className="font-bold">להתקשר למישהו</h2>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">הדביקו את המזהה או הקישור שקיבלתם.</p>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="ds-abc123"
          dir="ltr"
          className={`${input} mt-3 text-lg font-semibold tracking-wide text-right`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="מזהה או קישור של הצד השני"
        />
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="submit" disabled={!ready || !target.trim()} className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl py-3 disabled:opacity-40 transition">
            <Phone size={18} /> קולית
          </button>
          <button type="button" onClick={submit(true)} disabled={!ready || !target.trim()} className="inline-flex items-center justify-center gap-2 brand-gradient text-white font-bold rounded-2xl py-3 disabled:opacity-40 transition">
            <Video size={18} /> וידאו
          </button>
          <button type="button" onClick={save} disabled={!target.trim()} aria-label="שמירה באנשי קשר" title="שמירה באנשי קשר" className="inline-flex items-center justify-center w-12 bg-[color:var(--color-bg)] border border-[color:var(--color-line)] rounded-2xl disabled:opacity-40 hover:bg-white transition">
            {saved ? <Check size={18} className="text-emerald-600" /> : <UserPlus size={18} />}
          </button>
        </div>
      </form>

      <section className={card} aria-labelledby="how-title">
        <h2 id="how-title" className="font-bold">איך זה עובד?</h2>
        <ol className="mt-3 space-y-3 text-sm text-[color:var(--color-ink-soft)]">
          {[
            'שלחו לחבר/ה את הקישור האישי שלכם (בוואטסאפ, SMS, מייל…).',
            'הם פותחים את הקישור ולוחצים "שיחה קולית" או "וידאו" — בלי הרשמה ובלי התקנה.',
            'אצלכם הדף מצלצל. עונים — ומדברים. השיחה עוברת ישירות בין הדפדפנים, מוצפנת.',
          ].map((text, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full brand-gradient text-white text-xs font-bold">{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
