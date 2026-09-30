import type { ReactNode } from 'react'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'

export type FacilityIconMeta = { lib: 'ion' | 'mci'; name: string }

export const FACILITY_ICONS: Record<string, FacilityIconMeta> = {
  'Wudu Area': { lib: 'mci', name: 'water' },
  Wazu: { lib: 'mci', name: 'water' },
  Washroom: { lib: 'mci', name: 'toilet' },
  Parking: { lib: 'ion', name: 'car-outline' },
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
  { key: 'parking', label: 'Parking', shortLabel: 'Parking', canonical: 'Parking', aliases: ['Parking'] },
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
