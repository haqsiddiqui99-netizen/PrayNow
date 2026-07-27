import type { Mosque, PrayerName } from '@/src/types'
import { getCurrentPrayerForMosques, isFriday, parseTime } from '@/src/utils/prayerSchedule'

export type MosqueSortMode =
  | 'nearest'
  | 'farthest'
  | 'early-namaz'
  | 'late-namaz'
  | 'capacity-high'
  | 'capacity-low'

export type MosqueSectFilter = 'all' | 'sunni' | 'shia' | 'ahle-hadees' | 'barelvi' | 'deobandi'

export type MosqueSortIcon =
  | 'navigate-outline'
  | 'time-outline'
  | 'people-outline'
  | 'compass-outline'
  | 'home-outline'
  | 'moon-outline'

export const MOSQUE_SORT_OPTIONS: { id: MosqueSortMode; label: string; icon: MosqueSortIcon }[] = [
  { id: 'nearest', label: 'Nearest', icon: 'navigate-outline' },
  { id: 'early-namaz', label: 'Earliest', icon: 'time-outline' },
  { id: 'capacity-high', label: 'Largest', icon: 'people-outline' },
  { id: 'farthest', label: 'Farthest', icon: 'compass-outline' },
  { id: 'capacity-low', label: 'Smallest', icon: 'home-outline' },
  { id: 'late-namaz', label: 'Late prayer', icon: 'moon-outline' },
]

export const MOSQUE_SECT_OPTIONS: { id: MosqueSectFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'sunni', label: 'Sunni' },
  { id: 'shia', label: 'Shia' },
  { id: 'ahle-hadees', label: 'Ahle Hadees' },
  { id: 'barelvi', label: 'Barelvi' },
  { id: 'deobandi', label: 'Deobandi' },
]

function normalizeSect(sect: string) {
  return sect.trim().toLowerCase().replace(/\s+/g, '-')
}

export function filterMosquesBySect(mosques: Mosque[], sect: MosqueSectFilter): Mosque[] {
  if (sect === 'all') return mosques
  return mosques.filter((m) => normalizeSect(m.sect) === sect)
}

export function formatCapacity(capacity: number): string {
  if (capacity >= 10000) return `${Math.round(capacity / 1000)}k`
  if (capacity >= 1000) {
    const k = capacity / 1000
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`
  }
  return capacity.toLocaleString()
}

function namazForSort(mosque: Mosque, prayerName: PrayerName, now: Date): string {
  if (prayerName === 'Dhuhr' && isFriday(now)) {
    return mosque.jumaTimings.namaz || mosque.timings.Dhuhr.jamat
  }
  return mosque.timings[prayerName].jamat
}

export function sortMosques(mosques: Mosque[], mode: MosqueSortMode, now = new Date()): Mosque[] {
  const list = [...mosques]

  switch (mode) {
    case 'nearest':
      return list.sort((a, b) => a.distance - b.distance)
    case 'farthest':
      return list.sort((a, b) => b.distance - a.distance)
    case 'capacity-high':
      return list.sort((a, b) => b.capacity - a.capacity || a.distance - b.distance)
    case 'capacity-low':
      return list.sort((a, b) => a.capacity - b.capacity || a.distance - b.distance)
    case 'early-namaz': {
      const prayerName = getCurrentPrayerForMosques(now)?.name ?? 'Dhuhr'
      return list.sort((a, b) => {
        const diff = parseTime(namazForSort(a, prayerName, now)) - parseTime(namazForSort(b, prayerName, now))
        return diff !== 0 ? diff : a.distance - b.distance
      })
    }
    case 'late-namaz': {
      const prayerName = getCurrentPrayerForMosques(now)?.name ?? 'Dhuhr'
      return list.sort((a, b) => {
        const diff = parseTime(namazForSort(b, prayerName, now)) - parseTime(namazForSort(a, prayerName, now))
        return diff !== 0 ? diff : a.distance - b.distance
      })
    }
    default:
      return list
  }
}
