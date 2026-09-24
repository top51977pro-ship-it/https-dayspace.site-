// PocketCraft — a Pocket-Edition style voxel sandbox for the browser.
import * as THREE from 'three'
import './game.css'
import { B, NAME, CREATIVE, DEFAULT_HOTBAR, SOLID, OPAQUE, LIQUID, CROSS, REPLACEABLE, SOUND } from './blocks.js'
import { buildAtlas, resolveFaceTiles, makeIcon, makeSkyTextures, FACE_TILE, TILE_COLOR, TILE_INDEX, tileUV } from './textures.js'
import { World, H, SEA } from './world.js'
import { Player, EYE } from './player.js'
import { unlockAudio, playSound, playExplosion, playFuse, setSoundEnabled } from './audio.js'
import { hash3 } from './noise.js'

THREE.ColorManagement.enabled = false

const $ = (id) => document.getElementById(id)
const SAVE_KEY = 'pocketcraft.world.v1'
const SETTINGS_KEY = 'pocketcraft.settings.v1'
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } },
}

const coarse = matchMedia('(pointer: coarse)').matches
let touchMode = coarse
const settings = Object.assign(
  { renderDistance: coarse ? 4 : 6, sensitivity: 1, sound: true, dayCycle: true, autoJump: true, showDebug: false },
  store.get(SETTINGS_KEY) || {},
)
setSoundEnabled(settings.sound)
const saveSettings = () => store.set(SETTINGS_KEY, settings)

// ---------------------------------------------------------------- renderer
const canvas = $('game')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2))
renderer.autoClear = false

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x78a7ff, 40, 80)
const skyColor = new THREE.Color(0x78a7ff)
const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 700)
camera.rotation.order = 'YXZ'

const atlasCanvas = buildAtlas()
resolveFaceTiles()
const nearest = (tex) => { tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; return tex }
const atlas = nearest(new THREE.CanvasTexture(atlasCanvas))

const matOpaque = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true })
const matCutout = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })
const matWater = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })
const worldMats = [matOpaque, matCutout, matWater]

const ICONS = {}
for (const id of CREATIVE) ICONS[id] = makeIcon(atlasCanvas, id, 64)

// ---------------------------------------------------------------- sky
const skyTex = makeSkyTextures()
const sun = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: nearest(new THREE.CanvasTexture(skyTex.sun)), transparent: true, fog: false, depthWrite: false }))
const moon = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ map: nearest(new THREE.CanvasTexture(skyTex.moon)), transparent: true, fog: false, depthWrite: false }))
scene.add(sun, moon)

const CLOUD_TEXEL = 12
const cloudTex = nearest(new THREE.CanvasTexture(skyTex.clouds))
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping
const CLOUD_PLANE = 1100
cloudTex.repeat.set(CLOUD_PLANE / (64 * CLOUD_TEXEL), CLOUD_PLANE / (64 * CLOUD_TEXEL))
const fadeCanvas = document.createElement('canvas')
fadeCanvas.width = fadeCanvas.height = 64
{
  const g = fadeCanvas.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32)
  grd.addColorStop(0, '#fff'); grd.addColorStop(1, '#000')
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64)
}
const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, alphaMap: new THREE.CanvasTexture(fadeCanvas), transparent: true, opacity: 0.82, fog: false, depthWrite: false, side: THREE.DoubleSide })
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(CLOUD_PLANE, CLOUD_PLANE), cloudMat)
clouds.rotation.x = -Math.PI / 2
clouds.renderOrder = 2
scene.add(clouds)

// ---------------------------------------------------------------- effects
const selection = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
)
selection.visible = false
scene.add(selection)

const MAXP = 600
const pPos = new Float32Array(MAXP * 3)
const pCol = new Float32Array(MAXP * 3)
const pGeo = new THREE.BufferGeometry()
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
const pMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true })
const points = new THREE.Points(pGeo, pMat)
points.frustumCulled = false
scene.add(points)
const particles = []

