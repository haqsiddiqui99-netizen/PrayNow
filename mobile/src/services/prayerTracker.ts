import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PrayerName } from '@/src/types'

const KEY = 'praynow.prayerTracker.v1'

export const TRACKED_PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export type DayLog = Partial<Record<PrayerName, boolean>>
export type TrackerStore = Record<string, DayLog>

export function dateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function countDone(log: DayLog | undefined): number {
  return TRACKED_PRAYERS.filter((name) => Boolean(log?.[name])).length
}

export function isComplete(log: DayLog | undefined): boolean {
  return countDone(log) === TRACKED_PRAYERS.length
}

/** Consecutive complete days, keeping today open so an unfinished morning does not break it. */
export function streakOf(store: TrackerStore, today = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!isComplete(store[dateKey(cursor)])) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (isComplete(store[dateKey(cursor)])) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
    if (streak > 4000) break
  }
  return streak
}

export async function loadTracker(): Promise<TrackerStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as TrackerStore) : {}
  } catch {
    return {}
  }
}

// --- Qaza (missed prayers to make up) ---

const QAZA_KEY = 'praynow.qaza.v1'

export type PrayerCounts = Record<PrayerName, number>
/** `log` counts prayers made up per date key, for the weekly summary. */
export type QazaStore = { added: Partial<PrayerCounts>; madeUp: Partial<PrayerCounts>; log?: Record<string, number> }

const zeroCounts = (): PrayerCounts => ({ Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 })

/**
 * Prayers left unticked on past days the user did track. Days with nothing logged
 * are skipped, since an unused app is not the same as a missed prayer.
 */
export function missedFromTracker(store: TrackerStore, today = new Date()): PrayerCounts {
  const counts = zeroCounts()
  const todayKey = dateKey(today)
  for (const [key, log] of Object.entries(store)) {
    if (key >= todayKey || countDone(log) === 0) continue
    for (const name of TRACKED_PRAYERS) if (!log[name]) counts[name] += 1
  }
  return counts
}

export function qazaBalance(store: TrackerStore, qaza: QazaStore, today = new Date()): PrayerCounts {
  const missed = missedFromTracker(store, today)
  const balance = zeroCounts()
  for (const name of TRACKED_PRAYERS) {
    balance[name] = Math.max(0, missed[name] + (qaza.added[name] ?? 0) - (qaza.madeUp[name] ?? 0))
  }
  return balance
}

export async function loadQaza(): Promise<QazaStore> {
  try {
    const raw = await AsyncStorage.getItem(QAZA_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      added: parsed?.added && typeof parsed.added === 'object' ? parsed.added : {},
      madeUp: parsed?.madeUp && typeof parsed.madeUp === 'object' ? parsed.madeUp : {},
      log: parsed?.log && typeof parsed.log === 'object' ? parsed.log : {},
    }
  } catch {
    return { added: {}, madeUp: {} }
  }
}

/** `made` records one prayer made up; `add` records an older missed prayer. */
export async function adjustQaza(name: PrayerName, action: 'made' | 'add'): Promise<QazaStore> {
  const qaza = await loadQaza()
  const field = action === 'made' ? 'madeUp' : 'added'
  qaza[field] = { ...qaza[field], [name]: (qaza[field][name] ?? 0) + 1 }
  if (action === 'made') {
    const key = dateKey()
    qaza.log = { ...qaza.log, [key]: (qaza.log?.[key] ?? 0) + 1 }
  }
  await AsyncStorage.setItem(QAZA_KEY, JSON.stringify(qaza)).catch(() => {})
  return qaza
}

export type WeekSummary = {
  offered: number
  previous: number
  fullDays: number
  qazaMade: number
  perPrayer: PrayerCounts
  /** Prayer with the fewest ticks this week, when it is below 7. */
  weakest: PrayerName | null
}

/** The last 7 days ending today, compared with the 7 days before. */
export function weekSummary(store: TrackerStore, qaza: QazaStore, today = new Date()): WeekSummary {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const perPrayer = zeroCounts()
  let offered = 0
  let previous = 0
  let fullDays = 0
  let qazaMade = 0
  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() - offset)
    const key = dateKey(day)
    const log = store[key]
    if (offset >= 7) {
      previous += countDone(log)
      continue
    }
    offered += countDone(log)
    if (isComplete(log)) fullDays += 1
    qazaMade += qaza.log?.[key] ?? 0
    for (const name of TRACKED_PRAYERS) if (log?.[name]) perPrayer[name] += 1
  }
  let weakest: PrayerName | null = null
  for (const name of TRACKED_PRAYERS) {
    if (perPrayer[name] < 7 && (weakest === null || perPrayer[name] < perPrayer[weakest])) weakest = name
  }
  return { offered, previous, fullDays, qazaMade, perPrayer, weakest }
}

export async function toggleTrackedPrayer(name: PrayerName, day = new Date()): Promise<TrackerStore> {
  const store = await loadTracker()
  const key = dateKey(day)
  const log = { ...(store[key] || {}) }
  log[name] = !log[name]
  store[key] = log
  await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {})
  return store
}
