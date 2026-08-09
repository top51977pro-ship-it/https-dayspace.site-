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
// Two rules this file must never break:
//   1. Creating or joining a family is a LOCAL operation. It derives keys and
//      starts connecting, but never waits for the network — otherwise a slow
//      or unreachable broker leaves the user staring at a spinner.
//   2. No publish may hang forever. Everything is time-boxed; mqtt.js keeps the
//      message queued and delivers it once a broker answers.

import mqtt from 'mqtt'
import { deriveSecrets, encryptJSON, decryptJSON } from '../lib/crypto'
import { KEYS, loadJSON } from '../lib/storage'
import { inviteCode, uid } from '../lib/id'

const ROOT = 'fmap1'

// Tried in order, then round-robin forever. Each has its own path, which is why
// we drive the failover ourselves instead of using mqtt.js's `servers` option.
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/',
]

const CONNECT_TIMEOUT_MS = 9000
const PUBLISH_TIMEOUT_MS = 8000
const RETRY_DELAY_MS = 1500

/** Live sessions, keyed by the derived topic (which is also our circle id). */
const sessions = new Map()

/* ------------------------------------------------------------------ session */

function openSession(code) {
  for (const session of sessions.values()) {
    if (session.code === code) return session.ready
  }

  const session = {
    code,
    topic: null,
    key: null,
    client: null,
    brokerIndex: 0,
    brokerUrl: null,
    members: new Map(),
    places: new Map(),
    events: new Map(),
    meta: null,
    // Everything this device owns, replayed whenever a broker accepts us, so a
    // broker restart (or a failover to a different one) does not lose our state.
    mine: new Map(),
    listeners: new Set(),
    statusListeners: new Set(),
    status: 'connecting',
    closed: false,
  }

  session.ready = (async () => {
    const { topic, key } = await deriveSecrets(code)
    session.topic = topic
    session.key = key
    sessions.set(topic, session)
    connect(session)
    return session
  })()

  return session.ready
}

function connect(session) {
  if (session.closed) return

  const override = import.meta.env.VITE_MQTT_URL
  const url = override || BROKERS[session.brokerIndex % BROKERS.length]
  session.brokerUrl = url
  setStatus(session, session.status === 'online' ? 'connecting' : session.status)

  const client = mqtt.connect(url, {
    clientId: `fm_${uid()}`,
    protocolVersion: 4,
    clean: true,
    keepalive: 30,
    connectTimeout: CONNECT_TIMEOUT_MS,
    reconnectPeriod: 0, // we handle retries so we can rotate brokers
  })
  session.client = client

  let settled = false

  const nextBroker = () => {
    if (settled || session.closed) return
    settled = true
    try {
      client.end(true)
    } catch {
      /* already gone */
    }
    setStatus(session, 'offline')
    session.brokerIndex += 1
    setTimeout(() => connect(session), RETRY_DELAY_MS)
  }

  client.on('connect', () => {
    settled = true
    setStatus(session, 'online')
    client.subscribe(`${ROOT}/${session.topic}/#`, { qos: 1 })
    replayOwnState(session)
  })

  client.on('message', (fullTopic, payload) => handleMessage(session, fullTopic, payload))
  client.on('error', nextBroker)
  client.on('close', nextBroker)
  client.on('offline', nextBroker)
}

async function handleMessage(session, fullTopic, payload) {
  const prefix = `${ROOT}/${session.topic}/`
  if (!fullTopic.startsWith(prefix)) return
  const [kind, id] = fullTopic.slice(prefix.length).split('/')

  const bucket =
    kind === 'm' ? session.members : kind === 'p' ? session.places : kind === 'e' ? session.events : null

  // An empty retained payload is how MQTT says "this is gone".
  if (!payload || payload.length === 0) {
    if (bucket && id && bucket.delete(id)) emit(session)
    return
  }

  const value = await decryptJSON(session.key, payload.toString())
  if (!value) return // a different family on the same broker, or a stale key

  if (kind === 'meta') session.meta = value
  else if (bucket && id) bucket.set(id, value)
  else return

  emit(session)
}

