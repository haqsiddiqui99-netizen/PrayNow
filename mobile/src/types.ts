export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'

export type ArrivalStatus = 'early' | 'on-time' | 'late'

export type TravelMode = 'walking' | 'driving' | 'transit'

export interface MosquePrayerSlot {
  start: string
  azan: string
  jamat: string
  end: string
}

export interface PersonContact {
  name: string
  mobile: string
  photo: string
}

export interface JumaSession {
  azan: string
  khutba: string
  namaz: string
}

export interface JumaTimings {
  khutba: string
  namaz: string
  /** Optional shared / first-session azan (also stored on sessions[0].azan). */
  azan?: string
  /** Extra / all Juma sittings. If omitted, use khutba+namaz as the only session. */
  sessions?: JumaSession[]
}

export interface NightTimings {
  tahajjud: { start: string; end: string }
  sehri: { start: string; end: string }
}

export type MosqueTimings = Record<PrayerName, MosquePrayerSlot>

export interface Mosque {
  id: string
  name: string
  address: string
  area: string
  distance: number
  rating: number
  reviewCount: number
  phone: string
  travelMinutes: number
  arrivalStatus: ArrivalStatus
  arrivalMessage: string
  facilities: string[]
  imam: string
  imamDetails: PersonContact
  /** Multiple imams when provided by API; legacy single imam uses imamDetails. */
  imams?: PersonContact[]
  moazzinDetails: PersonContact
  /** Multiple mo'azzins when provided by API. */
  moazzins?: PersonContact[]
  jumaTimings: JumaTimings
  sermonLanguage: string
  events: string[]
  photos: string[]
  lat: number
  lng: number
  sect: string
  city: string
  capacity: number
  timings: MosqueTimings
  nightTimings: NightTimings
}
