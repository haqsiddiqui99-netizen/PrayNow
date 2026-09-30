import { setAudioModeAsync } from 'expo-audio'
import { fetchAzanListenToken } from '@/src/services/api'
import { AzanListener, isAgoraNativeAvailable } from '@/src/services/agoraClient'

let listener: AzanListener | null = null
let currentMosqueId: string | null = null
let currentSessionKey: string | null = null
let playing = false
const stateListeners = new Set<() => void>()

function notify() {
  stateListeners.forEach((cb) => cb())
}

export type AzanState = {
  mosqueId: string | null
  id: string | null
  playing: boolean
  nativeAgora: boolean
}

/** Subscribe to azan playback changes. Returns an unsubscribe fn. */
export function subscribeAzan(cb: () => void): () => void {
  stateListeners.add(cb)
  return () => {
    stateListeners.delete(cb)
  }
}

/** Current azan playback state. */
export function getAzanState(): AzanState {
  return {
    mosqueId: currentMosqueId,
    id: currentSessionKey,
    playing,
    nativeAgora: isAgoraNativeAvailable(),
  }
}

/** Stop any live azan listener. */
export async function stopAzan() {
  if (listener) {
    try {
      await listener.stop()
    } catch {
      /* noop */
    }
    listener = null
  }
  if (currentMosqueId !== null || currentSessionKey !== null || playing) {
    currentMosqueId = null
    currentSessionKey = null
    playing = false
    notify()
  }
}

/**
 * Toggle live azan for a mosque:
 *  - same session → stop
 *  - different session → switch streams (one azan at a time)
 */
export async function toggleLiveAzan(mosqueId: string, sessionKey: string) {
  if (currentMosqueId === mosqueId && currentSessionKey === sessionKey && playing) {
    await stopAzan()
    return
  }

  await stopAzan()

  if (!isAgoraNativeAvailable()) {
    throw new Error(
      'Live azan audio needs a PrayNow dev build (not Expo Go). Use web Live Azan or run: npm run eas:preview',
    )
  }

  try {
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    const { agora } = await fetchAzanListenToken(mosqueId)
    if (!agora.configured || !agora.appId) {
      throw new Error('Live audio is not configured on the server.')
    }

    const next = new AzanListener()
    await next.start(agora)
    listener = next
    currentMosqueId = mosqueId
    currentSessionKey = sessionKey
    playing = true
    notify()
  } catch (error) {
    await stopAzan()
    throw error
  }
}

/** @deprecated Use toggleLiveAzan(mosqueId, sessionKey). Kept for call-site compatibility. */
export async function toggleAzan(sessionKey: string, mosqueId?: string) {
  if (!mosqueId) {
    throw new Error('Mosque id is required for live azan.')
  }
  return toggleLiveAzan(mosqueId, sessionKey)
}
