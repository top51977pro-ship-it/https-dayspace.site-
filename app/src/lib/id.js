// Ambiguous glyphs (0/O, 1/I) are left out so codes survive being read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomBytes(n) {
  const buf = new Uint8Array(n)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf)
  else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256)
  return buf
}

export function uid(prefix = '') {
  const bytes = randomBytes(9)
  let out = ''
  for (const b of bytes) out += b.toString(36).padStart(2, '0')
  return prefix ? `${prefix}_${out}` : out
}

// The code is the only shared secret on the public-broker backend: it decides
// the topic and the encryption key. Ten characters of this alphabet is 50 bits,
// which is far past guessable while still being readable over the phone.
export const CODE_LENGTH = 10

/** Invite code, e.g. "K7QM3XB9TD". */
export function inviteCode() {
  const bytes = randomBytes(CODE_LENGTH)
  let out = ''
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return out
}

export function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH)
}

/** "K7QM3XB9TD" → "K7QM 3XB9 TD", which is much easier to read out loud. */
export function formatCode(code) {
  return String(code || '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

export const PALETTE = [
  '#6D5EF6',
  '#46B8FF',
  '#37E0A6',
  '#FFC247',
  '#FF5F7A',
  '#B36BFF',
  '#FF8A3D',
  '#2ED3C6',
]

export const EMOJIS = ['🦊', '🐻', '🐼', '🦁', '🐨', '🐯', '🦄', '🐧', '🦉', '🐢', '🌟', '🚀']

export function pickColor(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
