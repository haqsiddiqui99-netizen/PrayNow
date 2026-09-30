import AsyncStorage from '@react-native-async-storage/async-storage'
import { resolveSupportedCity } from '@/src/constants/cities'
import { haversineKm } from '@/src/utils/geo'

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
const MAX_SAVED = 20
const NEARBY_KM = 2

function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveSupportedCityId(city: string, region: string, supportedCityId?: string): string | undefined {
  return supportedCityId ?? resolveSupportedCity(city, region)?.id
}

export function stableSavedLocationId(loc: {
  city: string
  country: string
  lat: number
  lng: number
  supportedCityId?: string
}): string {
  if (loc.supportedCityId) return `city:${loc.supportedCityId}`
  return `geo:${normalizePart(loc.city)}|${normalizePart(loc.country)}|${loc.lat.toFixed(3)}|${loc.lng.toFixed(3)}`
}

function enrichSavedLocation(entry: SavedLocation): SavedLocation {
  const supportedCityId = resolveSupportedCityId(entry.city, entry.region, entry.supportedCityId)
  const enriched = { ...entry, supportedCityId }
  return { ...enriched, id: stableSavedLocationId(enriched) }
}

export function isSameSavedLocation(a: SavedLocation, b: SavedLocation): boolean {
  const aId = resolveSupportedCityId(a.city, a.region, a.supportedCityId)
  const bId = resolveSupportedCityId(b.city, b.region, b.supportedCityId)

  if (aId && bId && aId === bId) return true

  if (
    normalizePart(a.city) === normalizePart(b.city) &&
    normalizePart(a.country) === normalizePart(b.country) &&
    haversineKm(a.lat, a.lng, b.lat, b.lng) < NEARBY_KM
  ) {
    return true
  }

  return (
    stableSavedLocationId({ ...a, supportedCityId: aId }) ===
    stableSavedLocationId({ ...b, supportedCityId: bId })
  )
}

function mergeSavedLocations(newer: SavedLocation, older: SavedLocation): SavedLocation {
  const supportedCityId = resolveSupportedCityId(
    newer.city,
    newer.region,
    newer.supportedCityId ?? older.supportedCityId,
  )
  const merged = { ...older, ...newer, supportedCityId }
  return { ...merged, id: stableSavedLocationId(merged) }
}

/** Newest-first list, one row per logical place. */
export function dedupeSavedLocations(items: SavedLocation[]): SavedLocation[] {
  const out: SavedLocation[] = []
  for (const raw of items) {
    const entry = enrichSavedLocation(raw)
    const idx = out.findIndex((existing) => isSameSavedLocation(existing, entry))
    if (idx >= 0) {
      out[idx] = mergeSavedLocations(out[idx], entry)
    } else {
      out.push(entry)
    }
  }
  return out.slice(0, MAX_SAVED)
}

export async function loadSavedLocations(): Promise<SavedLocation[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as SavedLocation[]
    if (!Array.isArray(parsed)) return []
    const deduped = dedupeSavedLocations(parsed)
    const changed =
      deduped.length !== parsed.length ||
      deduped.some((item, index) => item.id !== parsed[index]?.id)
    if (changed) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(deduped))
    }
    return deduped
  } catch {
    return []
  }
}

export async function upsertSavedLocation(entry: SavedLocation): Promise<SavedLocation[]> {
  const existing = await loadSavedLocations()
  const normalized = enrichSavedLocation(entry)
  const withoutDup = existing.filter((item) => !isSameSavedLocation(normalized, item))
  const next = dedupeSavedLocations([normalized, ...withoutDup])
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export async function removeSavedLocation(id: string): Promise<SavedLocation[]> {
  const existing = await loadSavedLocations()
  const next = existing.filter((item) => item.id !== id)
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
  const supportedCityId = resolveSupportedCityId(input.city, input.region, input.supportedCityId)
  const base = { ...input, supportedCityId }
  return {
    id: stableSavedLocationId(base),
    ...base,
  }
}
