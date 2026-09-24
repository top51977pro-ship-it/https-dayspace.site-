// Procedurally painted 16x16 pixel-art tiles packed into one atlas canvas,
// plus isometric inventory icons rendered from that atlas.
import { mulberry32 } from './noise.js'
import { FACE_TILES, CROSS, BLOCK_COUNT } from './blocks.js'

const T = 16
const PER_ROW = 16
export const ATLAS_SIZE = T * PER_ROW

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0)

function tile(paint) {
  return (seed) => {
    const buf = new Uint8ClampedArray(T * T * 4)
    const rnd = mulberry32(seed)
    const set = (x, y, c, a = 255) => {
      if (x < 0 || y < 0 || x >= T || y >= T) return
      const i = (y * T + x) * 4
      buf[i] = clamp(c[0]); buf[i + 1] = clamp(c[1]); buf[i + 2] = clamp(c[2]); buf[i + 3] = a
    }
    const get = (x, y) => { const i = (y * T + x) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]] }
    paint({ set, get, rnd })
    return buf
  }
}

const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k]

function noiseFill({ set, rnd }, base, amt) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, mul(base, 1 - amt / 2 + rnd() * amt))
}

const DIRT = [134, 96, 67]
function paintDirt(p) {
  noiseFill(p, DIRT, 0.22)
  for (let i = 0; i < 26; i++) {
    const x = (p.rnd() * T) | 0, y = (p.rnd() * T) | 0
    p.set(x, y, p.rnd() < 0.6 ? [104, 74, 52] : [158, 116, 84])
  }
}
function paintStone(p) {
  noiseFill(p, [127, 127, 127], 0.16)
  for (let i = 0; i < 10; i++) {
    const x = (p.rnd() * T) | 0, y = (p.rnd() * T) | 0, len = 2 + ((p.rnd() * 3) | 0)
    const c = p.rnd() < 0.6 ? [104, 104, 104] : [146, 146, 146]
    for (let k = 0; k < len; k++) p.set((x + k) % T, y, c)
  }
}
function paintCobble(p, moss) {
  const { set, rnd } = p
  const pts = []
  for (let i = 0; i < 10; i++) pts.push([rnd() * T, rnd() * T, 0.75 + rnd() * 0.4, rnd() < 0.45])
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0
    pts.forEach((pt, i) => {
      let dx = Math.abs(x + 0.5 - pt[0]); dx = Math.min(dx, T - dx)
      let dy = Math.abs(y + 0.5 - pt[1]); dy = Math.min(dy, T - dy)
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < d1) { d2 = d1; d1 = d; best = i } else if (d < d2) d2 = d
    })
    if (d2 - d1 < 1.1) set(x, y, mul([78, 78, 78], 0.9 + rnd() * 0.2))
    else {
      let c = mul([128, 128, 128], pts[best][2] * (0.9 + rnd() * 0.2))
      if (moss && pts[best][3] && rnd() < 0.75) c = mul([80, 120, 60], 0.8 + rnd() * 0.3)
      set(x, y, c)
    }
  }
}
function paintPlanks(p) {
  const { set, rnd } = p
  const base = [162, 130, 78]
  for (let y = 0; y < T; y++) {
    const board = y >> 2
    const seam = (board * 7 + 3) % T
    for (let x = 0; x < T; x++) {
      let c = mul(base, 0.9 + rnd() * 0.14)
      if (y % 4 === 3) c = [112, 88, 52]
      else if (x === seam) c = [124, 98, 58]
      else if (rnd() < 0.08) c = mul(base, 0.82)
      set(x, y, c)
    }
  }
}
function paintBark(p, base, dark) {
  const { set, rnd } = p
  const tones = Array.from({ length: T }, () => 0.8 + rnd() * 0.35)
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let c = mul(base, tones[x] * (0.92 + rnd() * 0.12))
    if (dark && rnd() < 0.12) c = dark
    set(x, y, c)
  }
}
function paintRings(p, bark, light, darkRing) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
    let c = d > 6.5 ? bark : (Math.floor(d) % 2 ? light : darkRing)
    p.set(x, y, mul(c, 0.92 + p.rnd() * 0.12))
  }
}
function paintLeaves(p, base) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (p.rnd() < 0.16) p.set(x, y, [0, 0, 0], 0)
    else p.set(x, y, mul(base, 0.65 + p.rnd() * 0.55))
  }
}
function paintOre(p, color) {
  paintStone(p)
  const { set, rnd } = p
  for (let b = 0; b < 4; b++) {
    const cx = 2 + ((rnd() * 11) | 0), cy = 2 + ((rnd() * 11) | 0)
    for (let k = 0; k < 4; k++) {
      const x = cx + ((rnd() * 3) | 0) - 1, y = cy + ((rnd() * 3) | 0) - 1
      set(x, y, mul(color, 0.85 + rnd() * 0.3))
      set(x + 1, y + 1, mul(color, 0.6))
    }
  }
}
function paintWool(p, color) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let k = 0.93 + p.rnd() * 0.1
    if ((x + y * 3) % 5 === 0) k *= 0.9
    p.set(x, y, mul(color, k))
  }
}
function paintFlower(p, petal, center) {
  const { set } = p
  const stem = [52, 120, 30]
  for (let y = 7; y < T; y++) set(7, y, stem)
  set(5, 11, stem); set(6, 12, stem); set(8, 10, stem); set(9, 9, stem); set(10, 9, stem)
  for (let y = 2; y < 8; y++) for (let x = 5; x < 10; x++) {
    const dx = x - 7, dy = y - 4.5
    if (dx * dx + dy * dy < 7.5) set(x, y, mul(petal, 0.85 + p.rnd() * 0.25))
  }
  set(7, 4, center); set(7, 5, center)
}
function paintPumpkin({ set, rnd }) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, mul([214, 124, 26], (x % 4 === 0 ? 0.78 : 1) * (0.92 + rnd() * 0.12)))
}
function snowTop(p, rows) {
  for (let x = 0; x < T; x++) {
    const len = rows + (p.rnd() < 0.5 ? 1 : 0)
    for (let y = 0; y < len; y++) p.set(x, y, mul([242, 250, 255], 0.94 + p.rnd() * 0.06))
  }
}

