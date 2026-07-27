export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'

export type ArrivalStatus = 'early' | 'on-time' | 'late'

export interface PrayerTime {
  name: PrayerName
  start: string
  end: string
  /** @deprecated use start */
  time?: string
  completed?: boolean
}

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

export const MOSQUE_FACILITY_OPTIONS = [
  'Wudu Area',
  'Washroom',
  'Parking',
  'WiFi',
  'Wheelchair access',
  'Women section',
  'Library',
  'AC',
] as const

export interface TahajjudTimings {
  start: string
  end: string
}

export interface SehriTimings {
  start: string
  end: string
}

export interface NightTimings {
  tahajjud: TahajjudTimings
  sehri: SehriTimings
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
  moazzinDetails: PersonContact
  jumaTimings: JumaTimings
  sermonLanguage: string
  events: string[]
  photos: string[]
  reviews: Review[]
  city: string
  lat: number
  lng: number
  sect: string
  capacity: number
  timings: MosqueTimings
  nightTimings: NightTimings
}

export interface Review {
  author: string
  rating: number
  text: string
  date: string
}

export interface HalalRestaurant {
  id: string
  name: string
  cuisine: string
  distance: number
  rating: number
}

export interface Hadith {
  text: string
  source: string
}

export interface QuranVerse {
  arabic: string
  translation: string
  reference: string
}

export type Screen =
  | 'home'
  | 'mosques'
  | 'mosque-detail'
  | 'navigation'
  | 'chat'
  | 'live-azan'
  | 'qibla'
  | 'hadith'
  | 'tracker'
  | 'more'
  | 'calendar'
  | 'restaurants'
  | 'reviews'
  | 'login'
  | 'profile'
  | 'settings'
  | 'admin-login'
  | 'admin'
  | 'notifications'
