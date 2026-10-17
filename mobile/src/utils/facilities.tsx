import type { ReactNode } from 'react'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { facilityTranslationKey, type TranslationKey } from '@/src/i18n/translations'

export type FacilityIconMeta = { lib: 'ion' | 'mci'; name: string }

export const FACILITY_ICONS: Record<string, FacilityIconMeta> = {
  'Wudu Area': { lib: 'mci', name: 'water' },
  Wazu: { lib: 'mci', name: 'water' },
  Washroom: { lib: 'mci', name: 'toilet' },
  Parking: { lib: 'ion', name: 'car-outline' },
  'Two-wheeler parking': { lib: 'mci', name: 'moped-outline' },
  'Four-wheeler parking': { lib: 'ion', name: 'car-outline' },
  'Chairs available': { lib: 'mci', name: 'seat-outline' },
  'Drinking water': { lib: 'mci', name: 'cup-water' },
  WiFi: { lib: 'ion', name: 'wifi-outline' },
  'Wheelchair access': { lib: 'mci', name: 'wheelchair-accessibility' },
  'Women section': { lib: 'ion', name: 'woman-outline' },
  'Women prayer area': { lib: 'ion', name: 'woman-outline' },
  Library: { lib: 'ion', name: 'library-outline' },
  AC: { lib: 'mci', name: 'air-conditioner' },
  'Historical site': { lib: 'mci', name: 'bank' },
}

/** Core amenities shown on home mosque cards. */
export const HOME_AMENITY_CATALOG = [
  { key: 'wudu', label: 'Wazu', shortLabel: 'Wazu', canonical: 'Wudu Area', aliases: ['Wudu Area', 'Wazu'] },
  { key: 'parking', label: 'Parking', shortLabel: 'Parking', canonical: 'Parking', aliases: ['Parking', 'Two-wheeler parking', 'Four-wheeler parking'] },
  { key: 'washroom', label: 'Washroom', shortLabel: 'Washroom', canonical: 'Washroom', aliases: ['Washroom'] },
  {
    key: 'women',
    label: 'Women area',
    shortLabel: 'Women area',
    canonical: 'Women section',
    aliases: ['Women section', 'Women prayer area'],
  },
  {
    key: 'wheelchair',
    label: 'Wheelchair',
    shortLabel: 'Access',
    canonical: 'Wheelchair access',
    aliases: ['Wheelchair access'],
  },
] as const

export type HomeAmenityKey = (typeof HOME_AMENITY_CATALOG)[number]['key']

/** Facilities people can filter nearby mosques by; matched through the same keys used for translation. */
export const FACILITY_FILTERS = [
  { id: 'women', label: 'facility.womenSection', icon: 'Women section', keys: ['facility.womenSection', 'facility.womenPrayer'] },
  { id: 'parking', label: 'facility.parking', icon: 'Parking', keys: ['facility.parking', 'facility.parking2', 'facility.parking4'] },
  { id: 'parking2', label: 'facility.parking2', icon: 'Two-wheeler parking', keys: ['facility.parking2'] },
  { id: 'parking4', label: 'facility.parking4', icon: 'Four-wheeler parking', keys: ['facility.parking4'] },
  { id: 'chairs', label: 'facility.chairs', icon: 'Chairs available', keys: ['facility.chairs'] },
  { id: 'drinkingWater', label: 'facility.drinkingWater', icon: 'Drinking water', keys: ['facility.drinkingWater'] },
  { id: 'wudu', label: 'facility.wuduArea', icon: 'Wudu Area', keys: ['facility.wuduArea', 'facility.wazu'] },
  { id: 'wheelchair', label: 'facility.wheelchair', icon: 'Wheelchair access', keys: ['facility.wheelchair'] },
  { id: 'washroom', label: 'facility.washroom', icon: 'Washroom', keys: ['facility.washroom'] },
] as const satisfies readonly { id: string; label: TranslationKey; icon: string; keys: readonly TranslationKey[] }[]

export type FacilityFilterId = (typeof FACILITY_FILTERS)[number]['id']

/** Keeps mosques that list every selected facility. */
export function filterMosquesByFacilities<T extends { facilities: string[] }>(mosques: T[], ids: readonly FacilityFilterId[]): T[] {
  if (!ids.length) return mosques
  const wanted = FACILITY_FILTERS.filter((f) => ids.includes(f.id))
  return mosques.filter((m) => {
    const have = new Set(
      (Array.isArray(m.facilities) ? m.facilities : []).map((name) => facilityTranslationKey(String(name))).filter(Boolean),
    )
    return wanted.every((f) => f.keys.some((key) => have.has(key)))
  })
}

function normalizeFacility(value: string) {
  return value.toLowerCase().trim()
}

export function hasFacility(facilities: string[], aliases: readonly string[]) {
  const set = new Set(facilities.map(normalizeFacility))
  return aliases.some((alias) => set.has(normalizeFacility(alias)))
}

export function renderFacilityIcon(
  canonical: string,
  size: number,
  color: string,
): ReactNode {
  const meta = FACILITY_ICONS[canonical]
  if (!meta) {
    return <Ionicons name="checkmark-circle-outline" size={size} color={color} />
  }
  if (meta.lib === 'mci') {
    return <MaterialCommunityIcons name={meta.name as never} size={size} color={color} />
  }
  return <Ionicons name={meta.name as never} size={size} color={color} />
}
