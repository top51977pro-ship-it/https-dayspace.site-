import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Share } from '@capacitor/share'
import { Button, Sheet } from './ui'
import { IconCheck, IconCopy, IconShare } from './Icons'
import { tap } from '../lib/device'

const INVITE_BASE = 'https://dayspace.site/join'

export default function InviteSheet({ open, onClose, circle, profile, onToast }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(null)

  const code = circle?.code || '------'
  const link = `${INVITE_BASE}/${code}`
  const message = `${profile?.name || 'מישהו'} מזמין/ה אתכם למשפחה "${circle?.name || 'שלנו'}" באפליקציית מפת משפחה 🧭\n\nקוד הצטרפות: ${code}\n${link}`

  useEffect(() => {
    if (!open || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, link, {
      width: 190,
      margin: 1,
      color: { dark: '#0B1020', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(() => {})
  }, [open, link])

  async function copy(text, which) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Older WebViews need the textarea trick.
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    tap()
    setCopied(which)
    setTimeout(() => setCopied(null), 1800)
    onToast?.('הועתק ✓', 'success')
  }

  async function share() {
    tap()
    try {
      await Share.share({
        title: 'הזמנה למפת המשפחה',
        text: message,
        dialogTitle: 'שיתוף הזמנה',
      })
    } catch {
      // Share plugin unavailable (e.g. desktop browser) — fall back to copying.
      copy(message, 'link')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="הזמנת בן משפחה"
      subtitle={circle?.name}
      height={0.78}
      footer={
        <Button onClick={share} className="mb-1 w-full">
          <span className="flex items-center justify-center gap-2">
            <IconShare size={18} /> שיתוף ההזמנה
          </span>
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white/5 p-5">
          <div className="rounded-2xl bg-white p-3 shadow-float">
            <canvas ref={canvasRef} className="block h-[190px] w-[190px]" />
          </div>
          <p className="text-center text-[12.5px] leading-relaxed text-white/45">
            סרקו את הקוד, או הזינו את קוד ההצטרפות באפליקציה
          </p>
        </div>

        <button
          type="button"
          onClick={() => copy(code, 'code')}
          className="flex w-full items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/6 px-5 py-4 transition active:scale-[.99]"
        >
          <span className="font-mono text-[30px] font-black tracking-[0.22em] text-white" dir="ltr">
            {code}
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-white/70">
            {copied === 'code' ? <IconCheck size={19} /> : <IconCopy size={19} />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => copy(link, 'link')}
          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-start transition active:scale-[.99]"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/55" dir="ltr">
            {link}
          </span>
          <span className="shrink-0 text-white/50">
            {copied === 'link' ? <IconCheck size={17} /> : <IconCopy size={17} />}
          </span>
        </button>

        <ol className="space-y-2.5 rounded-2xl bg-white/4 p-4 text-[13px] leading-relaxed text-white/55">
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/25 text-[11px] font-black text-brand-400">
              1
            </span>
            שלחו את ההזמנה בוואטסאפ או בכל דרך אחרת.
          </li>
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/25 text-[11px] font-black text-brand-400">
              2
            </span>
            הם מתקינים את האפליקציה ובוחרים "יש לי קוד הזמנה".
          </li>
          <li className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/25 text-[11px] font-black text-brand-400">
              3
            </span>
            הם מקלידים את הקוד — ומופיעים על המפה שלכם.
          </li>
        </ol>
      </div>
    </Sheet>
  )
}
