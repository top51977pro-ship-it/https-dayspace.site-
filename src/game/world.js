// Infinite chunked voxel world: terrain generation, block edits, meshing with
// per-vertex ambient occlusion + simple sky shadowing, and voxel raycasting.
import * as THREE from 'three'
import { Noise, hash3 } from './noise.js'
import { B, OPAQUE, SOLID, CUTOUT, LIQUID, CROSS, SELF_CULL, SHADOW, TRANSLUCENT } from './blocks.js'
import { FACE_TILE, tileUV } from './textures.js'

export const CS = 16 // chunk size (x/z)
export const H = 96 // world height
export const SEA = 32

const P = CS + 2 // padded chunk width used by the mesher
const PP = P * P

const FACES = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.62 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.62 },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
]
const QUAD_UV = [[0, 0], [1, 0], [1, 1], [0, 1]]
const AO_LEVEL = [0.45, 0.65, 0.83, 1.0]
const SKY_SHADE = 0.58

const poff = (dx, dy, dz) => dy * PP + dz * P + dx
const FACE_OFF = FACES.map((f) => poff(...f.d))
// For every face corner: padded offsets of [side1, side2, corner] neighbours.
const AO_OFF = FACES.map((f) => {
  const axis = f.d.findIndex((v) => v !== 0)
  const tang = [0, 1, 2].filter((a) => a !== axis)
  return f.c.map((corner) => {
    const s1 = [...f.d], s2 = [...f.d]
    s1[tang[0]] += corner[tang[0]] ? 1 : -1
    s2[tang[1]] += corner[tang[1]] ? 1 : -1
    const cr = [...s1]; cr[tang[1]] += corner[tang[1]] ? 1 : -1
    return [poff(...s1), poff(...s2), poff(...cr)]
  })
})

const key = (cx, cz) => cx + ',' + cz

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz
    this.data = new Uint8Array(CS * CS * H)
    this.meshes = []
    this.meshed = false
  }
}

