// End-to-end encryption for the public-broker backend.
//
// The invite code is the only shared secret. From it we derive two things:
//   * the MQTT topic the family talks on  (so nobody has to guess it right)
//   * an AES-GCM key                      (so a broker operator, or anyone who
//                                          subscribes to a wildcard topic, sees
//                                          nothing but ciphertext)
//
// Everything runs on Web Crypto, which the Android WebView provides because
// Capacitor serves the app from a secure origin.

const enc = new TextEncoder()
const dec = new TextDecoder()

const PBKDF2_ITERATIONS = 150_000
const TOPIC_LENGTH = 26
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'

const cache = new Map()

function base32(bytes, length) {
  let out = ''
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    out += BASE32[bytes[i] & 31]
  }
  return out.slice(0, length)
}

function toBase64(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * @param {string} code the invite code, already normalised to upper case
 * @returns {Promise<{topic: string, key: CryptoKey}>}
 */
export async function deriveSecrets(code) {
  if (cache.has(code)) return cache.get(code)

  const promise = (async () => {
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', enc.encode(`familymap.topic.v1|${code}`)),
    )
    const topic = base32(digest, TOPIC_LENGTH)

    const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, [
      'deriveKey',
    ])
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(`familymap.key.v1|${topic}`),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    return { topic, key }
  })()

  cache.set(code, promise)
  return promise
}

/** @returns {Promise<string>} base64 of iv ‖ ciphertext */
export async function encryptJSON(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))),
  )
  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv, 0)
  packed.set(ciphertext, iv.length)
  return toBase64(packed)
}

/** Returns null for anything we cannot authenticate — never throws. */
export async function decryptJSON(key, payload) {
  try {
    const packed = fromBase64(payload)
    if (packed.length < 13) return null
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, 12) },
      key,
      packed.slice(12),
    )
    return JSON.parse(dec.decode(plain))
  } catch {
    return null
  }
}