function spawnParticles(x, y, z, id, n = 16) {
  const col = TILE_COLOR[FACE_TILE[id * 6 + 4]] || [1, 1, 1]
  for (let i = 0; i < n && particles.length < MAXP; i++) {
    const k = 0.75 + Math.random() * 0.4
    particles.push({
      x: x + 0.2 + Math.random() * 0.6, y: y + 0.2 + Math.random() * 0.6, z: z + 0.2 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3,
      life: 0.5 + Math.random() * 0.6, r: col[0] * k, g: col[1] * k, b: col[2] * k, grav: 14,
    })
  }
}
function spawnSmoke(x, y, z, n) {
  for (let i = 0; i < n && particles.length < MAXP; i++) {
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 2 + Math.random() * 6
    const r = Math.sqrt(1 - u * u)
    const g = 0.6 + Math.random() * 0.4
    particles.push({ x, y, z, vx: Math.cos(a) * r * s, vy: u * s + 1, vz: Math.sin(a) * r * s, life: 0.6 + Math.random() * 0.9, r: g, g, b: g, grav: -1 })
  }
}
function updateParticles(dt) {
  let n = 0
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue }
    p.vy -= p.grav * dt
    const ny = p.y + p.vy * dt
    if (p.grav > 0 && SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))]) { p.vy = 0; p.vx *= 0.8; p.vz *= 0.8 } else p.y = ny
    p.x += p.vx * dt; p.z += p.vz * dt
  }
  for (const p of particles) {
    pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z
    pCol[n * 3] = p.r; pCol[n * 3 + 1] = p.g; pCol[n * 3 + 2] = p.b
    n++
  }
  pGeo.setDrawRange(0, n)
  pGeo.attributes.position.needsUpdate = true
  pGeo.attributes.color.needsUpdate = true
}

// A textured cube (or flat sprite for plants) for the held item and primed TNT.
function blockGeometry(id) {
  if (CROSS[id]) {
    const g = new THREE.PlaneGeometry(1, 1)
    const [u0, v0, u1, v1] = tileUV(FACE_TILE[id * 6])
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(uv.count * 3).fill(1), 3))
    return g
  }
  const g = new THREE.BoxGeometry(1, 1, 1)
  const uv = g.attributes.uv
  const shades = [0.62, 0.62, 1, 0.5, 0.8, 0.8]
  const colors = []
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = tileUV(FACE_TILE[id * 6 + f])
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
      colors.push(shades[f], shades[f], shades[f])
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return g
}

// Held block, drawn in its own scene on top of the world.
const handScene = new THREE.Scene()
const handCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10)
const handMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })
const hand = new THREE.Mesh(new THREE.BufferGeometry(), handMat)
handScene.add(hand)
let handId = -1
let swingT = 0
function setHand(id) {
  if (id === handId) return
  handId = id
  hand.geometry.dispose()
  hand.geometry = blockGeometry(id)
}

// Primed TNT entities.
const tntGeo = blockGeometry(B.TNT)
const tntMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true })
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
const primed = []

// ---------------------------------------------------------------- state
let state = 'title'
let world = null
let player = null
let save = store.get(SAVE_KEY)
let hotbar = [...DEFAULT_HOTBAR]
let selected = 0
let time = 0.06
let shake = 0
let panoramaYaw = 0
let bobAmp = 0
let lastStep = 0

function newSeed() { return (Math.random() * 2 ** 31) | 0 }

function seedFromText(text) {
  const t = String(text || '').trim()
  if (!t) return newSeed()
  if (/^-?\d+$/.test(t)) return Number(t) | 0
  let h = 0
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) | 0
  return h
}

function loadWorld(seed, edits) {
  if (world) world.dispose()
  for (const t of primed) scene.remove(t.mesh)
  primed.length = 0
  particles.length = 0
  world = new World(seed, scene, worldMats, edits || {})
  world.renderDistance = settings.renderDistance
  player = new Player(world)
  player.autoJump = touchMode && settings.autoJump
}

function findSpawn() {
  for (let r = 0; r < 400; r += 8) {
    for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r)
      const { h, biome } = world.column(x, z)
      if (h > SEA + 1 && biome !== 'peak') return spawnAt(x, z)
      if (r === 0) break
    }
  }
  return spawnAt(0, 0)
}
function spawnAt(x, z) {
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16)
  world.ensureChunk(cx, cz)
  let y = H - 1
  while (y > 0 && !SOLID[world.getBlock(x, y, z)]) y--
  player.pos.set(x + 0.5, y + 1.01, z + 0.5)
  player.vel.set(0, 0, 0)
  return player.pos
}

function saveGame() {
  if (!world || !player || state === 'title') return
  const ok = store.set(SAVE_KEY, {
    seed: world.seed, time, hotbar, selected,
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    edits: world.serializeEdits(),
  })
  if (ok) save = store.get(SAVE_KEY)
}

// ---------------------------------------------------------------- UI
const ui = {
  hud: $('hud'), hotbar: $('hotbar'), toast: $('toast'), debug: $('debug'), ring: $('break-ring'),
  water: $('water-tint'), dpad: $('dpad'), title: $('title'), pause: $('pause'), inventory: $('inventory'),
  invGrid: $('inv-grid'), newWorld: $('new-world'), help: $('help'), loading: $('loading'), crosshair: $('crosshair'),
}

function show(el, on) { el.hidden = !on }

