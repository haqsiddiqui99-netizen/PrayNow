import AsyncStorage from '@react-native-async-storage/async-storage'

export type SavedLocation = {
  id: string
  label: string
  city: string
  region: string
  country: string
  lat: number
  lng: number
  supportedCityId?: string
}

const STORAGE_KEY = 'praynow_saved_locations'
const MAX_SAVED = 8

function locationKey(loc: Pick<SavedLocation, 'city' | 'region' | 'lat' | 'lng'>) {
  return `${loc.city}|${loc.region}|${loc.lat.toFixed(4)}|${loc.lng.toFixed(4)}`
}

export async function loadSavedLocations(): Promise<SavedLocation[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as SavedLocation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function upsertSavedLocation(entry: SavedLocation): Promise<SavedLocation[]> {
  const existing = await loadSavedLocations()
  const key = locationKey(entry)
  const withoutDup = existing.filter((item) => locationKey(item) !== key)
  const next = [entry, ...withoutDup].slice(0, MAX_SAVED)
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function buildSavedLocation(input: {
  label: string
  city: string
  region: string
  country: string
  lat: number
  lng: number
  supportedCityId?: string
}): SavedLocation {
  return {
    id: locationKey(input),
    ...input,
  }
}
