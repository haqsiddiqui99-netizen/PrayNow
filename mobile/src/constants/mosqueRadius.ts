// Sentinel radius meaning "everywhere in the city" (no distance cap).
export const CITY_RADIUS_KM = 9999

export const MOSQUE_RADIUS_OPTIONS = [0.5, 1, 5, 20, CITY_RADIUS_KM] as const
export type MosqueRadiusKm = (typeof MOSQUE_RADIUS_OPTIONS)[number]

/** Ruler stops with display labels — equal visual intervals on the scale. */
export const MOSQUE_RADIUS_STOPS: { value: MosqueRadiusKm; label: string }[] = [
  { value: 0.5, label: '500 m' },
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 20, label: '20 km' },
  { value: CITY_RADIUS_KM, label: 'City' },
]

export const DEFAULT_MOSQUE_RADIUS_KM: MosqueRadiusKm = 5
export const HOME_NEARBY_PREVIEW_LIMIT = 5

/** Short readout for the currently selected radius. */
export function formatRadiusValue(radiusKm: number): string {
  if (radiusKm >= CITY_RADIUS_KM) return 'City'
  if (radiusKm < 1) return `${Math.round(radiusKm * 1000)} m`
  return `${radiusKm} km`
}

export function filterMosquesByRadius<T extends { distance: number }>(
  mosques: T[],
  radiusKm: number,
): T[] {
  return mosques.filter((m) => m.distance <= radiusKm)
}