const PAINTERS = {
  grass_top: tile((p) => {
    noiseFill(p, [104, 166, 62], 0.3)
    for (let i = 0; i < 30; i++) p.set((p.rnd() * T) | 0, (p.rnd() * T) | 0, [84, 138, 48])
  }),
  grass_side: tile((p) => {
    paintDirt(p)
    for (let x = 0; x < T; x++) {
      const len = 3 + (p.rnd() < 0.5 ? 1 : 0) + (p.rnd() < 0.25 ? 2 : 0)
      for (let y = 0; y < len; y++) p.set(x, y, mul([104, 166, 62], 0.8 + p.rnd() * 0.3))
    }
  }),
  dirt: tile(paintDirt),
  stone: tile(paintStone),
  cobblestone: tile((p) => paintCobble(p, false)),
  mossy_cobble: tile((p) => paintCobble(p, true)),
  planks: tile(paintPlanks),
  log_side: tile((p) => paintBark(p, [104, 82, 50])),
  log_top: tile((p) => paintRings(p, [96, 76, 46], [184, 150, 94], [158, 124, 76])),
  birch_side: tile((p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, mul([222, 222, 214], 0.94 + p.rnd() * 0.08))
    for (let i = 0; i < 9; i++) {
      const x = (p.rnd() * 14) | 0, y = (p.rnd() * T) | 0, len = 2 + ((p.rnd() * 3) | 0)
      for (let k = 0; k < len; k++) p.set(x + k, y, [48, 44, 40])
    }
  }),
  birch_top: tile((p) => paintRings(p, [222, 222, 214], [206, 186, 132], [186, 164, 110])),
  leaves: tile((p) => paintLeaves(p, [62, 128, 40])),
  birch_leaves: tile((p) => paintLeaves(p, [110, 150, 70])),
  sand: tile((p) => {
    noiseFill(p, [220, 208, 162], 0.1)
    for (let i = 0; i < 20; i++) p.set((p.rnd() * T) | 0, (p.rnd() * T) | 0, p.rnd() < 0.5 ? [196, 182, 136] : [236, 226, 186])
  }),
  water: tile((p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const wave = Math.sin((x + y * 0.5) * 0.8) + Math.sin(y * 1.3 - x * 0.4)
      p.set(x, y, mul([48, 96, 214], 0.88 + wave * 0.06 + p.rnd() * 0.06), 170)
    }
  }),
  ice: tile((p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = mul([150, 190, 250], 0.95 + p.rnd() * 0.08)
      if ((x - y + 16) % 11 === 0 || (x + y) % 13 === 0) c = [210, 230, 255]
      p.set(x, y, c, 190)
    }
  }),
  glass: tile(({ set }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) set(x, y, [216, 238, 244])
      else if ((x + y === 9 && x > 2 && x < 7) || (x + y === 12 && x > 3 && x < 6) || (x + y === 22 && x > 9 && x < 13)) set(x, y, [236, 248, 252])
      else set(x, y, [0, 0, 0], 0)
    }
  }),
  brick: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) {
      const row = y >> 2
      for (let x = 0; x < T; x++) {
        const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7
        set(x, y, mortar ? mul([176, 170, 160], 0.95 + rnd() * 0.08) : mul([152, 76, 60], 0.85 + rnd() * 0.25))
      }
    }
  }),
  stonebrick: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const top = y < 8
      const vx = top ? 15 : 7
      let c = mul([124, 124, 124], 0.92 + rnd() * 0.12)
      if (y === 7 || y === 15 || x === vx) c = [74, 74, 74]
      else if (y === 0 || y === 8 || x === (vx + 1) % 16) c = [150, 150, 150]
      set(x, y, c)
    }
  }),
  bedrock: tile(({ set, rnd }) => {
    const pal = [[28, 28, 28], [58, 58, 58], [88, 88, 88], [124, 124, 124]]
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, pal[(rnd() * 4) | 0])
  }),
  gravel: tile(({ set, rnd }) => {
    const pal = [[132, 124, 122], [100, 94, 92], [160, 152, 150], [118, 104, 96], [84, 80, 80]]
    for (let y = 0; y < T; y += 2) for (let x = 0; x < T; x += 2) {
      const c = pal[(rnd() * pal.length) | 0]
      for (let k = 0; k < 4; k++) set(x + (k & 1), y + (k >> 1), mul(c, 0.9 + rnd() * 0.15))
    }
  }),
  snow: tile((p) => noiseFill(p, [242, 250, 255], 0.06)),
  snow_side: tile((p) => { paintDirt(p); snowTop(p, 3) }),
  coal_ore: tile((p) => paintOre(p, [40, 40, 40])),
  iron_ore: tile((p) => paintOre(p, [216, 176, 146])),
  gold_ore: tile((p) => paintOre(p, [250, 236, 80])),
  diamond_ore: tile((p) => paintOre(p, [96, 236, 240])),
  obsidian: tile(({ set, rnd }) => {
    const pal = [[18, 14, 28], [30, 22, 46], [50, 36, 78], [22, 18, 34]]
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, pal[(rnd() * 4) | 0])
  }),
  bookshelf: tile((p) => {
    paintPlanks(p)
    const cols = [[160, 40, 36], [44, 76, 160], [60, 130, 50], [140, 100, 40], [110, 40, 120], [200, 170, 60]]
    for (const [y0, y1] of [[2, 7], [9, 14]]) {
      let x = 1
      while (x < 15) {
        const w = p.rnd() < 0.7 ? 1 : 2
        const c = cols[(p.rnd() * cols.length) | 0]
        const top = y0 + (p.rnd() < 0.3 ? 1 : 0)
        for (let k = 0; k < w && x + k < 15; k++) for (let y = top; y < y1; y++) p.set(x + k, y, mul(c, y === top ? 1.2 : 0.95))
        x += w + (p.rnd() < 0.2 ? 1 : 0)
      }
    }
  }),
  crafting_top: tile((p) => {
    paintPlanks(p)
    for (let i = 0; i < T; i++) { p.set(i, 0, [90, 64, 36]); p.set(i, 15, [90, 64, 36]); p.set(0, i, [90, 64, 36]); p.set(15, i, [90, 64, 36]) }
    for (let i = 2; i < 14; i++) { p.set(i, 5, [110, 80, 46]); p.set(i, 10, [110, 80, 46]); p.set(5, i, [110, 80, 46]); p.set(10, i, [110, 80, 46]) }
  }),
  crafting_side: tile((p) => {
    paintPlanks(p)
    for (let x = 0; x < T; x++) { p.set(x, 0, [90, 64, 36]); p.set(x, 1, [120, 88, 50]) }
    // saw + hammer silhouettes
    for (let y = 4; y < 12; y++) p.set(4, y, [100, 70, 40])
    for (let x = 2; x < 7; x++) p.set(x, 4, [150, 150, 150])
    for (let y = 5; y < 12; y++) p.set(11, y, [150, 150, 150])
    for (let y = 5; y < 12; y++) p.set(12, y, [120, 120, 120])
  }),
  pumpkin_side: tile((p) => paintPumpkin(p)),
  pumpkin_face: tile((p) => {
    paintPumpkin(p)
    const dark = [60, 30, 8]
    for (const [x, y] of [[3, 5], [4, 5], [3, 6], [4, 6], [11, 5], [12, 5], [11, 6], [12, 6]]) p.set(x, y, dark)
    for (let x = 3; x < 13; x++) p.set(x, 10, dark)
    for (let x = 4; x < 12; x++) if (x !== 6 && x !== 9) p.set(x, 11, dark)
  }),
  pumpkin_top: tile((p) => {
    noiseFill(p, [206, 118, 22], 0.12)
    for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) p.set(x, y, [90, 70, 30])
  }),
  tnt_side: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = mul([200, 50, 36], 0.9 + rnd() * 0.15)
      if (x % 4 === 3) c = mul(c, 0.75)
      if (y >= 5 && y <= 10) c = [236, 232, 224]
      set(x, y, c)
    }
    // "TNT" lettering
    const ink = [30, 30, 30]
    const glyph = (ox, rows) => rows.forEach((r, dy) => [...r].forEach((ch, dx) => ch === '#' && set(ox + dx, 6 + dy, ink)))
    const tG = ['###', '.#.', '.#.', '.#.']
    const nG = ['#..#', '##.#', '#.##', '#..#']
    glyph(2, tG); glyph(6, nG); glyph(11, tG)
  }),
  tnt_top: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, mul([196, 58, 40], 0.9 + rnd() * 0.15))
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11], [7, 7]]) { set(x, y, [60, 60, 60]); set(x + 1, y, [60, 60, 60]) }
  }),
  tnt_bottom: tile((p) => noiseFill(p, [180, 50, 36], 0.14)),
  cactus_side: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (x === 0 || x === 15) { set(x, y, [0, 0, 0], 0); continue }
      let c = mul([70, 140, 50], 0.85 + rnd() * 0.2)
      if (x % 4 === 1) c = mul(c, 0.75)
      if ((x === 1 || x === 14) && y % 4 === 2) c = [230, 230, 200]
      set(x, y, c)
    }
  }),
  cactus_top: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15
      set(x, y, edge ? [0, 0, 0] : mul([96, 160, 64], 0.9 + rnd() * 0.15), edge ? 0 : 255)
    }
  }),
  sandstone_top: tile((p) => noiseFill(p, [218, 206, 158], 0.08)),
  sandstone_side: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = mul([214, 200, 150], 0.95 + rnd() * 0.08)
      if (y < 3) c = mul(c, 1.05)
      if (y === 3 || y === 9 || y === 12) c = mul(c, 0.86)
      set(x, y, c)
    }
  }),
  wool_white: tile((p) => paintWool(p, [234, 234, 234])),
  wool_red: tile((p) => paintWool(p, [168, 44, 40])),
  wool_blue: tile((p) => paintWool(p, [52, 64, 168])),
  wool_yellow: tile((p) => paintWool(p, [228, 196, 48])),
  wool_green: tile((p) => paintWool(p, [88, 140, 40])),
  wool_black: tile((p) => paintWool(p, [32, 30, 34])),
  tallgrass: tile(({ set, rnd }) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, [0, 0, 0], 0)
    for (let b = 0; b < 9; b++) {
      const x0 = 1 + ((rnd() * 14) | 0), h = 5 + ((rnd() * 10) | 0), lean = rnd() < 0.5 ? -1 : 1
      for (let k = 0; k < h; k++) set(x0 + (k > h * 0.6 ? lean : 0), 15 - k, mul([96, 158, 56], 0.7 + rnd() * 0.45))
    }
  }),
  rose: tile((p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, [0, 0, 0], 0)
    paintFlower(p, [200, 30, 30], [120, 10, 10])
  }),
  dandelion: tile((p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, [0, 0, 0], 0)
    paintFlower(p, [250, 220, 40], [230, 160, 20])
  }),
}

