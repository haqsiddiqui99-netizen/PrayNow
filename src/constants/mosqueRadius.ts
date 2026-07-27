export const MOSQUE_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const
export type MosqueRadiusKm = (typeof MOSQUE_RADIUS_OPTIONS)[number]

export const DEFAULT_MOSQUE_RADIUS_KM: MosqueRadiusKm = 10
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
  if (count === 0) return `No mosques within ${radiusKm} km`
  if (count === 1) return `Found 1 mosque within ${radiusKm} km`
  return `Found ${count} mosques within ${radiusKm} km`
}