function setTouchMode(on) {
  touchMode = on
  document.body.classList.toggle('touch', on)
  if (player) player.autoJump = on && settings.autoJump
}
setTouchMode(touchMode)

let toastTimer = 0
function toast(text) {
  ui.toast.textContent = text
  ui.toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1600)
}

function renderHotbar() {
  ui.hotbar.innerHTML = ''
  hotbar.forEach((id, i) => {
    const b = document.createElement('button')
    b.className = 'slot' + (i === selected ? ' sel' : '')
    b.setAttribute('aria-label', NAME[id])
    b.innerHTML = `<img src="${ICONS[id]}" alt="" draggable="false">`
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); select(i) })
    ui.hotbar.append(b)
  })
}
function select(i) {
  selected = (i + 9) % 9
  ;[...ui.hotbar.children].forEach((el, k) => el.classList.toggle('sel', k === selected))
  toast(NAME[hotbar[selected]])
  setHand(hotbar[selected])
}

function renderInventory() {
  ui.invGrid.innerHTML = ''
  for (const id of CREATIVE) {
    const b = document.createElement('button')
    b.className = 'slot'
    b.title = NAME[id]
    b.innerHTML = `<img src="${ICONS[id]}" alt="${NAME[id]}" draggable="false">`
    b.addEventListener('click', () => {
      const existing = hotbar.indexOf(id)
      if (existing >= 0 && existing !== selected) hotbar[existing] = hotbar[selected]
      hotbar[selected] = id
      renderHotbar()
      select(selected)
      closeInventory()
    })
    ui.invGrid.append(b)
  }
}

function lockPointer() {
  if (touchMode || !canvas.requestPointerLock) return
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}) } catch { /* not allowed right now */ }
}
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock() }

function enterPlay() {
  state = 'playing'
  show(ui.title, false); show(ui.pause, false); show(ui.inventory, false); show(ui.newWorld, false); show(ui.help, false)
  show(ui.hud, true)
  lockPointer()
}

function startGame(fresh, seedText) {
  unlockAudio()
  show(ui.title, false); show(ui.newWorld, false)
  show(ui.loading, true)
  if (coarse && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
      .catch(() => {})
  }
  // Let the loading screen paint before the heavy first generation pass.
  requestAnimationFrame(() => setTimeout(() => {
    if (fresh) {
      loadWorld(seedFromText(seedText), {})
      hotbar = [...DEFAULT_HOTBAR]; selected = 0; time = 0.06
      findSpawn()
      player.yaw = Math.PI * 0.25
    } else if (save) {
      loadWorld(save.seed, save.edits)
      hotbar = save.hotbar || [...DEFAULT_HOTBAR]; selected = save.selected || 0; time = save.time ?? 0.06
      const p = save.player
      if (p) {
        world.ensureChunk(Math.floor(p.x / 16), Math.floor(p.z / 16))
        player.pos.set(p.x, p.y, p.z); player.yaw = p.yaw; player.pitch = p.pitch; player.flying = !!p.flying
      } else findSpawn()
    }
    player.autoJump = touchMode && settings.autoJump
    world.update(player.pos.x, player.pos.z, 250)
    renderHotbar()
    handId = -1
    setHand(hotbar[selected])
    show(ui.loading, false)
    enterPlay()
    saveGame()
  }, 30))
}

function pauseGame() {
  if (state !== 'playing') return
  state = 'paused'
  resetInputs()
  unlockPointer()
  syncOptions()
  show(ui.pause, true)
  saveGame()
}
function resumeGame() { enterPlay() }

function openInventory() {
  if (state !== 'playing') return
  state = 'inventory'
  resetInputs()
  unlockPointer()
  show(ui.inventory, true)
}
function closeInventory() {
  if (state !== 'inventory') return
  enterPlay()
}

function quitToTitle() {
  saveGame()
  state = 'title'
  unlockPointer()
  show(ui.pause, false); show(ui.hud, false); show(ui.title, true)
  $('btn-play').textContent = 'Play'
  selection.visible = false
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {})
}