export const TILE_INDEX = {}
export const TILE_COLOR = [] // average colour of each tile, for particles

export function buildAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')
  const names = Object.keys(PAINTERS)
  names.forEach((name, i) => {
    const buf = PAINTERS[name](1000 + i * 7919)
    const img = new ImageData(buf, T, T)
    ctx.putImageData(img, (i % PER_ROW) * T, Math.floor(i / PER_ROW) * T)
    TILE_INDEX[name] = i
    let r = 0, g = 0, b = 0, n = 0
    for (let k = 0; k < buf.length; k += 4) if (buf[k + 3] > 100) { r += buf[k]; g += buf[k + 1]; b += buf[k + 2]; n++ }
    TILE_COLOR[i] = n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1]
  })
  return canvas
}

// UV rectangle (u0, v0 = bottom-left, u1, v1 = top-right) for a tile, with a
// hair of inset so nearest sampling never bleeds into the neighbouring tile.
export function tileUV(index) {
  const e = 1 / 4096
  const col = index % PER_ROW, row = Math.floor(index / PER_ROW)
  const u0 = col / PER_ROW + e, u1 = (col + 1) / PER_ROW - e
  const v1 = 1 - row / PER_ROW - e, v0 = 1 - (row + 1) / PER_ROW + e
  return [u0, v0, u1, v1]
}

