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

export async function toggleTrackedPrayer(name: PrayerName, day = new Date()): Promise<TrackerStore> {
  const store = await loadTracker()
  const key = dateKey(day)
  const log = { ...(store[key] || {}) }
  log[name] = !log[name]
  store[key] = log
  await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {})
  return store
}
