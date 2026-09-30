import type { Mosque, PrayerName } from '../types'
import { getCurrentPrayerForMosques, isFriday, parseTime } from './prayerSchedule'

export type MosqueSortMode = 'nearest' | 'early-namaz'

export const MOSQUE_SORT_OPTIONS: { id: MosqueSortMode; label: string }[] = [
  { id: 'nearest', label: 'Nearest' },
  { id: 'early-namaz', label: 'Early' },
]

function namazForSort(mosque: Mosque, prayerName: PrayerName, now: Date): string {
  if (prayerName === 'Dhuhr' && isFriday(now)) {
    return mosque.jumaTimings.namaz || mosque.timings.Dhuhr.jamat
  }
  return mosque.timings[prayerName].jamat
}

export function sortMosques(mosques: Mosque[], mode: MosqueSortMode, now = new Date()): Mosque[] {
  const list = [...mosques]

  if (mode === 'nearest') {
    return list.sort((a, b) => a.distance - b.distance)
  }

  const prayerName = getCurrentPrayerForMosques(now)?.name ?? 'Dhuhr'

  return list.sort((a, b) => {
    const diff = parseTime(namazForSort(a, prayerName, now)) - parseTime(namazForSort(b, prayerName, now))
    return diff !== 0 ? diff : a.distance - b.distance
  })
}
