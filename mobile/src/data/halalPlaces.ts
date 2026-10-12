export type HalalPlace = {
  id: string
  name: string
  cuisine: string
  area: string
  city: string
  lat: number
  lng: number
  /** What the kitchen is known for, in a few words. */
  knownFor: string
}

/**
 * Well-known Delhi kitchens that serve halal food. Coordinates are approximate;
 * directions open the real place in Google Maps. No ratings are invented here.
 * A paid "featured" placement can sit above this list later.
 */
export const HALAL_PLACES: HalalPlace[] = [
  { id: 'karims', name: "Karim's", cuisine: 'Mughlai', area: 'Jama Masjid', city: 'Delhi', lat: 28.6506, lng: 77.2334, knownFor: 'Mutton korma, seekh' },
  { id: 'aljawahar', name: 'Al-Jawahar', cuisine: 'Mughlai', area: 'Jama Masjid', city: 'Delhi', lat: 28.6503, lng: 77.2337, knownFor: 'Nahari, biryani' },
  { id: 'aslam', name: 'Aslam Chicken', cuisine: 'Mughlai', area: 'Jama Masjid', city: 'Delhi', lat: 28.6499, lng: 77.2326, knownFor: 'Butter chicken' },
  { id: 'kake', name: 'Kake Da Hotel', cuisine: 'Mughlai', area: 'Connaught Place', city: 'Delhi', lat: 28.6318, lng: 77.2166, knownFor: 'Butter chicken, daal' },
  { id: 'nizams', name: "Nizam's Kathi Kabab", cuisine: 'Rolls', area: 'Connaught Place', city: 'Delhi', lat: 28.6325, lng: 77.2178, knownFor: 'Mutton kathi roll' },
  { id: 'albake', name: 'Al Bake', cuisine: 'Rolls', area: 'Connaught Place', city: 'Delhi', lat: 28.6312, lng: 77.2194, knownFor: 'Shawarma' },
  { id: 'khan-chacha', name: 'Khan Chacha', cuisine: 'Kebabs', area: 'Khan Market', city: 'Delhi', lat: 28.6003, lng: 77.227, knownFor: 'Kebabs, rolls' },
  { id: 'alkauser', name: 'Alkauser', cuisine: 'Kebabs', area: 'Sunder Nagar', city: 'Delhi', lat: 28.6022, lng: 77.2415, knownFor: 'Galouti, kakori' },
  { id: 'moti', name: 'Moti Mahal', cuisine: 'Mughlai', area: 'Daryaganj', city: 'Delhi', lat: 28.6421, lng: 77.2406, knownFor: 'Tandoori, dal makhani' },
  { id: 'qureshi', name: 'Qureshi Kabab', cuisine: 'Kebabs', area: 'Nizamuddin', city: 'Delhi', lat: 28.5917, lng: 77.2419, knownFor: 'Seekh, shammi' },
  { id: 'gulati', name: 'Gulati', cuisine: 'Mughlai', area: 'Pandara Road', city: 'Delhi', lat: 28.6076, lng: 77.2302, knownFor: 'Butter chicken' },
  { id: 'dastarkhwan', name: 'Dastarkhwan', cuisine: 'Mughlai', area: 'Connaught Place', city: 'Delhi', lat: 28.6304, lng: 77.2169, knownFor: 'Lucknowi dum biryani' },
]

export const HALAL_CUISINES = ['All', 'Mughlai', 'Kebabs', 'Rolls'] as const

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const rad = Math.PI / 180
  const dLat = (toLat - fromLat) * rad
  const dLng = (toLng - fromLng) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat * rad) * Math.cos(toLat * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return ''
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}