/** Re-send everything this device owns after (re)connecting. */
function replayOwnState(session) {
  for (const [path, value] of session.mine) {
    const [kind, id] = path.split('/')
    rawPublish(session, kind, id || null, value).catch(() => {})
  }
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

/* ------------------------------------------------------------------ publish */

function rawPublish(session, kind, id, value, { retain = true } = {}) {
  const topic = `${ROOT}/${session.topic}/${kind}${id ? `/${id}` : ''}`
  return encryptJSON(session.key, value).then(
    (body) =>
      new Promise((resolve, reject) => {
        if (!session.client) {
          reject(new Error('not-connected'))
          return
        }
        session.client.publish(topic, body, { qos: 1, retain }, (err) =>
          err ? reject(err) : resolve(),
        )
      }),
  )
}

/**
 * Publish without ever blocking the UI. The message is remembered for replay and
 * the promise settles on a timeout even if the broker never acknowledges it.
 */
async function publish(session, kind, id, value, { retain = true, own = true } = {}) {
  const path = `${kind}${id ? `/${id}` : ''}`

  if (own) {
    if (value === null) session.mine.delete(path)
    else if (retain) session.mine.set(path, value)
  }

  if (value === null) {
    // Clearing a retained topic: an empty payload, not encrypted.
    const topic = `${ROOT}/${session.topic}/${path}`
    session.client?.publish(topic, '', { qos: 1, retain: true })
    return
  }

  await Promise.race([
    rawPublish(session, kind, id, value, { retain }).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, PUBLISH_TIMEOUT_MS)),
  ])
}

/* ----------------------------------------------------------------- provider */

export function createMqttProvider() {
  return {
    mode: 'mqtt',
    configured: true,

    async createCircle({ name, profile }) {
      const code = inviteCode()
      const session = await openSession(code) // local: derives keys, starts connecting
      const circle = {
        id: session.topic,
        code,
        name: name || 'המשפחה שלי',
        ownerId: profile.id,
        createdAt: Date.now(),
      }
      // Deliberately not awaited: the family exists on this phone right away, and
      // the broker learns about it as soon as a connection is up.
      publish(session, 'meta', null, circle).catch(() => {})
      return circle
    },

    async joinCircle(code) {
      const session = await openSession(code)
      // The family's real name arrives with the owner's retained meta message a
      // moment later; showing a placeholder beats blocking the join.
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
      const previous = session.mine.get(`m/${member.id}`) || session.members.get(member.id) || {}
      const merged = { ...previous, ...member }
      session.members.set(member.id, merged)
      emit(session)
      await publish(session, 'm', member.id, merged)
    },

    async savePlace(circleId, place) {
      const session = await sessionFor(circleId)
      session.places.set(place.id, place)
      emit(session)
      await publish(session, 'p', place.id, place)
    },

    async deletePlace(circleId, placeId) {
      const session = await sessionFor(circleId)
      session.places.delete(placeId)
      emit(session)
      await publish(session, 'p', placeId, null)
    },

    async pushEvent(circleId, event) {
      const session = await sessionFor(circleId)
      // Alerts are live news, not state — no point retaining them forever.
      await publish(session, 'e', event.id, event, { retain: false, own: false })
    },

    async leave(circleId, memberId) {
      const session = await sessionFor(circleId)
      await publish(session, 'm', memberId, null)
      session.closed = true
      try {
        session.client?.end(true)
      } catch {
        /* already gone */
      }
      sessions.delete(circleId)
    },

    /** Shown in Settings so a connection problem is diagnosable from the phone. */
    async diagnostics(circleId) {
      const session = sessions.get(circleId)
      if (!session) return null
      return { status: session.status, broker: session.brokerUrl }
    },
  }
}
