/** Kaaba coordinates — Masjid al-Haram, Mecca */
export const KAABA_LAT = 21.422487
export const KAABA_LNG = 39.826206

const DEG = Math.PI / 180

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/** Great-circle initial bearing from user location to the Kaaba (0° = north, clockwise). */
export function calculateQiblaBearing(lat: number, lng: number): number {
  const phi1 = lat * DEG
  const phi2 = KAABA_LAT * DEG
  const deltaLambda = (KAABA_LNG - lng) * DEG

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  return normalizeAngle((Math.atan2(y, x) / DEG))
}

/** Haversine distance to the Kaaba in kilometres. */
export function distanceToKaaba(lat: number, lng: number): number {
  const R = 6371
  const dLat = (KAABA_LAT - lat) * DEG
  const dLng = (KAABA_LNG - lng) * DEG
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * DEG) * Math.cos(KAABA_LAT * DEG) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function formatBearingLabel(degrees: number): string {
  const normalized = normalizeAngle(degrees)
  const index = Math.round(normalized / 45) % 8
  return `${Math.round(normalized)}° ${CARDINALS[index]}`
}

/** Shortest signed turn from current heading to Qibla (-180 … +180). */
export function turnToQibla(heading: number, qiblaBearing: number): number {
  let diff = normalizeAngle(qiblaBearing - heading)
  if (diff > 180) diff -= 360
  return diff
}

export function formatTurnHint(turnDegrees: number): string {
  if (Math.abs(turnDegrees) <= 5) return 'You are facing the Qibla'
  if (turnDegrees > 0) return `Turn ${Math.round(turnDegrees)}° to your right`
  return `Turn ${Math.round(Math.abs(turnDegrees))}° to your left`
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${Math.round(km).toLocaleString()} km`
}

export function smoothHeading(previous: number, next: number, alpha = 0.25): number {
  let diff = next - previous
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return normalizeAngle(previous + alpha * diff)
}
