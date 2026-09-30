export const CITY_RADIUS_KM = 9999

export const MOSQUE_RADIUS_OPTIONS = [0.5, 1, 5, 20, CITY_RADIUS_KM] as const
export type MosqueRadiusKm = (typeof MOSQUE_RADIUS_OPTIONS)[number]

export const DEFAULT_MOSQUE_RADIUS_KM: MosqueRadiusKm = 5
export const HOME_NEARBY_PREVIEW_LIMIT = 5

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
}): string {
  const { count, radiusKm, loading } = options
  if (loading) return 'Finding mosques nearby…'
  if (radiusKm >= CITY_RADIUS_KM) {
    if (count === 0) return 'No mosques in your city'
    if (count === 1) return 'Found 1 mosque in your city'
    return `Found ${count} mosques in your city`
  }
  const scope = radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`
  if (count === 0) return `No mosques within ${scope}`
  if (count === 1) return `Found 1 mosque within ${scope}`
  return `Found ${count} mosques within ${scope}`
}
