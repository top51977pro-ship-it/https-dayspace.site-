// Zero-setup backend: a public MQTT broker over secure WebSockets.
//
// Why this works without anyone creating an account:
//   * public brokers accept anonymous connections
//   * MQTT *retained* messages mean the broker keeps the last value of every
//     topic, so a phone that joins later immediately receives everybody's
//     current position and all saved places — no server of our own required
//   * every payload is AES-GCM encrypted with a key derived from the invite
//     code, so the broker (and anyone else connected to it) only sees noise
//
// Trade-off, stated plainly: this depends on a free public broker staying up.
// A family that wants a private, guaranteed backend should configure Firebase
// instead — see README. The provider interface is identical either way.

import mqtt from 'mqtt'
import { deriveSecrets, encryptJSON, decryptJSON } from '../lib/crypto'
import { KEYS, loadJSON } from '../lib/storage'
import { inviteCode, uid } from '../lib/id'

const ROOT = 'fmap1'

// mqtt.js rotates through these on every reconnect, so one broker going down
// is a hiccup rather than an outage.
const BROKERS = [
  { host: 'broker.emqx.io', port: 8084, protocol: 'wss' },
  { host: 'broker.hivemq.com', port: 8884, protocol: 'wss' },
]

const CONNECT_OPTIONS = {
  path: '/mqtt',
  protocolVersion: 4,
  clean: true,
  keepalive: 30,
  reconnectPeriod: 4000,
  connectTimeout: 12_000,
  resubscribe: true,
}

/** Live sessions, keyed by the derived topic (which is also our circle id). */
const sessions = new Map()

function openSession(code) {
  const existing = [...sessions.values()].find((s) => s.code === code)
  if (existing) return existing.ready

  const session = {
    code,
    topic: null,
    key: null,
    client: null,
    members: new Map(),
    places: new Map(),
    events: new Map(),
    meta: null,
    listeners: new Set(),
    statusListeners: new Set(),
    status: 'connecting',
  }

  session.ready = (async () => {
    const { topic, key } = await deriveSecrets(code)
    session.topic = topic
    session.key = key
    sessions.set(topic, session)

    const url = import.meta.env.VITE_MQTT_URL
    session.client = url
      ? mqtt.connect(url, { ...CONNECT_OPTIONS, clientId: `fm_${uid()}` })
      : mqtt.connect({ ...CONNECT_OPTIONS, servers: BROKERS, clientId: `fm_${uid()}` })

    const client = session.client

    client.on('connect', () => {
      setStatus(session, 'online')
      client.subscribe(`${ROOT}/${topic}/#`, { qos: 1 })
    })
    client.on('reconnect', () => setStatus(session, 'connecting'))
    client.on('offline', () => setStatus(session, 'offline'))
    client.on('close', () => setStatus(session, 'offline'))
    client.on('error', () => setStatus(session, 'offline'))

    client.on('message', async (fullTopic, payload) => {
      const rest = fullTopic.slice(`${ROOT}/${topic}/`.length)
      const [kind, id] = rest.split('/')
      const bucket =
        kind === 'm' ? session.members : kind === 'p' ? session.places : kind === 'e' ? session.events : null

      // An empty retained payload is how MQTT expresses "this is gone".
      if (!payload || payload.length === 0) {
        if (bucket && id) {
          bucket.delete(id)
          emit(session)
        }
        return
      }

      const value = await decryptJSON(key, payload.toString())
      if (!value) return // not ours, or a stale key — ignore quietly

      if (kind === 'meta') session.meta = value
      else if (bucket && id) bucket.set(id, value)
      else return

      emit(session)
    })

    return session
  })()

  return session.ready
}

function setStatus(session, status) {
  if (session.status === status) return
  session.status = status
  for (const fn of session.statusListeners) fn(status)
}

function emit(session) {
  const snapshot = {
    members: [...session.members.values()],
    places: [...session.places.values()],
    events: [...session.events.values()],
    meta: session.meta,
  }
  for (const fn of session.listeners) fn(snapshot)
}

/**
 * Find the session for a circle. After an app restart only the circle id is in
 * memory, so we recover the invite code (the shared secret) from storage.
 */
async function sessionFor(circleId) {
  const known = sessions.get(circleId)
  if (known) return known.ready
  const stored = await loadJSON(KEYS.circle)
  if (stored?.id === circleId && stored?.code) return openSession(stored.code)
  throw new Error('missing-invite-code')
}

async function publish(session, kind, id, value, { retain = true } = {}) {
  const topic = `${ROOT}/${session.topic}/${kind}${id ? `/${id}` : ''}`
  const body = value === null ? '' : await encryptJSON(session.key, value)
  return new Promise((resolve, reject) => {
    session.client.publish(topic, body, { qos: 1, retain }, (err) =>
      err ? reject(err) : resolve(),
    )
  })
}

export function createMqttProvider() {
  return {
    mode: 'mqtt',
    configured: true,

    async createCircle({ name, profile }) {
      const code = inviteCode()
      const session = await openSession(code)
      const circle = {
        id: session.topic,
        code,
        name: name || 'המשפחה שלי',
        ownerId: profile.id,
        createdAt: Date.now(),
      }
      await publish(session, 'meta', null, circle)
      return circle
    },

    async joinCircle(code) {
      const session = await openSession(code)
      // The family name arrives with the retained meta message a moment later;
      // until then we show a placeholder rather than block the join.
      return {
        id: session.topic,
        code,
        name: session.meta?.name || 'המשפחה שלי',
        createdAt: Date.now(),
      }
    },

    subscribe(circleId, onSnapshot, onError, onStatus) {
      let cancelled = false
      let cleanup = () => {}

      sessionFor(circleId)
        .then((session) => {
          if (cancelled) return
          session.listeners.add(onSnapshot)
          if (onStatus) {
            session.statusListeners.add(onStatus)
            onStatus(session.status)
          }
          cleanup = () => {
            session.listeners.delete(onSnapshot)
            if (onStatus) session.statusListeners.delete(onStatus)
          }
          emit(session)
        })
        .catch((err) => onError?.(err))

      return () => {
        cancelled = true
        cleanup()
      }
    },

    async publishMember(circleId, member) {
      const session = await sessionFor(circleId)
      // Retained messages replace rather than merge, so send the whole record.
      const previous = session.members.get(member.id) || {}
      await publish(session, 'm', member.id, { ...previous, ...member })
    },

    async savePlace(circleId, place) {
      const session = await sessionFor(circleId)
      await publish(session, 'p', place.id, place)
    },

    async deletePlace(circleId, placeId) {
      const session = await sessionFor(circleId)
      await publish(session, 'p', placeId, null)
    },

    async pushEvent(circleId, event) {
      const session = await sessionFor(circleId)
      // Alerts are live news, not state — no point retaining them forever.
      await publish(session, 'e', event.id, event, { retain: false })
    },

    async leave(circleId, memberId) {
      const session = await sessionFor(circleId)
      await publish(session, 'm', memberId, null)
      session.client?.end(true)
      sessions.delete(circleId)
    },
  }
}
