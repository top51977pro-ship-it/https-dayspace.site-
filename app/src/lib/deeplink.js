import { App as CapApp } from '@capacitor/app'
import { normalizeCode } from './id'
import { isNative } from './device'

let pendingCode = null
const listeners = new Set()

/** Pull an invite code out of https://…/join/ABC123, dayspace://join/ABC123 or ?code=… */
export function extractInviteCode(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const fromQuery = parsed.searchParams.get('code')
    if (fromQuery) return normalizeCode(fromQuery) || null
    const match = parsed.pathname.match(/join\/?\/?([A-Za-z0-9]{4,8})/)
    if (match) return normalizeCode(match[1]) || null
  } catch {
    const match = String(url).match(/join[/:]([A-Za-z0-9]{4,8})/)
    if (match) return normalizeCode(match[1]) || null
  }
  return null
}

function publish(code) {
  if (!code) return
  pendingCode = code
  for (const listener of listeners) listener(code)
}

/** Call once at startup. Handles both cold launches and links opened while running. */
export async function initDeepLinks() {
  if (!isNative) {
    publish(extractInviteCode(window.location.href))
    return
  }
  try {
    const launch = await CapApp.getLaunchUrl()
    publish(extractInviteCode(launch?.url))
  } catch {
    /* no launch url */
  }
  CapApp.addListener('appUrlOpen', (event) => publish(extractInviteCode(event.url))).catch(
    () => {},
  )
}

export function takePendingInviteCode() {
  const code = pendingCode
  pendingCode = null
  return code
}

export function onInviteCode(listener) {
  listeners.add(listener)
  if (pendingCode) listener(pendingCode)
  return () => listeners.delete(listener)
}
