import { createDemoProvider } from './demo'
import { createMqttProvider } from './mqtt'
import { createFirebaseProvider, firebaseConfig } from './firebase'

let provider = null

/**
 * Backend selection, best first:
 *
 *   firebase — a private database, when the build carries credentials
 *   mqtt     — the default: a public broker with end-to-end encrypted payloads,
 *              so a freshly installed APK shares real locations with no signup
 *   demo     — simulated relatives, only when explicitly asked for at build time
 *
 * All three expose the same interface, so nothing above this layer changes.
 */
export function getProvider() {
  if (!provider) {
    const forced = import.meta.env.VITE_BACKEND
    const config = firebaseConfig()

    if (forced === 'demo') provider = createDemoProvider()
    else if (forced === 'mqtt') provider = createMqttProvider()
    else if (config) provider = createFirebaseProvider(config)
    else provider = createMqttProvider()
  }
  return provider
}

export function isDemoMode() {
  return getProvider().mode === 'demo'
}