// Options panel
function syncOptions() {
  $('opt-rd-val').textContent = settings.renderDistance + ' chunks'
  $('opt-sens').value = settings.sensitivity
  $('opt-sound').textContent = 'Sound: ' + (settings.sound ? 'ON' : 'OFF')
  $('opt-day').textContent = 'Day cycle: ' + (settings.dayCycle ? 'ON' : 'OFF')
  $('opt-jump').textContent = 'Auto-jump: ' + (settings.autoJump ? 'ON' : 'OFF')
  $('opt-debug').textContent = 'Coordinates: ' + (settings.showDebug ? 'ON' : 'OFF')
}
function setRenderDistance(v) {
  settings.renderDistance = Math.max(2, Math.min(12, v))
  if (world) world.renderDistance = settings.renderDistance
  saveSettings(); syncOptions()
}
$('opt-rd-minus').onclick = () => setRenderDistance(settings.renderDistance - 1)
$('opt-rd-plus').onclick = () => setRenderDistance(settings.renderDistance + 1)
$('opt-sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); saveSettings() }
$('opt-sound').onclick = () => { settings.sound = !settings.sound; setSoundEnabled(settings.sound); saveSettings(); syncOptions() }
$('opt-day').onclick = () => { settings.dayCycle = !settings.dayCycle; saveSettings(); syncOptions() }
$('opt-jump').onclick = () => { settings.autoJump = !settings.autoJump; if (player) player.autoJump = touchMode && settings.autoJump; saveSettings(); syncOptions() }
$('opt-debug').onclick = () => { settings.showDebug = !settings.showDebug; saveSettings(); syncOptions() }
$('btn-resume').onclick = resumeGame
$('btn-quit').onclick = quitToTitle

// With no save yet, Play starts the world already shown in the title panorama.
$('btn-play').onclick = () => (save ? startGame(false) : startGame(true, String(world.seed)))
$('btn-new').onclick = () => {
  $('seed-input').value = ''
  $('new-warning').hidden = !save
  show(ui.title, false); show(ui.newWorld, true)
}
$('btn-create').onclick = () => startGame(true, $('seed-input').value)
$('btn-cancel-new').onclick = () => { show(ui.newWorld, false); show(ui.title, true) }
$('btn-help').onclick = () => { show(ui.title, false); show(ui.help, true) }
$('btn-help-back').onclick = () => { show(ui.help, false); show(ui.title, true) }
$('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pauseGame() })
$('btn-inv').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); openInventory() })
$('btn-inv-close').onclick = closeInventory
$('btn-fly').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFly() })
$('btn-play').textContent = save ? 'Play' : 'Play (new world)'

const SPLASHES = ['Now in your pocket!', 'Tap to place!', 'Hold to break!', 'Infinite worlds!', 'Also try TNT!', '100% blocks!', 'Pixel perfect!', 'Made with Three.js!', 'Touch the grass!', 'Double-tap to fly!']
$('splash').textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0]
{
  // Logo text filled with the stone texture from the atlas
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const t = TILE_INDEX.cobblestone
  c.getContext('2d').drawImage(atlasCanvas, (t % 16) * 16, Math.floor(t / 16) * 16, 16, 16, 0, 0, 16, 16)
  document.documentElement.style.setProperty('--logo-tex', `url(${c.toDataURL()})`)
}

function toggleFly() {
  if (!player) return
  player.flying = !player.flying
  if (player.flying) player.vel.y = 0
  toast(player.flying ? 'Flying ON' : 'Flying OFF')
}

// ---------------------------------------------------------------- actions
const REACH = 6
const tmpV = new THREE.Vector3()
const rayDir = new THREE.Vector3()

function centerTarget() {
  camera.getWorldDirection(rayDir)
  return world.raycast(camera.position, rayDir, REACH)
}
function screenTarget(sx, sy) {
  const r = canvas.getBoundingClientRect()
  tmpV.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1, 0.5).unproject(camera)
  rayDir.copy(tmpV).sub(camera.position).normalize()
  return world.raycast(camera.position, rayDir, REACH)
}

function breakBlock(hit) {
  if (!hit) return
  const { x, y, z, id } = hit
  if (id === B.BEDROCK && y === 0) return
  world.setBlock(x, y, z, B.AIR)
  spawnParticles(x, y, z, id)
  playSound(SOUND[id])
  swingT = 1
  // Plants lose their footing; open water flows into the gap.
  const above = world.getBlock(x, y + 1, z)
  if (CROSS[above]) { world.setBlock(x, y + 1, z, B.AIR); spawnParticles(x, y + 1, z, above, 6) }
  for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    if (LIQUID[world.getBlock(x + dx, y + dy, z + dz)]) { world.setBlock(x, y, z, B.WATER); break }
  }
}

function useBlock(hit, sneaking = false) {
  if (!hit) return
  if (hit.id === B.TNT && !sneaking) { igniteTNT(hit.x, hit.y, hit.z, 3); swingT = 1; return }
  const id = hotbar[selected]
  let tx = hit.x, ty = hit.y, tz = hit.z
  if (!REPLACEABLE[hit.id]) { tx += hit.nx; ty += hit.ny; tz += hit.nz }
  if (ty < 0 || ty >= H) return
  if (!REPLACEABLE[world.getBlock(tx, ty, tz)]) return
  if (SOLID[id] && player.overlapsBlock(tx, ty, tz)) return
  if (CROSS[id] && !OPAQUE[world.getBlock(tx, ty - 1, tz)]) return
  if (world.setBlock(tx, ty, tz, id)) {
    playSound(SOUND[id], 0.8, 1.15)
    swingT = 1
  }
}

