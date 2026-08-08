// Real-time backend on Firebase Realtime Database + anonymous auth.
// Enabled only when the VITE_FIREBASE_* build variables are present (see .env.example).
// The Firebase SDK is imported lazily so an unconfigured build never pays for it.

import { inviteCode, uid } from '../lib/id'

export function firebaseConfig() {
  const env = import.meta.env
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  return config.apiKey && config.databaseURL && config.projectId ? config : null
}

export function createFirebaseProvider(config) {
  let dbPromise = null

  async function db() {
    if (!dbPromise) {
      dbPromise = (async () => {
        const [{ initializeApp }, auth, rtdb] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/database'),
        ])
        const app = initializeApp(config)
        const authInstance = auth.getAuth(app)
        if (!authInstance.currentUser) await auth.signInAnonymously(authInstance)
        return { rtdb, database: rtdb.getDatabase(app), auth: authInstance }
      })()
    }
    return dbPromise
  }

  const path = (...parts) => parts.join('/')

  return {
    mode: 'firebase',
    configured: true,

    /**
     * Member ids are the anonymous auth uid, which is what lets the database rules
     * say "you may only write your own member node".
     */
    async identity() {
      const { auth } = await db()
      return auth.currentUser?.uid || null
    },

    async createCircle({ name, profile }) {
      const { rtdb, database } = await db()
      const circle = {
        id: uid('circle'),
        code: await reserveCode(rtdb, database),
        name: name || 'המשפחה שלי',
        ownerId: profile.id,
        createdAt: Date.now(),
      }
      await rtdb.set(rtdb.ref(database, path('circles', circle.id, 'meta')), circle)
      await rtdb.set(rtdb.ref(database, path('codes', circle.code)), circle.id)
      return circle
    },

    async joinCircle(code) {
      const { rtdb, database } = await db()
      const snap = await rtdb.get(rtdb.ref(database, path('codes', code)))
      if (!snap.exists()) {
        const err = new Error('code-not-found')
        err.code = 'code-not-found'
        throw err
      }
      const circleId = snap.val()
      const meta = await rtdb.get(rtdb.ref(database, path('circles', circleId, 'meta')))
      return meta.val() || { id: circleId, code, name: 'המשפחה שלי' }
    },

    subscribe(circleId, onSnapshot, onError) {
      let cancelled = false
      const unsubs = []
      const cache = { members: [], places: [], events: [], meta: null }

      db()
        .then(({ rtdb, database }) => {
          if (cancelled) return
          const watch = (child, key, map = (v) => v) => {
            const ref = rtdb.ref(database, path('circles', circleId, child))
            const off = rtdb.onValue(
              ref,
              (snap) => {
                cache[key] = map(snap.val())
                onSnapshot({ ...cache })
              },
              (err) => onError?.(err),
            )
            unsubs.push(off)
          }
          const toList = (val) => (val ? Object.values(val) : [])
          watch('members', 'members', toList)
          watch('places', 'places', toList)
          watch('events', 'events', toList)
          watch('meta', 'meta', (v) => v || null)
        })
        .catch((err) => onError?.(err))

      return () => {
        cancelled = true
        for (const off of unsubs) off()
      }
    },

    async publishMember(circleId, member) {
      const { rtdb, database } = await db()
      const ref = rtdb.ref(database, path('circles', circleId, 'members', member.id))
      await rtdb.update(ref, member)
      // Mark the member offline if the app dies without a clean exit.
      rtdb.onDisconnect(rtdb.child(ref, 'online')).set(false)
      await rtdb.set(rtdb.child(ref, 'online'), true)
    },

    async savePlace(circleId, place) {
      const { rtdb, database } = await db()
      await rtdb.set(rtdb.ref(database, path('circles', circleId, 'places', place.id)), place)
    },

    async deletePlace(circleId, placeId) {
      const { rtdb, database } = await db()
      await rtdb.remove(rtdb.ref(database, path('circles', circleId, 'places', placeId)))
    },

    async pushEvent(circleId, event) {
      const { rtdb, database } = await db()
      await rtdb.set(rtdb.ref(database, path('circles', circleId, 'events', event.id)), event)
    },

    async leave(circleId, memberId) {
      const { rtdb, database } = await db()
      await rtdb.remove(rtdb.ref(database, path('circles', circleId, 'members', memberId)))
    },
  }
}

/** Find an invite code nobody is using yet. */
async function reserveCode(rtdb, database, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const code = inviteCode()
    const snap = await rtdb.get(rtdb.ref(database, `codes/${code}`))
    if (!snap.exists()) return code
  }
  // Astronomically unlikely; fall back to a longer code.
  return `${inviteCode()}${inviteCode().slice(0, 2)}`
}
