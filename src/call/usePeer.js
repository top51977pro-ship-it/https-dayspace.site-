import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'

const ID_KEY = 'dayspace-call-id'
const RING_TIMEOUT_MS = 45_000

// Defaults to PeerJS's free cloud server. Set VITE_PEER_HOST (and optionally VITE_PEER_PORT,
// VITE_PEER_PATH, VITE_PEER_SECURE) to use a self-hosted `peer` server instead.
const env = import.meta.env
const PEER_OPTIONS = env.VITE_PEER_HOST
  ? {
      host: env.VITE_PEER_HOST,
      port: Number(env.VITE_PEER_PORT || 443),
      path: env.VITE_PEER_PATH || '/',
      secure: env.VITE_PEER_SECURE !== 'false',
    }
  : {}

function randomId() {
  return 'ds-' + Math.random().toString(36).slice(2, 8)
}

function loadId() {
  try { return localStorage.getItem(ID_KEY) } catch { return null }
}

function saveId(id) {
  try { localStorage.setItem(ID_KEY, id) } catch { /* ignore */ }
}

// Asks for camera + mic; if the camera is missing or denied, falls back to a voice call.
async function getMedia(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch (e) {
    if (video) return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    throw e
  }
}

function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop())
}

/**
 * Browser-to-browser calls over WebRTC. PeerJS's free cloud server handles signalling;
 * audio/video flows directly between the two browsers (or via TURN when needed).
 *
 * call.phase: 'starting' (getting mic) → 'ringing' (outgoing) → 'active' → 'ended'
 */
