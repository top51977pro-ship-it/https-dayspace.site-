import { createDemoProvider } from './demo'
import { createFirebaseProvider, firebaseConfig } from './firebase'

let provider = null

/**
 * Firebase when the build carries credentials, otherwise the on-device demo backend.
 * Same interface either way, so nothing above this line has to care.
 */
export function getProvider() {
  if (!provider) {
    const config = firebaseConfig()
    provider = config ? createFirebaseProvider(config) : createDemoProvider()
  }
  return provider
}

export function isDemoMode() {
  return getProvider().mode === 'demo'
}