function pickBlock(hit) {
  if (!hit || !CREATIVE.includes(hit.id)) return
  const i = hotbar.indexOf(hit.id)
  if (i >= 0) return select(i)
  hotbar[selected] = hit.id
  renderHotbar(); select(selected)
}

function igniteTNT(x, y, z, fuse) {
  world.setBlock(x, y, z, B.AIR)
  const mesh = new THREE.Mesh(tntGeo, tntMat)
  const flash = new THREE.Mesh(tntGeo, flashMat.clone())
  flash.scale.setScalar(1.02)
  mesh.add(flash)
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5)
  scene.add(mesh)
  primed.push({ mesh, flash, vy: 2.5, fuse, t: fuse })
  playFuse()
}

function updateTNT(dt) {
  for (let i = primed.length - 1; i >= 0; i--) {
    const t = primed[i]
    const p = t.mesh.position
    t.vy -= 20 * dt
    const ny = p.y + t.vy * dt
    if (t.vy < 0 && SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny - 0.5), Math.floor(p.z))]) { p.y = Math.floor(ny - 0.5) + 1.5; t.vy = 0 } else p.y = ny
    t.t -= dt
    t.flash.material.opacity = Math.floor(t.t * 5) % 2 ? 0.7 : 0
    const s = t.t < 0.4 ? 1 + (0.4 - t.t) * 0.5 : 1
    t.mesh.scale.setScalar(s)
    if (t.t <= 0) {
      scene.remove(t.mesh)
      t.flash.material.dispose()
      primed.splice(i, 1)
      explode(p.x, p.y, p.z)
    }
  }
}

function explode(cx, cy, cz) {
  const R = 3.8
  const seed = (Math.random() * 1e9) | 0
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz)
        if (d > R - hash3(x, y, z, seed) * 1.4) continue
        const id = world.getBlock(x, y, z)
        if (!id || id === B.OBSIDIAN || LIQUID[id] || (id === B.BEDROCK && y === 0)) continue
        if (id === B.TNT) { igniteTNT(x, y, z, 0.5 + Math.random() * 1); continue }
        world.setBlock(x, y, z, B.AIR)
        if (Math.random() < 0.15) spawnParticles(x, y, z, id, 3)
      }
  // Drop plants left floating by the blast.
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R) + 1; y++)
    for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++)
        if (CROSS[world.getBlock(x, y, z)] && !OPAQUE[world.getBlock(x, y - 1, z)]) world.setBlock(x, y, z, B.AIR)
  spawnSmoke(cx, cy, cz, 90)
  playExplosion()
  const e = player.eye(tmpV)
  const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz
  const d = Math.hypot(dx, dy, dz)
  shake = Math.max(shake, Math.max(0, 1 - d / 24))
  if (d < 7) {
    const k = (7 - d) * 3 / Math.max(d, 0.5)
    player.vel.x += dx * k; player.vel.y += Math.max(4, dy * k); player.vel.z += dz * k
  }
}

// ---------------------------------------------------------------- input
const keys = new Set()
const dpad = { keys: new Set(), sprint: false }
let sprintLatch = false
let lastJumpTap = 0, lastFwdTap = 0, lastW = 0
const mouse = { left: false, right: false, nextBreak: 0, nextUse: 0 }
let look = null // active touch-look finger

function resetInputs() {
  keys.clear()
  dpad.keys.clear(); dpadPointers.clear(); refreshDpad()
  mouse.left = mouse.right = false
  look = null
  ui.ring.hidden = true
}

function jumpPressed() {
  const now = performance.now()
  if (now - lastJumpTap < 300) { toggleFly(); lastJumpTap = 0 } else lastJumpTap = now
}