export class World {
  constructor(seed, scene, materials, edits = {}) {
    this.seed = seed | 0
    this.noise = new Noise(this.seed)
    this.noise2 = new Noise(this.seed ^ 0x5bd1e995)
    this.scene = scene
    this.materials = materials // [opaque, cutout, transparent]
    this.chunks = new Map()
    this.edits = new Map()
    for (const k in edits) {
      const arr = edits[k], m = new Map()
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1])
      this.edits.set(k, m)
    }
    this.dirty = new Set()
    this.queue = []
    this.lastCenter = null
    this.renderDistance = 5
    this.pad = new Uint8Array(PP * (H + 2))
    this.tops = new Int16Array(PP)
    this.uvCache = []
  }

  serializeEdits() {
    const out = {}
    for (const [k, m] of this.edits) {
      if (!m.size) continue
      const arr = []
      for (const [i, id] of m) arr.push(i, id)
      out[k] = arr
    }
    return out
  }

  // ---------- terrain ----------
  column(x, z) {
    const n = this.noise
    const cont = n.fbm2(x / 380, z / 380, 3)
    const hills = n.fbm2(x / 90 + 100, z / 90 - 40, 4)
    const m = n.fbm2(x / 220 - 300, z / 220 + 200, 3)
    const mnt = Math.max(0, Math.min(1, (m - 0.12) / 0.35))
    let h = SEA + 3 + cont * 14 + hills * (5 + mnt * 8) + mnt * mnt * 34
    h = Math.max(6, Math.min(H - 14, Math.floor(h)))
    const temp = this.noise2.fbm2(x / 420, z / 420, 2)
    const biome = h > SEA + 30 ? 'peak' : temp > 0.28 ? 'desert' : temp < -0.3 ? 'snow' : 'plains'
    return { h, biome }
  }

  heightAt(x, z) { return this.column(x, z).h }

  generate(cx, cz) {
    const c = new Chunk(cx, cz)
    const d = c.data
    const seed = this.seed
    const n = this.noise, n2 = this.noise2
    const x0 = cx * CS, z0 = cz * CS
    const heights = new Int16Array(CS * CS)
    const biomes = []
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const x = x0 + lx, z = z0 + lz
      const { h, biome } = this.column(x, z)
      heights[lz * CS + lx] = h
      biomes[lz * CS + lx] = biome
      const beach = h <= SEA + 1 && biome !== 'snow'
      const under = h < SEA
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id
        if (y === 0) id = B.BEDROCK
        else if (y < 3 && hash3(x, y, z, seed) < 0.5) id = B.BEDROCK
        else if (y > h) id = biome === 'snow' && y === SEA ? B.ICE : B.WATER
        else if (y === h) {
          if (under) id = n.noise2(x / 12, z / 12) > 0.3 ? B.GRAVEL : B.SAND
          else if (biome === 'desert' || beach) id = B.SAND
          else if (biome === 'snow') id = B.SNOWY_GRASS
          else if (biome === 'peak') id = h > SEA + 38 ? B.SNOW : B.STONE
          else id = B.GRASS
        } else if (y > h - 4) {
          if (biome === 'desert') id = y > h - 3 ? B.SAND : B.SANDSTONE
          else if (beach || under) id = B.SAND
          else if (biome === 'peak') id = B.STONE
          else id = B.DIRT
        } else {
          id = B.STONE
          // Ore veins in 2x2x2 clumps
          const vein = hash3(x >> 1, y >> 1, z >> 1, seed + 17)
          if (hash3(x, y, z, seed + 3) < 0.6) {
            if (y < 16 && vein < 0.004) id = B.DIAMOND
            else if (y < 30 && vein > 0.004 && vein < 0.010) id = B.GOLD
            else if (y < 50 && vein > 0.010 && vein < 0.028) id = B.IRON
            else if (vein > 0.028 && vein < 0.06) id = B.COAL
          }
        }
        d[(y * CS + lz) * CS + lx] = id
      }
      // Spaghetti caves: carve where two 3D noise fields both cross zero.
      const top = h < SEA + 3 ? h - 5 : h + 1 // let some caves break the surface on land
      for (let y = 4; y < top; y++) {
        const a = n.noise3(x / 32, y / 20, z / 32)
        if (a > 0.16 || a < -0.16) continue
        const b = n2.noise3(x / 32, y / 20, z / 32)
        if (a * a + b * b < 0.012) d[(y * CS + lz) * CS + lx] = B.AIR
      }
      // Vegetation
      const r = hash3(x, 7, z, seed)
      const topId = d[(h * CS + lz) * CS + lx]
      if (topId === B.GRASS && h + 1 < H) {
        const idx = ((h + 1) * CS + lz) * CS + lx
        if (r < 0.11) d[idx] = B.TALLGRASS
        else if (r < 0.118) d[idx] = B.ROSE
        else if (r < 0.126) d[idx] = B.DANDELION
      } else if (topId === B.SAND && biome === 'desert' && r < 0.004) {
        const ch = 1 + ((r * 1000) | 0) % 3
        for (let k = 1; k <= ch && h + k < H; k++) d[((h + k) * CS + lz) * CS + lx] = B.CACTUS
      }
    }

    // Trees may straddle chunk borders, so scan a margin and clip to this chunk.
    for (let tz = z0 - 3; tz < z0 + CS + 3; tz++) for (let tx = x0 - 3; tx < x0 + CS + 3; tx++) {
      const forest = n.noise2(tx / 120 + 50, tz / 120)
      const density = forest > 0.25 ? 0.045 : forest > -0.1 ? 0.008 : 0.0015
      const r = hash3(tx, 1, tz, seed)
      if (r >= density) continue
      const inside = tx >= x0 && tx < x0 + CS && tz >= z0 && tz < z0 + CS
      let h, biome
      if (inside) { h = heights[(tz - z0) * CS + (tx - x0)]; biome = biomes[(tz - z0) * CS + (tx - x0)] }
      else ({ h, biome } = this.column(tx, tz))
      if (h <= SEA || biome === 'desert' || biome === 'peak') continue
      if (inside && d[(h * CS + (tz - z0)) * CS + (tx - x0)] !== B.GRASS && d[(h * CS + (tz - z0)) * CS + (tx - x0)] !== B.SNOWY_GRASS) continue
      const birch = hash3(tx, 2, tz, seed) < 0.25
      this.placeTree(d, x0, z0, tx, h + 1, tz, 4 + ((r * 1e4) | 0) % 3, birch)
    }

    const ed = this.edits.get(key(cx, cz))
    if (ed) for (const [i, id] of ed) d[i] = id
    this.chunks.set(key(cx, cz), c)
    return c
  }

  placeTree(d, x0, z0, tx, by, tz, height, birch) {
    const log = birch ? B.BIRCH_LOG : B.LOG
    const leaf = birch ? B.BIRCH_LEAVES : B.LEAVES
    const put = (x, y, z, id, force) => {
      const lx = x - x0, lz = z - z0
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= H) return
      const i = (y * CS + lz) * CS + lx
      if (force || d[i] === B.AIR || d[i] === B.TALLGRASS) d[i] = id
    }
    const top = by + height
    for (let y = top - 3; y <= top; y++) {
      const rad = y >= top - 1 ? 1 : 2
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const corner = Math.abs(dx) === rad && Math.abs(dz) === rad
        if (corner && (y === top || hash3(tx + dx, y, tz + dz, this.seed) < 0.5)) continue
        put(tx + dx, y, tz + dz, leaf, false)
      }
    }
    for (let y = by; y < top; y++) put(tx, y, tz, log, true)
    put(tx, by - 1, tz, B.DIRT, true)
  }

  // ---------- access ----------
  getChunk(cx, cz) { return this.chunks.get(key(cx, cz)) }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK
    if (y >= H) return B.AIR
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS)
    const c = this.chunks.get(key(cx, cz))
    if (!c) return B.AIR
    return c.data[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)]
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS)
    const k = key(cx, cz)
    const c = this.chunks.get(k)
    if (!c) return false
    const lx = x - cx * CS, lz = z - cz * CS
    const i = (y * CS + lz) * CS + lx
    if (c.data[i] === id) return false
    c.data[i] = id
    let m = this.edits.get(k)
    if (!m) this.edits.set(k, (m = new Map()))
    m.set(i, id)
    this.editsChanged = true
    const xs = [0], zs = [0]
    if (lx === 0) xs.push(-1); if (lx === CS - 1) xs.push(1)
    if (lz === 0) zs.push(-1); if (lz === CS - 1) zs.push(1)
    for (const dx of xs) for (const dz of zs) {
      const n = this.chunks.get(key(cx + dx, cz + dz))
      if (n && n.meshed) this.dirty.add(n)
    }
    return true
  }

  isSolidAt(x, y, z) { return SOLID[this.getBlock(x, y, z)] === 1 }

  ensureChunk(cx, cz) { return this.getChunk(cx, cz) || this.generate(cx, cz) }

  // ---------- meshing ----------
  uv(tile) { return this.uvCache[tile] || (this.uvCache[tile] = tileUV(tile)) }

  buildMesh(c) {
    const pad = this.pad, tops = this.tops
    pad.fill(0)
    pad.fill(B.BEDROCK, 0, PP) // below the world counts as solid
    for (let pz = 0; pz < P; pz++) for (let px = 0; px < P; px++) {
      const wx = c.cx * CS + px - 1, wz = c.cz * CS + pz - 1
      const ncx = Math.floor(wx / CS), ncz = Math.floor(wz / CS)
      const src = ncx === c.cx && ncz === c.cz ? c : this.chunks.get(key(ncx, ncz))
      let top = -1
      if (src) {
        const lx = wx - ncx * CS, lz = wz - ncz * CS
        const sd = src.data
        for (let y = 0; y < H; y++) {
          const id = sd[(y * CS + lz) * CS + lx]
          pad[(y + 1) * PP + pz * P + px] = id
          if (SHADOW[id]) top = y
        }
      }
      tops[pz * P + px] = top
    }

    const layers = [0, 1, 2].map(() => ({ pos: [], uv: [], col: [], idx: [] }))
    const ao = [0, 0, 0, 0]
    for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const p = (y + 1) * PP + (z + 1) * P + (x + 1)
      const id = pad[p]
      if (!id) continue
      if (CROSS[id]) {
        const sh = (y < tops[(z + 1) * P + x + 1] ? SKY_SHADE : 1) * 0.92
        this.pushCross(layers[1], x, y, z, FACE_TILE[id * 6], sh)
        continue
      }
      const liquid = LIQUID[id]
      const L = liquid || TRANSLUCENT[id] ? layers[2] : CUTOUT[id] ? layers[1] : layers[0]
      const yTop = liquid && !LIQUID[pad[p + PP]] ? 0.875 : 1
      for (let f = 0; f < 6; f++) {
        const nid = pad[p + FACE_OFF[f]]
        if (nid !== 0) {
          if (OPAQUE[nid]) continue
          if (liquid) { if (LIQUID[nid]) continue }
          else if (nid === id && SELF_CULL[id]) continue
        }
        const d = FACES[f].d
        const nx = x + d[0], ny = y + d[1], nz = z + d[2]
        const sky = ny < tops[(nz + 1) * P + nx + 1] ? SKY_SHADE : 1
        const base = FACES[f].shade * sky
        if (liquid) { ao[0] = ao[1] = ao[2] = ao[3] = 3 }
        else {
          const offs = AO_OFF[f]
          for (let k = 0; k < 4; k++) {
            const o = offs[k]
            const s1 = OPAQUE[pad[p + o[0]]], s2 = OPAQUE[pad[p + o[1]]], cr = OPAQUE[pad[p + o[2]]]
            ao[k] = s1 && s2 ? 0 : 3 - s1 - s2 - cr
          }
        }
        this.pushQuad(L, x, y, z, f, FACE_TILE[id * 6 + f], base, ao, yTop)
      }
    }

    for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose() }
    c.meshes = []
    layers.forEach((L, i) => {
      if (!L.idx.length) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2))
      g.setAttribute('color', new THREE.Float32BufferAttribute(L.col, 3))
      g.setIndex(L.idx)
      g.computeBoundingSphere()
      const mesh = new THREE.Mesh(g, this.materials[i])
      mesh.position.set(c.cx * CS, 0, c.cz * CS)
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      if (i === 2) mesh.renderOrder = 1
      this.scene.add(mesh)
      c.meshes.push(mesh)
    })
    c.meshed = true
  }

  pushQuad(L, x, y, z, f, tile, base, ao, yTop) {
    const [u0, v0, u1, v1] = this.uv(tile)
    const corners = FACES[f].c
    const start = L.pos.length / 3
    for (let k = 0; k < 4; k++) {
      const cr = corners[k]
      L.pos.push(x + cr[0], y + (cr[1] ? yTop : 0), z + cr[2])
      L.uv.push(u0 + QUAD_UV[k][0] * (u1 - u0), v0 + QUAD_UV[k][1] * (v1 - v0))
      const l = base * AO_LEVEL[ao[k]]
      L.col.push(l, l, l)
    }
    if (ao[0] + ao[2] < ao[1] + ao[3]) L.idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start)
    else L.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }

  pushCross(L, x, y, z, tile, shade) {
    const [u0, v0, u1, v1] = this.uv(tile)
    const a = 0.15, b = 0.85
    const quads = [
      [[a, a], [b, b]],
      [[a, b], [b, a]],
    ]
    for (const [[ax, az], [bx, bz]] of quads) {
      const start = L.pos.length / 3
      L.pos.push(x + ax, y, z + az, x + bx, y, z + bz, x + bx, y + 1, z + bz, x + ax, y + 1, z + az)
      L.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
      for (let k = 0; k < 4; k++) L.col.push(shade, shade, shade)
      L.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
    }
  }

  // ---------- streaming ----------
  // Generates and meshes chunks nearest the player first, within a time budget.
  update(px, pz, budgetMs = 6) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS)
    const R = this.renderDistance

    for (const c of this.dirty) this.buildMesh(c)
    this.dirty.clear()

    const center = pcx + ',' + pcz + ',' + R
    if (center !== this.lastCenter) {
      this.lastCenter = center
      const list = []
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz
        if (d2 > R * R + 1) continue
        list.push([d2, pcx + dx, pcz + dz])
      }
      list.sort((a, b) => a[0] - b[0])
      this.queue = list
      // Unload far chunks (edits live on in this.edits).
      for (const [k, c] of this.chunks) {
        const dx = c.cx - pcx, dz = c.cz - pcz
        if (dx * dx + dz * dz > (R + 2) * (R + 2) + 1) {
          for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose() }
          this.chunks.delete(k)
        }
      }
    }

    const start = performance.now()
    let built = 0
    while (this.queue.length) {
      const [, cx, cz] = this.queue[0]
      const c = this.getChunk(cx, cz)
      if (c && c.meshed) { this.queue.shift(); continue }
      if (built > 0 && performance.now() - start > budgetMs) break
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.ensureChunk(cx + dx, cz + dz)
      this.buildMesh(this.getChunk(cx, cz))
      this.queue.shift()
      built++
    }
    return this.queue.length
  }

  dispose() {
    for (const c of this.chunks.values()) for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose() }
    this.chunks.clear()
  }

  // ---------- raycast (Amanatides & Woo voxel traversal) ----------
  raycast(o, dir, maxDist) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z)
    const sx = dir.x > 0 ? 1 : -1, sy = dir.y > 0 ? 1 : -1, sz = dir.z > 0 ? 1 : -1
    const tdx = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity
    const tdy = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity
    const tdz = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity
    let tmx = dir.x !== 0 ? (dir.x > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity
    let tmy = dir.y !== 0 ? (dir.y > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity
    let tmz = dir.z !== 0 ? (dir.z > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity
    let nx = 0, ny = 0, nz = 0, t = 0
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z)
      if (id && !LIQUID[id]) return { x, y, z, id, nx, ny, nz }
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0 }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0 }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz }
    }
    return null
  }
}
