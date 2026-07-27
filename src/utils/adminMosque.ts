import type { Mosque, MosqueTimings, PersonContact, PrayerName } from '../types'
import { DEFAULT_MOSQUE_TIMINGS, DEFAULT_NIGHT_TIMINGS } from '../data/mockData'

export const EMPTY_PERSON: PersonContact = { name: '', mobile: '', photo: '' }

export function emptyMosqueForm(): Partial<Mosque> {
  return {
    name: '',
    address: '',
    area: '',
    city: 'Kanpur',
    phone: '',
    lat: 26.4499,
    lng: 80.3319,
    sect: '',
    capacity: 500,
    imam: '',
    imamDetails: { ...EMPTY_PERSON },
    moazzinDetails: { ...EMPTY_PERSON },
    jumaTimings: {
      azan: '12:15 PM',
      khutba: '12:15 PM',
      namaz: '12:30 PM',
      sessions: [{ azan: '12:15 PM', khutba: '12:15 PM', namaz: '12:30 PM' }],
    },
    sermonLanguage: '',
    facilities: [],
    events: [],
    photos: [],
    timings: structuredClone(DEFAULT_MOSQUE_TIMINGS),
    nightTimings: structuredClone(DEFAULT_NIGHT_TIMINGS),
  }
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 600_000) {
      reject(new Error('Image must be under 600 KB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export function toggleFacility(facilities: string[], facility: string): string[] {
  return facilities.includes(facility)
    ? facilities.filter((f) => f !== facility)
    : [...facilities, facility]
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * Parse lat/lng from a Google Maps share URL or plain "lat, lng" text.
 */
export function parseMapsLocation(input: string): { lat: number; lng: number } | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  const patterns = [
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i,
    /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
  ]

  for (const re of patterns) {
    const m = raw.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }
  return null
}

export type PrayerTimingField = 'start' | 'azan' | 'jamat' | 'end'

export function updatePrayerTiming(
  timings: MosqueTimings,
  prayer: PrayerName,
  field: PrayerTimingField,
  value: string,
): MosqueTimings {
  return {
    ...timings,
    [prayer]: { ...timings[prayer], [field]: value },
  }
}
