import { useEffect, useState } from 'react'

// State that survives reloads. localStorage can throw (private mode, blocked storage) — fall back to memory.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue]
}

// Accepts a bare ID ("ds-ab12cd") or a pasted invite link (".../call/?to=ds-ab12cd").
export function parseTarget(input) {
  const text = input.trim()
  const m = text.match(/[?&#]to=([\w-]+)/)
  return (m ? m[1] : text).toLowerCase()
}

export function inviteLink(id) {
  return `${location.origin}/call/?to=${encodeURIComponent(id)}`
}

export function cleanPhone(value) {
  return value.replace(/[^\d+*#]/g, '')
}

// wa.me needs an international number without "+"; assume Israel for local 0-prefixed numbers.
export function whatsappLink(value) {
  let digits = value.replace(/\D/g, '')
  if (!value.trim().startsWith('+') && digits.startsWith('0')) digits = '972' + digits.slice(1)
  return `https://wa.me/${digits}`
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' })
export function formatWhen(ts) {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  return today ? timeFmt.format(d) : `${dayFmt.format(d)}, ${timeFmt.format(d)}`
}

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

let audioCtx
// Synthesised ring tones so no audio files are needed. Returns a stop function.
// 'ring' = incoming call, 'back' = ringback while waiting for the other side to answer.
export function startTone(kind) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    return () => {}
  }
  const ctx = audioCtx
  const ring = kind === 'ring'
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(ctx.destination)
  const oscs = (ring ? [660, 880] : [440, 480]).map((f) => {
    const o = ctx.createOscillator()
    o.frequency.value = f
    o.connect(gain)
    o.start()
    return o
  })
  const on = ring ? 0.9 : 1.5
  const vol = ring ? 0.07 : 0.04
  const pulse = () => {
    const t = ctx.currentTime
    gain.gain.setValueAtTime(vol, t)
    gain.gain.setValueAtTime(0, t + on)
    if (ring) navigator.vibrate?.([400, 200, 400])
  }
  pulse()
  const timer = setInterval(pulse, (ring ? 2 : 4.5) * 1000)
  return () => {
    clearInterval(timer)
    navigator.vibrate?.(0)
    oscs.forEach((o) => { try { o.stop() } catch { /* already stopped */ } })
    gain.disconnect()
  }
}
