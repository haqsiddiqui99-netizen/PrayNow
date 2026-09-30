import type { Mosque, PrayerName } from '@/src/types'
import type { TranslationKey } from '@/src/i18n/translations'
import { getCurrentPrayerForMosques, isFriday, parseTime } from '@/src/utils/prayerSchedule'

export type MosqueSortMode =
  | 'nearest'
  | 'farthest'
  | 'early-namaz'
  | 'late-namaz'
  | 'capacity-high'
  | 'capacity-low'

export type MosqueMadhabFilter = 'all' | 'hanafi' | 'shafii' | 'maliki' | 'hanbali' | 'jafri'

/** @deprecated Use MosqueMadhabFilter */
export type MosqueSectFilter = MosqueMadhabFilter

export const MOSQUE_MADHAB_OPTIONS: {
  id: MosqueMadhabFilter
  label: string
  imam?: string
}[] = [
  { id: 'all', label: 'All' },
  { id: 'hanafi', label: 'Hanafi', imam: 'Imam Abu Hanifa' },
  { id: 'shafii', label: "Shafi'i", imam: "Imam Shafi'i" },
  { id: 'maliki', label: 'Maliki', imam: 'Imam Malik' },
  { id: 'hanbali', label: 'Hanbali', imam: 'Imam Ahmad ibn Hanbal' },
  { id: 'jafri', label: 'Jafri', imam: 'Imam Jafar al-Sadiq' },
]

/** @deprecated Use MOSQUE_MADHAB_OPTIONS */
export const MOSQUE_SECT_OPTIONS = MOSQUE_MADHAB_OPTIONS

const MADHAB_ALIASES: Record<Exclude<MosqueMadhabFilter, 'all'>, string[]> = {
  hanafi: ['hanafi', 'hanafee'],
  shafii: ['shafii', 'shafi', 'shafei', "shafi'i"],
  maliki: ['maliki', 'maleki'],
  hanbali: ['hanbali', 'hambali'],
  jafri: ['jafri', 'jafari', 'jafariyya', "ja'fari"],
}

/** Map legacy sect tags from OSM/seed data to a madhab filter id. */
const LEGACY_SECT_TO_MADHAB: Record<string, Exclude<MosqueMadhabFilter, 'all'>> = {
  shia: 'jafri',
  'ahle-hadees': 'hanbali',
  deobandi: 'hanafi',
  barelvi: 'hanafi',
  sunni: 'hanafi',
}

function normalizeMadhab(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-')
}

function mosqueMatchesMadhab(mosqueSect: string, madhab: Exclude<MosqueMadhabFilter, 'all'>): boolean {
  const normalized = normalizeMadhab(mosqueSect)
  if (normalized === madhab) return true
  if (MADHAB_ALIASES[madhab].some((alias) => normalizeMadhab(alias) === normalized)) return true
  return LEGACY_SECT_TO_MADHAB[normalized] === madhab
}

export function filterMosquesByMadhab(mosques: Mosque[], madhab: MosqueMadhabFilter): Mosque[] {
  if (madhab === 'all') return mosques
  return mosques.filter((m) => mosqueMatchesMadhab(m.sect || '', madhab))
}

/** @deprecated Use filterMosquesByMadhab */
export function filterMosquesBySect(mosques: Mosque[], sect: MosqueSectFilter): Mosque[] {
  return filterMosquesByMadhab(mosques, sect)
}

export type MosqueSortIcon =
  | 'navigate-outline'
  | 'time-outline'
  | 'people-outline'
  | 'compass-outline'
  | 'home-outline'
  | 'moon-outline'

export const MOSQUE_SORT_OPTIONS: {
  id: MosqueSortMode
  label: string
  labelKey: TranslationKey
  icon: MosqueSortIcon
}[] = [
  { id: 'nearest', label: 'Nearest', labelKey: 'sort.nearest', icon: 'navigate-outline' },
  { id: 'early-namaz', label: 'Early', labelKey: 'sort.early', icon: 'time-outline' },
  { id: 'late-namaz', label: 'Late', labelKey: 'sort.late', icon: 'moon-outline' },
  { id: 'farthest', label: 'Farthest', labelKey: 'sort.farthest', icon: 'compass-outline' },
  { id: 'capacity-high', label: 'Largest', labelKey: 'sort.largest', icon: 'people-outline' },
  { id: 'capacity-low', label: 'Smallest', labelKey: 'sort.smallest', icon: 'home-outline' },
]

export function formatCapacity(capacity: number): string {
  if (!capacity || capacity <= 0) return '—'
  if (capacity >= 10000) return `${Math.round(capacity / 1000)}k`
  if (capacity >= 1000) {
    const k = capacity / 1000
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`
  }
  return capacity.toLocaleString()
}

function getMosqueJamatTime(mosque: Mosque, prayerName: PrayerName, now: Date): string {
  if (prayerName === 'Dhuhr' && isFriday(now)) {
    return mosque.jumaTimings.namaz || mosque.timings.Dhuhr.jamat
  }
  return mosque.timings[prayerName]?.jamat ?? ''
}

export function getEarliestJamatTime(
  mosques: Mosque[],
  prayerName: PrayerName,
  now = new Date(),
): string | null {
  let earliest: { time: string; minutes: number } | null = null

  for (const mosque of mosques) {
    const jamat = getMosqueJamatTime(mosque, prayerName, now).trim()
    if (!jamat) continue

    const minutes = parseTime(jamat)
    if (!earliest || minutes < earliest.minutes) {
      earliest = { time: jamat, minutes }
    }
  }

  return earliest?.time ?? null
}

function namazForSort(mosque: Mosque, prayerName: PrayerName, now: Date): string {
  return getMosqueJamatTime(mosque, prayerName, now)
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
