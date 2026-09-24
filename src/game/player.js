// First-person player: AABB collision against the voxel grid, walking,
// swimming, creative flight and Pocket-Edition style auto-jump.
import * as THREE from 'three'
import { SOLID, LIQUID } from './blocks.js'

const HALF_W = 0.3
const HEIGHT = 1.8
export const EYE = 1.62
const GRAVITY = 32
const JUMP_V = 8.8
const EPS = 0.001

export class Player {
  constructor(world) {
    this.world = world
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.onGround = false
    this.flying = false
    this.inWater = false
    this.headInWater = false
    this.sprinting = false
    this.autoJump = false
    this.stepDist = 0
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + EYE, this.pos.z) }

  // Does the player's box, placed at (x, y, z), overlap block (bx, by, bz)?
  overlapsBlock(bx, by, bz) {
    const p = this.pos
    return bx + 1 > p.x - HALF_W && bx < p.x + HALF_W && by + 1 > p.y && by < p.y + HEIGHT && bz + 1 > p.z - HALF_W && bz < p.z + HALF_W
  }

  collides() {
    const p = this.pos, w = this.world
    const x0 = Math.floor(p.x - HALF_W), x1 = Math.floor(p.x + HALF_W)
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + HEIGHT)
    const z0 = Math.floor(p.z - HALF_W), z1 = Math.floor(p.z + HALF_W)
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (SOLID[w.getBlock(x, y, z)]) return true
    }
    return false
  }

  // Move along one axis; on collision snap flush against the blocking face.
  sweep(axis, d) {
    if (d === 0) return false
    const p = this.pos
    p[axis] += d
    if (!this.collides()) return false
    if (axis === 'y') p.y = d > 0 ? Math.floor(p.y + HEIGHT) - HEIGHT - EPS : Math.floor(p.y) + 1 + EPS
    else p[axis] = d > 0 ? Math.floor(p[axis] + HALF_W) - HALF_W - EPS : Math.floor(p[axis] - HALF_W) + 1 + HALF_W + EPS
    return true
  }

  update(dt, input) {
    const w = this.world
    const p = this.pos, v = this.vel
    const feet = w.getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z))
    this.inWater = LIQUID[feet] === 1
    this.headInWater = LIQUID[w.getBlock(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z))] === 1

    // Desired horizontal velocity from input, relative to where we face.
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw)
    let fx = -sin * input.forward + cos * input.strafe
    let fz = -cos * input.forward - sin * input.strafe
    const len = Math.hypot(fx, fz)
    if (len > 1) { fx /= len; fz /= len }
    this.sprinting = input.sprint && input.forward > 0
    let speed = this.flying ? (this.sprinting ? 21 : 10.9) : this.inWater ? 3 : this.sprinting ? 5.6 : 4.3
    const accel = this.flying ? 9 : this.onGround || this.inWater ? 18 : 6
    const k = Math.min(1, accel * dt)
    v.x += (fx * speed - v.x) * k
    v.z += (fz * speed - v.z) * k

    if (this.flying) {
      const vy = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * 8
      v.y += (vy - v.y) * Math.min(1, 10 * dt)
    } else if (this.inWater) {
      v.y -= 10 * dt
      if (input.jump) v.y = Math.min(v.y + 30 * dt, 3.6)
      v.y = Math.max(v.y, -4)
    } else {
      v.y -= GRAVITY * dt
      if (input.jump && this.onGround) v.y = JUMP_V
      v.y = Math.max(v.y, -60)
    }

    // Sub-step so fast falls cannot tunnel through one-block floors.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / 0.4))
    const sdt = dt / steps
    let hitH = false
    const wasOnGround = this.onGround
    this.onGround = false
    for (let s = 0; s < steps; s++) {
      if (this.sweep('y', v.y * sdt)) {
        if (v.y < 0) { this.onGround = true; if (this.flying) this.flying = false }
        v.y = 0
      }
      if (this.sweep('x', v.x * sdt)) { v.x = 0; hitH = true }
      if (this.sweep('z', v.z * sdt)) { v.z = 0; hitH = true }
    }

    // Auto-jump: bumping into a one-block step while walking hops onto it.
    if (this.autoJump && hitH && (wasOnGround || this.onGround) && !this.flying && len > 0.1) {
      const tx = Math.floor(p.x + fx * 0.6), tz = Math.floor(p.z + fz * 0.6), fy = Math.floor(p.y + 0.01)
      if (SOLID[w.getBlock(tx, fy, tz)] && !SOLID[w.getBlock(tx, fy + 1, tz)] && !SOLID[w.getBlock(tx, fy + 2, tz)] && !SOLID[w.getBlock(Math.floor(p.x), fy + 2, Math.floor(p.z))]) {
        v.y = JUMP_V
      }
    }
    if (this.inWater && hitH && input.forward > 0) v.y = Math.max(v.y, 3.2) // climb out of water

    if (this.onGround) this.stepDist += Math.hypot(v.x, v.z) * dt
    if (p.y < -20) { p.y = 120; v.set(0, 0, 0) }
  }
}