function gatherInput() {
  let f = 0, s = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1
  const d = dpad.keys
  if (d.has('f') || d.has('fl') || d.has('fr')) f += 1
  if (d.has('b')) f -= 1
  if (d.has('r') || d.has('fr')) s += 1
  if (d.has('l') || d.has('fl')) s -= 1
  return {
    forward: Math.max(-1, Math.min(1, f)),
    strafe: Math.max(-1, Math.min(1, s)),
    jump: keys.has('Space') || d.has('j'),
    down: keys.has('ShiftLeft') || keys.has('ShiftRight') || d.has('dn'),
    sprint: keys.has('ControlLeft') || sprintLatch || dpad.sprint,
  }
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return
  if (state === 'inventory' && (e.code === 'KeyE' || e.code === 'Escape')) { closeInventory(); return }
  if (state === 'paused' && e.code === 'Escape') { resumeGame(); return }
  if (state !== 'playing') return
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
  if (touchMode && !e.repeat) setTouchMode(false)
  if (!e.repeat) {
    if (e.code === 'Space') jumpPressed()
    if (e.code === 'KeyW') { const now = performance.now(); if (now - lastW < 280) sprintLatch = true; lastW = now }
    if (e.code === 'KeyF') toggleFly()
    if (e.code === 'KeyE') { openInventory(); return }
    if (e.code === 'F3') { e.preventDefault(); settings.showDebug = !settings.showDebug; saveSettings() }
    if (e.code === 'KeyP' || e.code === 'Escape') { pauseGame(); return }
    if (/^Digit[1-9]$/.test(e.code)) select(Number(e.code.slice(5)) - 1)
  }
  keys.add(e.code)
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.code)
  if (e.code === 'KeyW') sprintLatch = false
})
window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; sprintLatch = false })

window.addEventListener('wheel', (e) => {
  if (state !== 'playing') return
  select(selected + (e.deltaY > 0 ? 1 : -1))
}, { passive: true })

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !touchMode) pauseGame()
})

// Mouse (desktop): pointer lock look, left = break, right = place/use, middle = pick
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing' || touchMode) return
  unlockAudio()
  if (document.pointerLockElement !== canvas) { lockPointer(); return }
  const now = performance.now()
  if (e.button === 0) { mouse.left = true; breakBlock(centerTarget()); mouse.nextBreak = now + 250 }
  else if (e.button === 2) { mouse.right = true; useBlock(centerTarget(), keys.has('ShiftLeft') || keys.has('ShiftRight')); mouse.nextUse = now + 250 }
  else if (e.button === 1) { e.preventDefault(); pickBlock(centerTarget()) }
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false
  if (e.button === 2) mouse.right = false
})
document.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== canvas || !player) return
  const k = 0.0022 * settings.sensitivity
  player.yaw -= e.movementX * k
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * k))
})
window.addEventListener('contextmenu', (e) => e.preventDefault())

// Touch: drag to look, tap to place, hold to break (Pocket Edition style)
const HOLD_MS = 260
const BREAK_TIME = 0.22
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') { if (touchMode) setTouchMode(false); return }
  e.preventDefault()
  unlockAudio()
  if (!touchMode) setTouchMode(true)
  if (state !== 'playing' || look) return
  canvas.setPointerCapture(e.pointerId)
  look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, holding: false, target: null, progress: 0 }
})
canvas.addEventListener('pointermove', (e) => {
  if (!look || e.pointerId !== look.id || !player) return
  const k = 0.0055 * settings.sensitivity
  player.yaw -= (e.clientX - look.x) * k
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - (e.clientY - look.y) * k))
  look.x = e.clientX; look.y = e.clientY
  if (!look.holding && Math.hypot(look.x - look.sx, look.y - look.sy) > 12) look.moved = true
})
function endLook(e) {
  if (!look || e.pointerId !== look.id) return
  const tap = !look.moved && !look.holding && performance.now() - look.t0 < HOLD_MS + 40
  if (tap && state === 'playing') useBlock(screenTarget(look.x, look.y))
  look = null
  ui.ring.hidden = true
}
canvas.addEventListener('pointerup', endLook)
canvas.addEventListener('pointercancel', endLook)

// D-pad: fingers can slide between arrows; several fingers may be down at once.
const DP_LAYOUT = [['fl', 'f', 'fr'], ['l', 'j', 'r'], ['dn', 'b', '']]
const dpadPointers = new Map()
function dpKeyAt(e) {
  const r = ui.dpad.getBoundingClientRect()
  const col = Math.floor(((e.clientX - r.left) / r.width) * 3)
  const row = Math.floor(((e.clientY - r.top) / r.height) * 3)
  if (col < 0 || col > 2 || row < 0 || row > 2) return ''
  const k = DP_LAYOUT[row][col]
  if (k === 'dn' && !(player && player.flying)) return ''
  return k
}
function refreshDpad() {
  const active = new Set(dpadPointers.values())
  dpad.keys = active
  if (!active.has('f') && !active.has('fl') && !active.has('fr')) dpad.sprint = false
  for (const el of ui.dpad.children) el.classList.toggle('on', active.has(el.dataset.k))
  ui.dpad.classList.toggle('moving', active.has('f') || active.has('fl') || active.has('fr'))
}
function dpadPress(k) {
  const now = performance.now()
  if (k === 'j') jumpPressed()
  if (k === 'f') { if (now - lastFwdTap < 300) dpad.sprint = true; lastFwdTap = now }
}
ui.dpad.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation()
  unlockAudio()
  if (!touchMode) setTouchMode(true)
  ui.dpad.setPointerCapture(e.pointerId)
  const k = dpKeyAt(e)
  dpadPointers.set(e.pointerId, k)
  dpadPress(k)
  refreshDpad()
})
ui.dpad.addEventListener('pointermove', (e) => {
  if (!dpadPointers.has(e.pointerId)) return
  const k = dpKeyAt(e)
  if (k !== dpadPointers.get(e.pointerId)) { dpadPointers.set(e.pointerId, k); dpadPress(k === 'j' ? '' : k); refreshDpad() }
})
const dpadUp = (e) => { dpadPointers.delete(e.pointerId); refreshDpad() }
ui.dpad.addEventListener('pointerup', dpadUp)
ui.dpad.addEventListener('pointercancel', dpadUp)