// Tile indices per block face, flattened [id * 6 + face]
export const FACE_TILE = new Uint16Array(256 * 6)
export function resolveFaceTiles() {
  for (let id = 1; id < BLOCK_COUNT; id++) {
    for (let f = 0; f < 6; f++) FACE_TILE[id * 6 + f] = TILE_INDEX[FACE_TILES[id][f]]
  }
}

export function makeIcon(atlas, id, size = 48) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const s = size / 48
  const src = (f) => {
    const t = FACE_TILE[id * 6 + f]
    return [(t % PER_ROW) * T, Math.floor(t / PER_ROW) * T]
  }
  if (CROSS[id]) {
    const [sx, sy] = src(0)
    ctx.drawImage(atlas, sx, sy, T, T, 6 * s, 6 * s, 36 * s, 36 * s)
    return c.toDataURL()
  }
  const face = (f, a, b, cc, d, e, ff, shade) => {
    const [sx, sy] = src(f)
    ctx.setTransform(a * s, b * s, cc * s, d * s, e * s, ff * s)
    ctx.drawImage(atlas, sx, sy, T, T, 0, 0, T, T)
    if (shade) {
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = `rgba(0,0,0,${shade})`
      ctx.fillRect(0, 0, T, T)
      ctx.globalCompositeOperation = 'source-over'
    }
  }
  // Faces only share edges, so each face's source-atop shading touches just itself.
  face(4, 21 / 16, 11 / 16, 0, 24 / 16, 3, 13, 0.22)
  face(5, 21 / 16, -11 / 16, 0, 24 / 16, 24, 24, 0.42)
  face(2, 21 / 16, -11 / 16, 21 / 16, 11 / 16, 3, 13, 0)
  return c.toDataURL()
}

