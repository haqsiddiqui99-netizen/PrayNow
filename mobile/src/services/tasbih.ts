import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DhikrId } from '@/src/data/duas'
import { dateKey } from '@/src/services/prayerTracker'

const KEY = 'praynow.tasbih.v1'

export type TasbihStore = {
  current: DhikrId
  /** Count in the running round for each dhikr. */
  counts: Partial<Record<DhikrId, number>>
  day: string
  today: number
  total: number
}

const fresh = (): TasbihStore => ({ current: 'subhanallah', counts: {}, day: dateKey(), today: 0, total: 0 })

/** The daily tally rolls over at midnight; running rounds are kept. */
function rollDay(store: TasbihStore): TasbihStore {
  const day = dateKey()
  return store.day === day ? store : { ...store, day, today: 0 }
}

export async function loadTasbih(): Promise<TasbihStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<TasbihStore>) : null
    if (!parsed || typeof parsed !== 'object') return fresh()
    return rollDay({ ...fresh(), ...parsed, counts: parsed.counts ?? {} })
  } catch {
    return fresh()
  }
}

export function saveTasbih(store: TasbihStore): void {
  void AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {})
}

export function countOnce(store: TasbihStore, id: DhikrId): TasbihStore {
  const next = rollDay(store)
  return {
    ...next,
    current: id,
    counts: { ...next.counts, [id]: (next.counts[id] ?? 0) + 1 },
    today: next.today + 1,
    total: next.total + 1,
  }
}

export function resetRound(store: TasbihStore, id: DhikrId): TasbihStore {
  return { ...store, counts: { ...store.counts, [id]: 0 } }
}