document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); if (state === 'playing' && touchMode) pauseGame() } })
window.addEventListener('pagehide', saveGame)
setInterval(() => { if (state === 'playing' || state === 'paused' || state === 'inventory') saveGame() }, 15000)

// ---------------------------------------------------------------- loop
function resize() {
  const w = window.innerWidth, h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = handCam.aspect = w / h
  camera.updateProjectionMatrix(); handCam.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const DAY_LENGTH = 600 // seconds for a full day/night cycle
const cDay = new THREE.Color(0.47, 0.65, 1.0)
const cNight = new THREE.Color(0.02, 0.03, 0.08)
const cSunset = new THREE.Color(0.98, 0.52, 0.28)
const cWater = new THREE.Color(0.08, 0.2, 0.55)

function updateSky(dt) {
  if (settings.dayCycle && state !== 'title') time = (time + dt / DAY_LENGTH) % 1
  const ang = time * Math.PI * 2
  const sunH = Math.sin(ang)
  const day = THREE.MathUtils.clamp(sunH * 2.2 + 0.45, 0, 1)
  const light = 0.18 + 0.82 * day
  skyColor.copy(cNight).lerp(cDay, day)
  const dusk = Math.max(0, 1 - Math.abs(sunH) * 4.5)
  skyColor.lerp(cSunset, dusk * 0.4)

  const under = player && player.headInWater
  const R = settings.renderDistance
  if (under) {
    scene.fog.color.copy(cWater).multiplyScalar(light)
    scene.fog.near = 0.5; scene.fog.far = 18
    renderer.setClearColor(scene.fog.color)
  } else {
    scene.fog.color.copy(skyColor)
    scene.fog.far = Math.max(24, R * 16 - 6)
    scene.fog.near = scene.fog.far * 0.45
    renderer.setClearColor(skyColor)
  }
  ui.water.hidden = !under

  for (const m of worldMats) m.color.setScalar(light)
  pMat.color.setScalar(light)
  handMat.color.setScalar(Math.max(0.35, light))
  tntMat.color.setScalar(light)
  cloudMat.color.setScalar(0.25 + 0.75 * day)

  const cp = camera.position
  sun.position.set(cp.x + Math.cos(ang) * 380, cp.y + Math.sin(ang) * 380, cp.z + 40)
  moon.position.set(cp.x - Math.cos(ang) * 380, cp.y - Math.sin(ang) * 380, cp.z - 40)
  sun.lookAt(cp); moon.lookAt(cp)

  clouds.position.set(cp.x, 118, cp.z)
  const drift = performance.now() / 1000 * 1.2
  cloudTex.offset.set((cp.x + drift) / (64 * CLOUD_TEXEL), -cp.z / (64 * CLOUD_TEXEL))
}

let last = performance.now()
let fpsFrames = 0, fpsTime = 0, fps = 0
let debugTimer = 0

function frame(now) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  fpsFrames++; fpsTime += dt
  if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0 }

  if (!world) { renderer.clear(); return }

  if (state === 'title') {
    // Slowly rotating panorama of the world behind the title screen.
    panoramaYaw += dt * 0.05
    const p = player.pos
    camera.position.set(p.x, Math.max(p.y + 8, SEA + 14), p.z)
    camera.rotation.set(-0.18, panoramaYaw, 0)
    world.update(p.x, p.z, 8)
  } else {
    if (state === 'playing') {
      const chunkReady = world.getChunk(Math.floor(player.pos.x / 16), Math.floor(player.pos.z / 16))
      if (chunkReady) player.update(dt, gatherInput())
      // Footstep sounds
      if (player.onGround && player.stepDist - lastStep > 1.8) {
        lastStep = player.stepDist
        const below = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z))
        if (below) playSound(SOUND[below], 0.22, 0.9)
      }
    }
    world.update(player.pos.x, player.pos.z, touchMode ? 4 : 6)

    const moving = player.onGround && Math.hypot(player.vel.x, player.vel.z) > 0.5
    bobAmp += ((moving ? 1 : 0) - bobAmp) * Math.min(1, dt * 8)
    const bob = Math.sin(player.stepDist * 3.6) * 0.045 * bobAmp
    camera.position.set(player.pos.x, player.pos.y + EYE + Math.abs(bob) - 0.02 * bobAmp, player.pos.z)
    let sx = 0, sy = 0
    if (shake > 0) { sx = (Math.random() - 0.5) * shake * 0.08; sy = (Math.random() - 0.5) * shake * 0.08; shake = Math.max(0, shake - dt * 1.5) }
    camera.rotation.set(player.pitch + sy, player.yaw + sx, 0)
    const targetFov = 70 + (player.sprinting ? 8 : 0) + (player.flying && player.sprinting ? 6 : 0)
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8)
    camera.updateProjectionMatrix()
  }
  camera.updateMatrixWorld()

  // Targeting, breaking and placing
  selection.visible = false
  if (state === 'playing') {
    let target = null
    if (!touchMode) {
      target = centerTarget()
      if (mouse.left && now >= mouse.nextBreak) { breakBlock(target); target = centerTarget(); mouse.nextBreak = now + 250 }
      if (mouse.right && now >= mouse.nextUse) { useBlock(target, keys.has('ShiftLeft')); mouse.nextUse = now + 250 }
    } else if (look) {
      if (!look.moved && !look.holding && now - look.t0 > HOLD_MS) look.holding = true
      if (look.holding) {
        target = screenTarget(look.x, look.y)
        const same = target && look.target && target.x === look.target.x && target.y === look.target.y && target.z === look.target.z
        look.progress = same ? look.progress + dt / BREAK_TIME : 0
        look.target = target
        if (target && look.progress >= 1) { breakBlock(target); look.progress = 0; look.target = null }
        ui.ring.hidden = !target
        ui.ring.style.transform = `translate(${look.x}px, ${look.y}px)`
        ui.ring.style.setProperty('--p', Math.min(1, look.progress) * 360 + 'deg')
      }
    }
    if (target) {
      selection.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
      selection.visible = true
    }
  }

  updateTNT(dt)
  updateParticles(dt)
  updateSky(dt)
  ui.dpad.classList.toggle('flying', !!(player && player.flying))

  // Held block: gentle bob, swing on use.
  swingT = Math.max(0, swingT - dt * 4)
  const sw = Math.sin(swingT * Math.PI)
  const hb = player ? player.stepDist * 3.6 : 0
  // Keep the block near the lower-right corner in both landscape and portrait.
  const hx = 0.84 * handCam.aspect * 0.62
  hand.position.set(hx + Math.cos(hb * 0.5) * 0.02 * bobAmp - sw * 0.14, -0.5 - Math.abs(Math.sin(hb * 0.5)) * 0.03 * bobAmp - sw * 0.1, -1.2 - sw * 0.1)
  hand.rotation.set(0.12 - sw * 0.6, -0.8 + sw * 0.3, CROSS[handId] ? 0.3 : 0)
  hand.scale.setScalar((CROSS[handId] ? 0.36 : 0.27) * Math.min(1, handCam.aspect * 1.15))

  renderer.clear()
  renderer.render(scene, camera)
  if (state === 'playing' || state === 'paused' || state === 'inventory') {
    renderer.clearDepth()
    renderer.render(handScene, handCam)
  }

  debugTimer -= dt
  if (debugTimer <= 0) {
    debugTimer = 0.25
    const visible = settings.showDebug && state !== 'title'
    ui.debug.hidden = !visible
    if (visible) {
      const p = player.pos
      const { biome } = world.column(Math.floor(p.x), Math.floor(p.z))
      ui.debug.textContent = `${fps} fps\nXYZ ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\nBiome ${biome}  Seed ${world.seed}`
    }
  }
}

// Boot: build the title panorama from the saved world (or a fresh random one).
renderHotbar()
renderInventory()
syncOptions()
if (save) {
  loadWorld(save.seed, save.edits)
  if (save.player) player.pos.set(save.player.x, save.player.y, save.player.z)
  else findSpawn()
  time = save.time ?? 0.06
} else {
  loadWorld(newSeed(), {})
  findSpawn()
}
show(ui.title, true)
requestAnimationFrame((t) => { last = t; frame(t) })

// Expose a tiny handle for debugging from the console.
window.pocketcraft = { get world() { return world }, get player() { return player }, camera, settings }