export function usePeer({ myName, onLog }) {
  const [myId, setMyId] = useState(null)
  const [status, setStatus] = useState('connecting') // connecting | ready | offline
  const [error, setError] = useState('')
  const [incoming, setIncoming] = useState(null) // { conn, from, name, video }
  const [call, setCall] = useState(null) // { remoteId, name, video, direction, phase, startedAt, reason }
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  // Event handlers outlive renders, so they read the live values from refs.
  const peerRef = useRef(null)
  const connRef = useRef(null)
  const callRef = useRef(null)
  const incomingRef = useRef(null)
  const localRef = useRef(null)
  const ringTimer = useRef(null)
  const nameRef = useRef(myName)
  const logRef = useRef(onLog)
  nameRef.current = myName
  logRef.current = onLog

  const updateCall = useCallback((next) => {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next
    setCall(callRef.current)
  }, [])

  const updateIncoming = useCallback((next) => {
    incomingRef.current = next
    setIncoming(next)
  }, [])

  // Small out-of-band messages (decline / busy / hangup). Media connections don't reliably
  // tell the other side why they closed, so we say it explicitly over a data channel.
  const signal = useCallback((to, msg) => {
    const peer = peerRef.current
    if (!peer || peer.destroyed || !to) return
    const dc = peer.connect(to, { reliable: true })
    dc.on('open', () => {
      dc.send(msg)
      setTimeout(() => dc.close(), 1500)
    })
    dc.on('error', () => {})
  }, [])

  const finish = useCallback((reason, notifyRemote = true) => {
    const c = callRef.current
    if (!c || c.phase === 'ended') return
    clearTimeout(ringTimer.current)
    const ended = { ...c, phase: 'ended', reason }
    updateCall(ended)

    if (notifyRemote) signal(c.remoteId, { type: 'hangup' })
    const conn = connRef.current
    connRef.current = null
    conn?.close()
    stopStream(localRef.current)
    localRef.current = null
    setLocalStream(null)
    setRemoteStream(null)

    logRef.current?.({
      kind: 'app',
      target: c.remoteId,
      name: c.name,
      video: c.video,
      dir: c.direction,
      at: Date.now(),
      duration: c.startedAt ? Math.round((Date.now() - c.startedAt) / 1000) : 0,
      answered: Boolean(c.startedAt),
    })

    setTimeout(() => { if (callRef.current === ended) updateCall(null) }, 2200)
  }, [signal, updateCall])

  const wireConn = useCallback((conn) => {
    conn.on('stream', (remote) => {
      if (connRef.current !== conn) return
      setRemoteStream(remote)
      const c = callRef.current
      if (c?.phase === 'ringing') {
        clearTimeout(ringTimer.current)
        updateCall({ ...c, phase: 'active', startedAt: Date.now() })
      }
      const pc = conn.peerConnection
      pc?.addEventListener('iceconnectionstatechange', () => {
        if (connRef.current === conn && ['failed', 'closed'].includes(pc.iceConnectionState)) finish('lost', false)
      })
    })
    conn.on('close', () => { if (connRef.current === conn) finish('ended', false) })
    conn.on('error', () => { if (connRef.current === conn) finish('lost', false) })
  }, [finish, updateCall])

  const handleSignal = useCallback((from, msg) => {
    if (!msg || typeof msg !== 'object') return
    const c = callRef.current
    if (c && c.remoteId === from && c.phase !== 'ended') {
      // The callee introduces itself on answer; keep a saved contact name if the caller has one.
      if (msg.type === 'hello') {
        const theirName = String(msg.name || '').slice(0, 40)
        if (theirName && (!c.name || c.name === c.remoteId)) updateCall({ ...c, name: theirName })
        return
      }
      const reason = { decline: 'declined', busy: 'busy', hangup: 'ended' }[msg.type]
      if (reason) finish(reason, false)
      return
    }
    // Caller gave up before we answered → missed call.
    const inc = incomingRef.current
    if (inc && inc.from === from && msg.type === 'hangup') {
      updateIncoming(null)
      inc.conn.close()
      logRef.current?.({ kind: 'app', target: from, name: inc.name, video: inc.video, dir: 'missed', at: Date.now(), duration: 0, answered: false })
    }
  }, [finish, updateCall, updateIncoming])

  // Keep the latest handlers reachable from the long-lived peer listeners.
  const handlers = useRef({})
  handlers.current = { finish, handleSignal, signal, updateIncoming, wireConn }

  useEffect(() => {
    let disposed = false
    let retries = 0
    let reconnectTimer

    const create = (id) => {
      const peer = new Peer(id, { debug: 0, ...PEER_OPTIONS })
      peerRef.current = peer

      peer.on('open', (openId) => {
        retries = 0
        saveId(openId)
        setMyId(openId)
        setStatus('ready')
      })

      peer.on('error', (err) => {
        if (disposed) return
        const h = handlers.current
        switch (err.type) {
          case 'unavailable-id':
            // Usually our own previous session that the server hasn't released yet: retry the
            // same ID a couple of times so invite links keep working, then pick a new one.
            peer.destroy()
            retries += 1
            setTimeout(() => { if (!disposed) create(retries <= 2 ? id : randomId()) }, 2500)
            return
          case 'peer-unavailable': {
            // Only the peer we're ringing matters; the same error fires for failed decline/busy notes.
            const c = callRef.current
            if (c?.phase === 'ringing' && String(err.message).includes(c.remoteId)) h.finish('unavailable', false)
            return
          }
          case 'browser-incompatible':
            setError('הדפדפן הזה לא תומך בשיחות. נסו Chrome, Edge, Firefox או Safari עדכניים.')
            setStatus('offline')
            return
          case 'network':
          case 'server-error':
          case 'socket-error':
          case 'socket-closed':
            setStatus('offline')
            return
          default:
            // Media-level failures surface on the call's own 'error' / 'close' events.
        }
      })

      peer.on('disconnected', () => {
        if (disposed || peer.destroyed) return
        setStatus('offline')
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => {
          if (!disposed && !peer.destroyed && peer.disconnected) peer.reconnect()
        }, 2000)
      })

      peer.on('call', (conn) => {
        const h = handlers.current
        const from = conn.peer
        if (callRef.current || incomingRef.current) {
          h.signal(from, { type: 'busy' })
          conn.close()
          return
        }
        const meta = conn.metadata || {}
        h.updateIncoming({ conn, from, name: String(meta.name || '').slice(0, 40), video: Boolean(meta.video) })
      })

      peer.on('connection', (dc) => {
        dc.on('data', (msg) => handlers.current.handleSignal(dc.peer, msg))
      })
    }

    create(loadId() || randomId())

    // Come back online after sleep / network change.
    const onOnline = () => {
      const p = peerRef.current
      if (p && !p.destroyed && p.disconnected) p.reconnect()
    }
    window.addEventListener('online', onOnline)

    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      window.removeEventListener('online', onOnline)
      peerRef.current?.destroy()
      peerRef.current = null
    }
  }, [])

  const startCall = useCallback(async (target, { name = '', video = false } = {}) => {
    setError('')
    const peer = peerRef.current
    const remoteId = target.trim().toLowerCase()
    if (!remoteId) return
    if (!peer || peer.disconnected || !peer.open) {
      setError('עדיין אין חיבור לשרת. נסו שוב בעוד רגע.')
      return
    }
    if (remoteId === peer.id) {
      setError('זה המזהה שלכם 🙂 הזינו את המזהה של מי שאתם רוצים להתקשר אליו.')
      return
    }
    if (callRef.current || incomingRef.current) return

    updateCall({ remoteId, name, video, direction: 'out', phase: 'starting' })
    let stream
    try {
      stream = await getMedia(video)
    } catch {
      updateCall(null)
      setError('אין גישה למיקרופון. אשרו לדפדפן להשתמש במיקרופון ונסו שוב.')
      return
    }
    // The user cancelled while we were waiting for permission.
    if (callRef.current?.phase !== 'starting') {
      stopStream(stream)
      return
    }
    localRef.current = stream
    setLocalStream(stream)
    const hasVideo = stream.getVideoTracks().length > 0

    const conn = peer.call(remoteId, stream, { metadata: { name: nameRef.current, video: hasVideo } })
    if (!conn) {
      finish('lost', false)
      return
    }
    connRef.current = conn
    wireConn(conn)
    updateCall((c) => ({ ...c, video: hasVideo, phase: 'ringing' }))
    ringTimer.current = setTimeout(() => finish('noanswer'), RING_TIMEOUT_MS)
  }, [finish, updateCall, wireConn])

  const answer = useCallback(async ({ video } = {}) => {
    const inc = incomingRef.current
    if (!inc) return
    updateIncoming(null)
    let stream
    try {
      stream = await getMedia(video ?? inc.video)
    } catch {
      signal(inc.from, { type: 'decline' })
      inc.conn.close()
      setError('אין גישה למיקרופון, ולכן לא ניתן היה לענות לשיחה.')
      return
    }
    localRef.current = stream
    setLocalStream(stream)
    connRef.current = inc.conn
    updateCall({
      remoteId: inc.from,
      name: inc.name,
      video: stream.getVideoTracks().length > 0 || inc.video,
      direction: 'in',
      phase: 'active',
      startedAt: Date.now(),
    })
    wireConn(inc.conn)
    inc.conn.answer(stream)
    if (nameRef.current) signal(inc.from, { type: 'hello', name: nameRef.current })
  }, [signal, updateCall, updateIncoming, wireConn])

  const decline = useCallback(() => {
    const inc = incomingRef.current
    if (!inc) return
    updateIncoming(null)
    signal(inc.from, { type: 'decline' })
    inc.conn.close()
    logRef.current?.({ kind: 'app', target: inc.from, name: inc.name, video: inc.video, dir: 'in', at: Date.now(), duration: 0, answered: false })
  }, [signal, updateIncoming])

  const hangup = useCallback(() => finish('ended'), [finish])

  return { myId, status, error, setError, incoming, call, localStream, remoteStream, startCall, answer, decline, hangup }
}
