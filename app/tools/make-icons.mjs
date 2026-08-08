/**
 * Generates the Android launcher PNGs (legacy densities + adaptive-icon foreground)
 * without any native image tooling — a tiny PNG encoder plus analytic rasterising of
 * the "pin" mark, supersampled 3× for smooth edges.
 *
 *   node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RES = resolve(ROOT, 'android/app/src/main/res')

const BRAND_TOP = [0x8b, 0x7d, 0xff]
const BRAND_BOTTOM = [0x56, 0x46, 0xe0]
const SS = 3 // supersampling factor

/* ------------------------------------------------------------------ png ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** RGBA pixel buffer → PNG file bytes. */
function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------- geometry ---- */

/** Teardrop pin: union of a circle at (cx,cy) r=R and the triangle down to the tip. */
function makePin(cx, cy, R) {
  const T = 2.55 * R // tip distance below the circle centre
  const tx = (R * Math.sqrt(T * T - R * R)) / T
  const ty = (R * R) / T
  const tip = [cx, cy + T]
  const left = [cx - tx, cy + ty]
  const right = [cx + tx, cy + ty]

  const sign = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1])

  return (x, y) => {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) return true
    const p = [x, y]
    const d1 = sign(p, tip, left)
    const d2 = sign(p, left, right)
    const d3 = sign(p, right, tip)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
  }
}

/** Rounded-square (squircle-ish) mask used for the legacy launcher shape. */
function makeRoundedRect(size, radius) {
  return (x, y) => {
    const dx = Math.max(radius - x, 0, x - (size - radius))
    const dy = Math.max(radius - y, 0, y - (size - radius))
    return dx * dx + dy * dy <= radius * radius
  }
}

const makeCircle = (size) => {
  const r = size / 2
  return (x, y) => (x - r) ** 2 + (y - r) ** 2 <= r * r
}

const lerp = (a, b, t) => a + (b - a) * t

function gradientAt(t) {
  return [
    Math.round(lerp(BRAND_TOP[0], BRAND_BOTTOM[0], t)),
    Math.round(lerp(BRAND_TOP[1], BRAND_BOTTOM[1], t)),
    Math.round(lerp(BRAND_TOP[2], BRAND_BOTTOM[2], t)),
  ]
}

/* -------------------------------------------------------------- drawing ---- */

/**
 * @param {number} size output edge length in px
 * @param {'rounded'|'circle'|'none'} shape background shape ('none' = transparent)
 * @param {number} pinScale pin circle radius as a fraction of `size`
 */
function renderIcon(size, shape, pinScale = 0.2) {
  const out = Buffer.alloc(size * size * 4)
  const bg =
    shape === 'circle'
      ? makeCircle(size)
      : shape === 'rounded'
        ? makeRoundedRect(size, size * 0.225)
        : null

  const R = size * pinScale
  const cx = size / 2
  // Centre the whole teardrop (height = R + 2.55R) inside the canvas.
  const pinHeight = R * 3.55
  const cy = (size - pinHeight) / 2 + R
  const pin = makePin(cx, cy, R)
  const holeR = R * 0.42

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0
      let pinHits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!bg || bg(px, py)) bgHits++
          if (pin(px, py) && (px - cx) ** 2 + (py - cy) ** 2 > holeR * holeR) pinHits++
        }
      }
      const total = SS * SS
      const bgAlpha = bg ? bgHits / total : 0
      const pinAlpha = pinHits / total

      const [r, g, b] = gradientAt(y / size)
      // Composite: white pin over the gradient background.
      const alpha = shape === 'none' ? pinAlpha : Math.max(bgAlpha, pinAlpha)
      const mix = alpha > 0 ? pinAlpha / alpha : 0
      const idx = (y * size + x) * 4
      out[idx] = Math.round(lerp(r, 255, mix))
      out[idx + 1] = Math.round(lerp(g, 255, mix))
      out[idx + 2] = Math.round(lerp(b, 255, mix))
      out[idx + 3] = Math.round(alpha * 255)
    }
  }
  return encodePNG(size, size, out)
}

/* ----------------------------------------------------------------- main ---- */

const DENSITIES = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
]

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
  console.log(`  ${path.replace(`${ROOT}/`, '')}  ${(buffer.length / 1024).toFixed(1)} kB`)
}

console.log('Generating launcher icons…')
for (const density of DENSITIES) {
  write(`${RES}/${density.dir}/ic_launcher.png`, renderIcon(density.launcher, 'rounded'))
  write(`${RES}/${density.dir}/ic_launcher_round.png`, renderIcon(density.launcher, 'circle'))
  // Adaptive foreground: pin sits inside the 66% safe zone.
  write(
    `${RES}/${density.dir}/ic_launcher_foreground.png`,
    renderIcon(density.foreground, 'none', 0.132),
  )
}
console.log('Done.')
