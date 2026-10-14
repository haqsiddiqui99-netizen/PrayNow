import AsyncStorage from '@react-native-async-storage/async-storage'
import { dateKey } from '@/src/services/prayerTracker'

const KEY = 'praynow.quran.v1'
/** Pages in the standard Madani mushaf. */
export const QURAN_PAGES = 604
export const JUZ_PAGES = 20

export type QuranGoal = 'ramadan' | 'month' | 'twoMonths'

export type QuranStore = {
  /** Last page finished, 0 before starting. */
  page: number
  /** Pages read per date key. */
  log: Record<string, number>
  khatams: number
  goal: { kind: QuranGoal; by: string } | null
}

const empty = (): QuranStore => ({ page: 0, log: {}, khatams: 0, goal: null })

export async function loadQuran(): Promise<QuranStore> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null')
    if (!parsed || typeof parsed !== 'object') return empty()
    return {
      page: Math.min(QURAN_PAGES, Math.max(0, Number(parsed.page) || 0)),
      log: parsed.log && typeof parsed.log === 'object' ? parsed.log : {},
      khatams: Math.max(0, Number(parsed.khatams) || 0),
      goal: parsed.goal && typeof parsed.goal.by === 'string' ? parsed.goal : null,
    }
  } catch {
    return empty()
  }
}

async function saveQuran(store: QuranStore) {
  await AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {})
}

/** Juz (1-30) that the page belongs to; juz 1 runs to page 21, then 20 pages each. */
export function juzOf(page: number): number {
  if (page < 22) return 1
  return Math.min(30, Math.floor((page - 22) / JUZ_PAGES) + 2)
}

/**
 * Record pages read today. Negative values undo a slip. Reaching the last page
 * completes a khatam and starts again from the beginning.
 */
export async function readPages(pages: number): Promise<{ store: QuranStore; finished: boolean }> {
  const store = await loadQuran()
  const today = dateKey()
  const step = Math.max(-store.page, Math.min(pages, QURAN_PAGES - store.page))
  const logged = Math.max(0, (store.log[today] ?? 0) + step)
  store.log = { ...store.log, [today]: logged }
  store.page += step
  let finished = false
  if (store.page >= QURAN_PAGES) {
    store.khatams += 1
    store.page = 0
    finished = true
  }
  await saveQuran(store)
  return { store, finished }
}

/** Jump to a page; moving forward counts as today's reading. */
export async function setQuranPage(page: number): Promise<{ store: QuranStore; finished: boolean }> {
  const current = await loadQuran()
  const target = Math.min(QURAN_PAGES, Math.max(0, Math.round(page)))
  if (target >= current.page) return readPages(target - current.page)
  current.page = target
  await saveQuran(current)
  return { store: current, finished: false }
}

export async function setQuranGoal(goal: QuranStore['goal']): Promise<QuranStore> {
  const store = await loadQuran()
  store.goal = goal
  await saveQuran(store)
  return store
}

/** Consecutive days with some reading, keeping today open. */
export function readingStreak(store: QuranStore, today = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!(store.log[dateKey(cursor)] > 0)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (store.log[dateKey(cursor)] > 0 && streak < 4000) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function pagesInLastDays(store: QuranStore, days: number, today = new Date()): number {
  let total = 0
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    total += store.log[dateKey(day)] ?? 0
  }
  return total
}

/** Days left until the goal date, counting today. */
export function daysLeft(by: string, today = new Date()): number {
  const [year, month, day] = by.split('-').map(Number)
  const end = Date.UTC(year, month - 1, day)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end - start) / 86400000) + 1
}