// Blocky sun, moon and cloud textures for the sky.
export function makeSkyTextures() {
  const sun = document.createElement('canvas')
  sun.width = sun.height = 32
  let ctx = sun.getContext('2d')
  ctx.fillStyle = 'rgba(255,240,160,0.35)'; ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = '#fff7c8'; ctx.fillRect(6, 6, 20, 20)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(9, 9, 14, 14)

  const moon = document.createElement('canvas')
  moon.width = moon.height = 32
  ctx = moon.getContext('2d')
  ctx.fillStyle = '#dfe3ea'; ctx.fillRect(8, 8, 16, 16)
  ctx.fillStyle = '#b8bcc6'; ctx.fillRect(11, 11, 4, 4); ctx.fillRect(18, 17, 3, 3); ctx.fillRect(12, 19, 2, 2)

  const clouds = document.createElement('canvas')
  clouds.width = clouds.height = 64
  ctx = clouds.getContext('2d')
  const rnd = mulberry32(77)
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 46; i++) {
    const x = (rnd() * 64) | 0, y = (rnd() * 64) | 0, w = 3 + ((rnd() * 9) | 0), h = 2 + ((rnd() * 6) | 0)
    // draw wrapped copies so the texture tiles seamlessly
    for (const ox of [0, -64]) for (const oy of [0, -64]) ctx.fillRect(x + ox, y + oy, w, h)
  }
  return { sun, moon, clouds }
}

