import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchUpcomingMosqueEvents, type MosqueEvent } from '@/src/services/api'
import { syncOneShotAlerts, type AlertSyncResult } from '@/src/services/localAlerts'

const REMINDERS_KEY = 'praynow.mosqueEventReminders.v1'
const CACHE_MS = 5 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** A session still shows for this long after it starts. */
const ONGOING_MS = 60 * 60 * 1000
/** Minutes before an event that its reminder rings. */
export const EVENT_LEAD = 30

export type SavedEventReminder = MosqueEvent & { mosqueName: string }

export type EventReminderText = {
  title: (event: string, lead: number) => string
  body: (mosque: string, when: string) => string
  when: (date: Date) => string
}

/** Next session at or after `from`; weekly events roll forward a week at a time. */
export function nextOccurrence(event: Pick<MosqueEvent, 'startsAt' | 'weekly'>, from = new Date()): Date | null {
  const start = new Date(event.startsAt)
  if (Number.isNaN(start.getTime())) return null
  const since = from.getTime() - ONGOING_MS
  if (start.getTime() >= since) return start
  if (!event.weekly) return null
  const steps = Math.ceil((since - start.getTime()) / WEEK_MS)
  return new Date(start.getTime() + steps * WEEK_MS)
}

// --- Shared list of upcoming events, one request for every mosque card ---

let cache: { at: number; events: MosqueEvent[] } | null = null
let inflight: Promise<MosqueEvent[]> | null = null
const listeners = new Set<(events: MosqueEvent[]) => void>()

export function cachedMosqueEvents(): MosqueEvent[] {
  return cache?.events ?? []
}

/** Changes on every successful fetch. */
export function mosqueEventsStamp(): number {
  return cache?.at ?? 0
}

export function subscribeMosqueEvents(listener: (events: MosqueEvent[]) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function loadMosqueEvents(force = false): Promise<MosqueEvent[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.events)
  if (inflight) return inflight
  inflight = fetchUpcomingMosqueEvents()
    .then((events) => {
      cache = { at: Date.now(), events }
      listeners.forEach((listener) => listener(events))
      return events
    })
    .catch(() => cache?.events ?? [])
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Events for one mosque, soonest session first. */
export function eventsForMosque(events: MosqueEvent[], mosqueId: string, now = new Date()) {
  return events
    .filter((event) => String(event.mosqueId) === String(mosqueId))
    .map((event) => ({ event, next: nextOccurrence(event, now) }))
    .filter((item): item is { event: MosqueEvent; next: Date } => item.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
}

// --- Reminders chosen by the user, kept on the device ---

export async function loadEventReminders(): Promise<Record<string, SavedEventReminder>> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(REMINDERS_KEY)) || '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedEventReminder>) : {}
  } catch {
    return {}
  }
}

async function saveEventReminders(store: Record<string, SavedEventReminder>) {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(store)).catch(() => {})
}

function alertsFor(store: Record<string, SavedEventReminder>, text: EventReminderText) {
  const now = new Date()
  return Object.values(store).flatMap((saved) => {
    const first = nextOccurrence(saved, now)
    if (!first) return []
    const sessions = saved.weekly ? [0, 1, 2, 3].map((week) => new Date(first.getTime() + week * WEEK_MS)) : [first]
    return sessions.map((start) => ({
      id: `${saved.id}-${start.getTime()}`,
      at: new Date(start.getTime() - EVENT_LEAD * 60 * 1000),
      title: text.title(saved.title, EVENT_LEAD),
      body: text.body(saved.mosqueName, text.when(start)),
    }))
  })
}

export async function setEventReminder(
  event: MosqueEvent,
  mosqueName: string,
  on: boolean,
  text: EventReminderText,
): Promise<{ store: Record<string, SavedEventReminder>; result: AlertSyncResult }> {
  const store = await loadEventReminders()
  if (on) store[event.id] = { ...event, mosqueName }
  else delete store[event.id]
  await saveEventReminders(store)
  const result = await syncOneShotAlerts('mosque-events', alertsFor(store, text), { askPermission: on, limit: 6 })
  return { store, result }
}

/**
 * Re-schedule saved reminders. With `latest`, changed times are picked up and events
 * the mosque removed are dropped.
 */
export async function syncEventReminders(text: EventReminderText, latest?: MosqueEvent[]) {
  const store = await loadEventReminders()
  if (!Object.keys(store).length) return
  if (latest) {
    const byId = new Map(latest.map((event) => [event.id, event]))
    for (const id of Object.keys(store)) {
      const fresh = byId.get(id)
      if (fresh) store[id] = { ...store[id], ...fresh }
      else delete store[id]
    }
    await saveEventReminders(store)
  }
  await syncOneShotAlerts('mosque-events', alertsFor(store, text), { limit: 6 })
}
