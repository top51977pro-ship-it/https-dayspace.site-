// Tiny synthesized sound effects (filtered noise bursts), no asset files needed.
let ctx = null
let noiseBuf = null
let enabled = true

export function setSoundEnabled(on) { enabled = on }

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
}

const PROFILES = {
  stone: { f: 900, q: 1.2, dur: 0.12, gain: 0.5 },
  wood: { f: 420, q: 3, dur: 0.14, gain: 0.6 },
  grass: { f: 2600, q: 0.6, dur: 0.16, gain: 0.35 },
  gravel: { f: 1500, q: 0.8, dur: 0.16, gain: 0.45 },
  sand: { f: 3200, q: 0.5, dur: 0.18, gain: 0.3 },
  cloth: { f: 700, q: 0.5, dur: 0.14, gain: 0.35 },
  glass: { f: 3800, q: 6, dur: 0.22, gain: 0.35, ping: true },
  water: { f: 500, q: 1, dur: 0.25, gain: 0.3 },
  step: { f: 1200, q: 0.8, dur: 0.07, gain: 0.12 },
}

export function playSound(kind, volume = 1, pitch = 1) {
  if (!enabled || !ctx || ctx.state !== 'running') return
  const pr = PROFILES[kind] || PROFILES.stone
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = pitch * (0.9 + Math.random() * 0.2)
  const filt = ctx.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = pr.f * pitch
  filt.Q.value = pr.q
  const g = ctx.createGain()
  g.gain.setValueAtTime(pr.gain * volume, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + pr.dur)
  src.connect(filt).connect(g).connect(ctx.destination)
  src.start(t, Math.random() * 0.3, pr.dur + 0.05)
  if (pr.ping) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.frequency.value = 2400 + Math.random() * 800
    og.gain.setValueAtTime(0.06 * volume, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    o.connect(og).connect(ctx.destination)
    o.start(t); o.stop(t + 0.3)
  }
}

export function playExplosion() {
  if (!enabled || !ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = 0.35
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.setValueAtTime(1200, t)
  filt.frequency.exponentialRampToValueAtTime(80, t + 1.2)
  const g = ctx.createGain()
  g.gain.setValueAtTime(1.2, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
  src.connect(filt).connect(g).connect(ctx.destination)
  src.start(t, 0, 1.5)
}

export function playFuse() {
  if (!enabled || !ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const filt = ctx.createBiquadFilter()
  filt.type = 'highpass'
  filt.frequency.value = 4000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.25, t)
  g.gain.linearRampToValueAtTime(0.001, t + 0.5)
  src.connect(filt).connect(g).connect(ctx.destination)
  src.start(t, 0, 0.55)
}
