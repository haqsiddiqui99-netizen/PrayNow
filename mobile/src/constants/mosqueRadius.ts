// Sentinel radius meaning "everywhere in the city" (no distance cap).
export const CITY_RADIUS_KM = 9999

export const MOSQUE_RADIUS_OPTIONS = [0, 0.5, 1, 3, 5, 10, CITY_RADIUS_KM] as const
export type MosqueRadiusKm = (typeof MOSQUE_RADIUS_OPTIONS)[number]

/** Ruler stops with display labels — equal visual intervals on the scale. */
export const MOSQUE_RADIUS_STOPS: { value: MosqueRadiusKm; label: string }[] = [
  { value: 0, label: '0' },
  { value: 0.5, label: '500 Meter' },
  { value: 1, label: '1 km' },
  { value: 3, label: '3 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: CITY_RADIUS_KM, label: 'Within City' },
]

export const DEFAULT_MOSQUE_RADIUS_KM: MosqueRadiusKm = 10
export const HOME_NEARBY_PREVIEW_LIMIT = 5

/** Short readout for the currently selected radius. */
export function formatRadiusValue(radiusKm: number): string {
  if (radiusKm >= CITY_RADIUS_KM) return 'Within City'
  if (radiusKm <= 0) return '0'
  if (radiusKm < 1) return `${Math.round(radiusKm * 1000)} Meter`
  return `${radiusKm} km`
}

export function filterMosquesByRadius<T extends { distance: number }>(
  mosques: T[],
  radiusKm: number,
): T[] {
  return mosques.filter((m) => m.distance <= radiusKm)
}

export function formatNearbyMosqueHeading(options: {
  count: number
  radiusKm: number
  loading: boolean
  citySupported: boolean
  locLoading: boolean
}): string {
  const { count, radiusKm, loading, citySupported, locLoading } = options
  const scope =
    radiusKm >= CITY_RADIUS_KM
      ? 'in your city'
      : radiusKm <= 0
        ? 'at your location'
        : radiusKm < 1
          ? `within ${Math.round(radiusKm * 1000)} m`
          : `within ${radiusKm} km`
  if (loading) return 'Finding mosques nearby…'
  if (!citySupported && !locLoading) return 'No mosques in your area'
  if (count === 0) return `No mosques ${scope}`
  if (count === 1) return `Found 1 mosque ${scope}`
  return `Found ${count} mosques ${scope}`
}
