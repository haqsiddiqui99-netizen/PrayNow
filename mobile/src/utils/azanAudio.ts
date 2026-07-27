import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

// Remote azan (adhan) audio. Kept as a constant so it can later be swapped for a
// bundled asset or a per-mosque live stream URL.
const AZAN_URL = 'https://www.islamcan.com/audio/adhan/azan1.mp3'

let player: AudioPlayer | null = null
let currentId: string | null = null
let playing = false
let statusSub: { remove: () => void } | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((cb) => cb())
}

export type AzanState = { id: string | null; playing: boolean }

/** Subscribe to azan playback changes. Returns an unsubscribe fn. */
export function subscribeAzan(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Current azan playback state. */
export function getAzanState(): AzanState {
  return { id: currentId, playing }
}

/** Stop any loaded azan and release the player. */
export function stopAzan() {
  if (statusSub) {
    try {
      statusSub.remove()
    } catch {
      /* noop */
    }
    statusSub = null
  }
  if (player) {
    try {
      player.remove()
    } catch {
      /* noop */
    }
    player = null
  }
  if (currentId !== null || playing) {
    currentId = null
    playing = false
    notify()
  }
}

/**
 * Toggle azan playback for a given id:
 *  - tapping a new id starts it from the beginning
 *  - tapping the currently playing id pauses it
 *  - tapping the currently paused id resumes it
 * Safe to call on web / when audio is unavailable (fails silently).
 */
export async function toggleAzan(id: string) {
  // Same azan already loaded → just toggle play/pause.
  if (currentId === id && player) {
    try {
      if (playing) {
        player.pause()
        playing = false
      } else {
        player.play()
        playing = true
      }
      notify()
    } catch {
      stopAzan()
    }
    return
  }

  // Different azan (or nothing loaded) → start fresh.
  stopAzan()

  try {
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    const next = createAudioPlayer({ uri: AZAN_URL })
    player = next
    currentId = id
    playing = true
    notify()

    statusSub = next.addListener('playbackStatusUpdate', (status) => {
      if (status?.didJustFinish) {
        stopAzan()
      }
    })

    next.play()
  } catch {
    stopAzan()
  }
}
