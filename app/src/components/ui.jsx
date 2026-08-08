import { useEffect, useRef, useState } from 'react'
import { IconClose } from './Icons'
import { tap } from '../lib/device'

export function Avatar({ member, size = 44, ring = true, dimmed = false }) {
  const color = member?.color || '#6D5EF6'
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.46,
        boxShadow: ring ? `0 0 0 2px rgb(255 255 255 / .16)` : 'none',
        opacity: dimmed ? 0.55 : 1,
        filter: dimmed ? 'grayscale(.6)' : 'none',
      }}
    >
      {member?.emoji || '🙂'}
    </span>
  )
}

export function Chip({ active, onClick, children, tone = 'default' }) {
  const tones = {
    default: active
      ? 'bg-brand-500 text-white border-transparent'
      : 'bg-white/6 text-white/70 border-white/10',
    danger: 'bg-rose-400/15 text-rose-400 border-rose-400/30',
  }
  return (
    <button
      type="button"
      onClick={() => {
        tap()
        onClick?.()
      }}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition active:scale-95 ${tones[tone] || tones.default}`}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, label, onClick, active, className = '', tone = 'glass' }) {
  const tones = {
    glass: 'glass text-white/85',
    brand: 'bg-brand-500 text-white border border-white/10',
    danger: 'bg-rose-400 text-white border border-white/10',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        tap()
        onClick?.()
      }}
      className={`grid h-11 w-11 place-items-center rounded-2xl shadow-float transition active:scale-90 ${
        active ? 'ring-2 ring-brand-400/70' : ''
      } ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Button({ children, onClick, variant = 'primary', className = '', ...rest }) {
  const variants = {
    primary: 'bg-brand-500 text-white shadow-float active:bg-brand-600',
    ghost: 'bg-white/7 text-white/85 border border-white/10',
    danger: 'bg-rose-400/15 text-rose-400 border border-rose-400/30',
    solidDanger: 'bg-rose-400 text-white shadow-float',
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        tap()
        onClick?.(e)
      }}
      className={`rounded-2xl px-4 py-3 text-[15px] font-bold transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-white/60">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-white/40">{hint}</span>}
    </label>
  )
}

export function TextInput({ className = '', ...rest }) {
  return (
    <input
      className={`w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-brand-400/70 focus:bg-white/10 ${className}`}
      {...rest}
    />
  )
}

export function Toggle({ checked, onChange, label, description, icon }) {
  return (
    <button
      type="button"
      onClick={() => {
        tap()
        onChange(!checked)
      }}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-start transition active:scale-[.99]"
    >
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/7 text-white/70">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-white/45">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-500' : 'bg-white/15'
        }`}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ insetInlineStart: checked ? '1.75rem' : '0.25rem' }}
        />
      </span>
    </button>
  )
}

/**
 * Bottom sheet with a draggable grabber. `snap` is the fraction of the viewport
 * height the sheet occupies; drag past the bottom threshold to dismiss.
 */
export function Sheet({ open, onClose, title, subtitle, children, height = 0.62, footer }) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    if (open) setDragY(0)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onPointerDown = (e) => {
    startY.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (startY.current == null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  const onPointerUp = () => {
    if (dragY > 110) onClose?.()
    else setDragY(0)
    startY.current = null
  }

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col justify-end">
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/55"
      />
      <div
        ref={sheetRef}
        className="glass-strong animate-sheet-in relative flex flex-col overflow-hidden rounded-t-[28px] shadow-float"
        style={{
          height: `${Math.round(height * 100)}dvh`,
          transform: `translateY(${dragY}px)`,
          transition: startY.current == null ? 'transform 260ms cubic-bezier(.22,1,.36,1)' : 'none',
        }}
      >
        <div
          className="shrink-0 cursor-grab touch-none px-5 pt-3 pb-1"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-white/25" />
        </div>

        {(title || onClose) && (
          <div className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              {title && <h2 className="truncate text-[19px] font-extrabold text-white">{title}</h2>}
              {subtitle && (
                <p className="mt-0.5 truncate text-[13px] text-white/50">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-white/70 transition active:scale-90"
            >
              <IconClose size={18} />
            </button>
          </div>
        )}

        <div className="scroll-area min-h-0 flex-1 px-5 pb-4">{children}</div>

        {footer && <div className="pad-bottom shrink-0 border-t border-white/8 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ emoji, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="text-4xl">{emoji}</span>
      <h3 className="text-[17px] font-bold text-white">{title}</h3>
      {body && <p className="max-w-[36ch] text-[13.5px] leading-relaxed text-white/50">{body}</p>}
      {action}
    </div>
  )
}

export function Toasts({ toasts, onDismiss }) {
  const tones = {
    default: 'glass-strong text-white',
    danger: 'bg-rose-400 text-white',
    warn: 'bg-sun-400 text-ink-950',
    success: 'bg-mint-400 text-ink-950',
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[1500] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className={`pointer-events-auto animate-pop-in max-w-[92vw] rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-float ${
            tones[toast.tone] || tones.default
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
