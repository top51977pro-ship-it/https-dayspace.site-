// Demo backend: everything lives on the device, and a few relatives are simulated
// walking/driving around you. It exists so the app is fully usable the moment it is
// installed, before anyone wires up a Firebase project.

import { loadJSON, saveJSON, KEYS } from '../lib/storage'
import { destination, distance } from '../lib/geo'
import { inviteCode, uid } from '../lib/id'

const DEFAULT_ANCHOR = { lat: 32.0853, lng: 34.7818 } // Tel Aviv, when we know nothing yet
const TICK_MS = 4000

const CAST = [
  { id: 'demo_noa', name: 'נועה', emoji: '👧', color: '#FF5F7A', speed: 1.4, radius: 900 },
  { id: 'demo_itay', name: 'איתי', emoji: '🧒', color: '#46B8FF', speed: 7.5, radius: 3200 },
  { id: 'demo_ruth', name: 'סבתא רות', emoji: '👵', color: '#FFC247', speed: 0.7, radius: 400 },
]

function seedMember(actor, anchor) {
  const start = destination(anchor, actor.radius * (0.4 + Math.random() * 0.6), Math.random() * 360)
  return {
    id: actor.id,
    name: actor.name,
    emoji: actor.emoji,
    color: actor.color,
    lat: start.lat,
    lng: start.lng,
    accuracy: 12 + Math.random() * 25,
    heading: Math.random() * 360,
    speed: 0,
    battery: 0.4 + Math.random() * 0.55,
    charging: false,
    sharing: true,
    demo: true,
    updatedAt: Date.now(),
  }
}

/** One simulation step: wander, and turn back when drifting too far from the anchor. */
function step(member, actor, anchor) {
  const home = distance(member, anchor) ?? 0
  let heading = member.heading ?? 0

  if (home > actor.radius) {
    // steer home, with a little wobble so it does not look robotic
    const towardHome =
      (Math.atan2(anchor.lng - member.lng, anchor.lat - member.lat) * 180) / Math.PI
    heading = (towardHome + 360 + (Math.random() * 40 - 20)) % 360
  } else {
    heading = (heading + (Math.random() * 50 - 25) + 360) % 360
  }

  const speed = actor.speed * (0.55 + Math.random() * 0.9)
  const next = destination(member, speed * (TICK_MS / 1000), heading)

  return {
    ...member,
    lat: next.lat,
    lng: next.lng,
    heading,
    speed,
    accuracy: 8 + Math.random() * 30,
    battery: Math.max(0.05, (member.battery ?? 0.8) - 0.0004),
    updatedAt: Date.now(),
  }
}

export function createDemoProvider() {
  let state = null
  const listeners = new Set()
  let timer = null
  let anchor = DEFAULT_ANCHOR

  async function ensureState() {
    if (state) return state
    state = (await loadJSON(KEYS.demoState, null)) || {
      circle: null,
      members: {},
      places: {},
      events: {},
    }
    return state
  }

  async function persist() {
    await saveJSON(KEYS.demoState, state)
  }

  function emit() {
    const snapshot = {
      members: Object.values(state.members),
      places: Object.values(state.places),
      events: Object.values(state.events),
      meta: state.circle,
    }
    for (const fn of listeners) fn(snapshot)
  }

  function startClock() {
    if (timer) return
    timer = setInterval(async () => {
      let changed = false
      for (const actor of CAST) {
        const current = state.members[actor.id]
        if (!current) continue
        state.members[actor.id] = step(current, actor, anchor)
        changed = true
      }
      if (changed) {
        emit()
        await persist()
      }
    }, TICK_MS)
  }

  function stopClock() {
    clearInterval(timer)
    timer = null
  }

  return {
    mode: 'demo',
    configured: true,

    async createCircle({ name, profile }) {
      await ensureState()
      const circle = {
        id: uid('circle'),
        code: inviteCode(),
        name: name || 'המשפחה שלי',
        ownerId: profile.id,
        createdAt: Date.now(),
      }
      state.circle = circle
      state.members = {}
      state.events = {}
      // Seed the cast so a brand-new circle is not an empty map.
      for (const actor of CAST) state.members[actor.id] = seedMember(actor, anchor)
      await persist()
      return circle
    },

    async joinCircle(code) {
      await ensureState()
      // There is no server to look codes up in, so demo mode accepts any code and
      // attaches you to the local circle (creating one if needed).
      if (!state.circle) {
        state.circle = {
          id: uid('circle'),
          code,
          name: 'המשפחה שלי',
          createdAt: Date.now(),
        }
        for (const actor of CAST) state.members[actor.id] = seedMember(actor, anchor)
        await persist()
      }
      return state.circle
    },

    subscribe(_circleId, onSnapshot) {
      listeners.add(onSnapshot)
      ensureState().then(() => {
        emit()
        startClock()
      })
      return () => {
        listeners.delete(onSnapshot)
        if (!listeners.size) stopClock()
      }
    },

    async publishMember(_circleId, member) {
      await ensureState()
      state.members[member.id] = { ...state.members[member.id], ...member }
      if (Number.isFinite(member.lat) && Number.isFinite(member.lng)) {
        // Follow the real user so the simulated family stays plausibly nearby.
        anchor = { lat: member.lat, lng: member.lng }
        for (const actor of CAST) {
          const m = state.members[actor.id]
          if (m && (distance(m, anchor) ?? 0) > actor.radius * 4) {
            state.members[actor.id] = seedMember(actor, anchor)
          }
        }
      }
      emit()
      await persist()
    },

    async savePlace(_circleId, place) {
      await ensureState()
      state.places[place.id] = place
      emit()
      await persist()
    },

    async deletePlace(_circleId, placeId) {
      await ensureState()
      delete state.places[placeId]
      emit()
      await persist()
    },

    async pushEvent(_circleId, event) {
      await ensureState()
      state.events[event.id] = event
      emit()
      await persist()
    },

    async leave(_circleId, memberId) {
      await ensureState()
      delete state.members[memberId]
      emit()
      await persist()
    },

    async reset() {
      stopClock()
      state = { circle: null, members: {}, places: {}, events: {} }
      await persist()
    },
  }
}
