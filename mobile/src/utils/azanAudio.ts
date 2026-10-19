import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { fetchAzanListenToken, joinLiveAzan, leaveLiveAzan } from '@/src/services/api'
import { AzanListener, isAgoraNativeAvailable } from '@/src/services/agoraClient'
import { isMosqueLive } from '@/src/store/liveAzanSessions'

// CC0 adhan (Wikimedia Commons, "Beautiful adhan"). Used when no live broadcast is on air.
const ADHAN_RECORDING = require('../../assets/audio/adhan.mp3')

let listener: AzanListener | null = null
let recording: AudioPlayer | null = null
let lastPlayer: AudioPlayer | null = null
let lastUrl: string | null = null
let countedMosqueId: string | null = null
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

function recordingPlayer() {
  if (!recording) recording = createAudioPlayer(ADHAN_RECORDING)
  return recording
}

async function leaveCounted() {
  const id = countedMosqueId
  countedMosqueId = null
  if (!id) return
  try {
    await leaveLiveAzan(id)
  } catch {
    /* the session may already have ended */
  }
}

async function countIfLive(mosqueId: string) {
  if (!isMosqueLive(mosqueId)) return
  try {
    await joinLiveAzan(mosqueId)
    countedMosqueId = mosqueId
  } catch {
    countedMosqueId = null
  }
}

/** Stop any live azan listener or recording. */
export async function stopAzan() {
  await leaveCounted()
  if (listener) {
    try {
      await listener.stop()
    } catch {
      /* noop */
    }
    listener = null
  }
  if (recording) {
    try {
      recording.pause()
    } catch {
      /* noop */
    }
  }
  if (lastPlayer) {
    try {
      lastPlayer.pause()
    } catch {
      /* noop */
    }
  }
  if (currentMosqueId !== null || currentSessionKey !== null || playing) {
    currentMosqueId = null
    currentSessionKey = null
    playing = false
    notify()
  }
}

async function playRecording(mosqueId: string, sessionKey: string) {
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  const player = recordingPlayer()
  await player.seekTo(0).catch(() => {})
  player.play()
  currentMosqueId = mosqueId
  currentSessionKey = sessionKey
  playing = true
  notify()
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

  if (isAgoraNativeAvailable() && isMosqueLive(mosqueId)) {
    try {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
      const { agora } = await fetchAzanListenToken(mosqueId)
      if (agora.configured && agora.appId) {
        const next = new AzanListener()
        await next.start(agora)
        listener = next
        currentMosqueId = mosqueId
        currentSessionKey = sessionKey
        playing = true
        notify()
        await countIfLive(mosqueId)
        return
      }
    } catch {
      if (listener) {
        try {
          await listener.stop()
        } catch {
          /* noop */
        }
        listener = null
      }
    }
  }

  await playRecording(mosqueId, sessionKey)
  await countIfLive(mosqueId)
}

function lastAzanPlayer(url: string): AudioPlayer {
  if (lastPlayer && lastUrl === url) return lastPlayer
  try {
    lastPlayer?.remove()
  } catch {
    /* already released */
  }
  lastPlayer = createAudioPlayer(url)
  lastUrl = url
  lastPlayer.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish || !playing || !currentSessionKey?.endsWith('-last')) return
    currentMosqueId = null
    currentSessionKey = null
    playing = false
    notify()
  })
  return lastPlayer
}

/** Play or pause the mosque's saved azan. Live broadcast uses toggleLiveAzan. */
export async function toggleLastAzan(mosqueId: string, url: string) {
  const sessionKey = `${mosqueId}-last`
  if (currentMosqueId === mosqueId && currentSessionKey === sessionKey && playing) {
    await stopAzan()
    return
  }
  await stopAzan()
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  const player = lastAzanPlayer(url)
  await player.seekTo(0).catch(() => {})
  player.play()
  currentMosqueId = mosqueId
  currentSessionKey = sessionKey
  playing = true
  notify()
}

/** @deprecated Use toggleLiveAzan(mosqueId, sessionKey). Kept for call-site compatibility. */
export async function toggleAzan(sessionKey: string, mosqueId?: string) {
  if (!mosqueId) {
    throw new Error('Mosque id is required for live azan.')
  }
  return toggleLiveAzan(mosqueId, sessionKey)
}
