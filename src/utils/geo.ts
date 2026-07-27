import type { Mosque } from '../types'

const DRIVE_SPEED_KMH = 28

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function applyUserDistances(mosques: Mosque[], userLat: number, userLng: number): Mosque[] {
  return mosques.map((mosque) => {
    const distance = Math.round(haversineKm(userLat, userLng, mosque.lat, mosque.lng) * 10) / 10
    const travelMinutes = Math.max(1, Math.round((distance / DRIVE_SPEED_KMH) * 60))
    return { ...mosque, distance, travelMinutes }
  })
}

export function formatLocationLabel(city: string, area: string, country: string): string {
  if (area && area !== city) return `${area}, ${city}`
  if (city) return `${city}, ${country}`
  return country
}
