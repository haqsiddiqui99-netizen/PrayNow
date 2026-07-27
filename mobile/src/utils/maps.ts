import { Linking } from 'react-native'
import type { Mosque, TravelMode } from '@/src/types'

export async function openGoogleMaps(mosque: Mosque, mode: TravelMode = 'driving') {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}&travelmode=${mode}`
  await Linking.openURL(url)
}

export async function openGoogleMapsCitySearch(query: string) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  await Linking.openURL(url)
}

/**
 * Opens Google Maps showing nearby mosques as a multi-stop route / pins.
 * Uses origin = user location and waypoints for each mosque (Google caps ~9 waypoints).
 */
export async function openNearbyMosquesOnMap(
  mosques: Mosque[],
  userLat: number,
  userLng: number,
  mode: TravelMode = 'driving',
) {
  const withCoords = mosques.filter(
    (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && !(m.lat === 0 && m.lng === 0),
  )
  if (withCoords.length === 0) return

  if (withCoords.length === 1) {
    await openGoogleMaps(withCoords[0], mode)
    return
  }

  // Google Maps Directions API URL: origin + waypoints + destination
  const MAX_WAYPOINTS = 8
  const points = withCoords.slice(0, MAX_WAYPOINTS + 1)
  const destination = points[points.length - 1]
  const waypoints = points.slice(0, -1)

  const waypointParam =
    waypoints.length > 0
      ? `&waypoints=${waypoints.map((m) => `${m.lat},${m.lng}`).join('|')}`
      : ''

  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${userLat},${userLng}` +
    waypointParam +
    `&destination=${destination.lat},${destination.lng}` +
    `&travelmode=${mode}`

  await Linking.openURL(url)
}
