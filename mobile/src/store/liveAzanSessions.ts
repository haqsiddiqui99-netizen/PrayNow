import { fetchLiveAzanSessions, type LiveAzanSession } from '@/src/services/api'

/**
 * Lightweight polling store for live azan broadcast sessions.
 * Polling starts when the first subscriber attaches and stops when the last
 * one detaches, so it costs nothing when the mosque list isn't on screen.
 */

const POLL_INTERVAL_MS = 20000

let sessions: LiveAzanSession[] = []
let byMosqueId: Map<string, LiveAzanSession> = new Map()
let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((cb) => cb())
}

async function poll() {
  if (inFlight) return
  inFlight = true
  try {
    const next = await fetchLiveAzanSessions()
    sessions = next
    byMosqueId = new Map(next.map((s) => [String(s.mosqueId), s]))
    notify()
  } finally {
    inFlight = false
  }
}

function ensurePolling() {
  if (timer) return
  void poll()
  timer = setInterval(() => void poll(), POLL_INTERVAL_MS)
}

function maybeStopPolling() {
  if (listeners.size === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}

/** Subscribe to session changes. Returns an unsubscribe fn. */
export function subscribeLiveSessions(cb: () => void): () => void {
  listeners.add(cb)
  ensurePolling()
  return () => {
    listeners.delete(cb)
    maybeStopPolling()
  }
}

/** Force an immediate refresh (e.g. on pull-to-refresh). */
export function refreshLiveSessions() {
  return poll()
}

export function getLiveSession(mosqueId: string): LiveAzanSession | null {
  return byMosqueId.get(String(mosqueId)) ?? null
}

export function isMosqueLive(mosqueId: string): boolean {
  return byMosqueId.has(String(mosqueId))
}

export function getAllLiveSessions(): LiveAzanSession[] {
  return sessions
}
