import type { Mosque, MosqueTimings } from '@/src/types'

export const LOCATION = { city: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209 }

export const PRAYER_SCHEDULE = [
  { name: 'Fajr' as const, start: '4:55 AM', end: '5:40 AM' },
  { name: 'Dhuhr' as const, start: '12:15 PM', end: '3:30 PM' },
  { name: 'Asr' as const, start: '3:30 PM', end: '6:45 PM' },
  { name: 'Maghrib' as const, start: '6:45 PM', end: '8:00 PM' },
  { name: 'Isha' as const, start: '8:00 PM', end: '4:55 AM' },
]

export const SUNRISE = '5:45 AM'
export const FAJR_NAMAZ_END = '5:40 AM'
export const TULU_AFTAB = { start: FAJR_NAMAZ_END, end: SUNRISE, label: 'Tulu Aftab' }
export const ZAWAL = { start: '11:20 AM', end: '11:55 AM', label: 'Zawal' }

export const DEFAULT_MOSQUE_TIMINGS: MosqueTimings = {
  Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:10 AM', end: '5:40 AM' },
  Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:30 PM', end: '3:30 PM' },
  Asr: { start: '3:30 PM', azan: '3:30 PM', jamat: '3:45 PM', end: '6:45 PM' },
  Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:50 PM', end: '8:00 PM' },
  Isha: { start: '8:00 PM', azan: '8:00 PM', jamat: '8:15 PM', end: '4:55 AM' },
}

export const DEFAULT_NIGHT_TIMINGS = {
  tahajjud: { start: '12:30 AM', end: '4:40 AM' },
  sehri: { start: '3:10 AM', end: '4:50 AM' },
}

const base = (
  id: string,
  name: string,
  address: string,
  area: string,
  distance: number,
  lat: number,
  lng: number,
  timings: MosqueTimings = DEFAULT_MOSQUE_TIMINGS,
  extra: Partial<Mosque> = {},
): Mosque => ({
  id,
  name,
  address,
  area,
  distance,
  rating: 4.6,
  reviewCount: 500,
  phone: '+91 11 0000 0000',
  travelMinutes: Math.max(1, Math.round((distance / 28) * 60)),
  arrivalStatus: 'early',
  arrivalMessage: "You'll arrive early",
  facilities: ['Wudu Area', 'Parking'],
  imam: 'Sheikh',
  imamDetails: { name: 'Sheikh', mobile: '', photo: '' },
  moazzinDetails: { name: '', mobile: '', photo: '' },
  jumaTimings: { khutba: '12:15 PM', namaz: '12:30 PM' },
  sermonLanguage: 'Urdu',
  events: ['Friday Khutbah 12:30 PM'],
  photos: ['🕌'],
  lat,
  lng,
  sect: 'Sunni',
  city: 'Delhi',
  capacity: 2000,
  timings,
  nightTimings: { ...DEFAULT_NIGHT_TIMINGS },
  ...extra,
})

const t = (overrides: Partial<MosqueTimings>): MosqueTimings => ({
  ...DEFAULT_MOSQUE_TIMINGS,
  ...overrides,
})

export const MOCK_MOSQUES: Mosque[] = [
  base('1', 'Jama Masjid', 'Jama Masjid Rd, Chandni Chowk, Delhi 110006', 'Old Delhi', 2.3, 28.6507, 77.2332,
    t({ Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:00 PM', jamat: '8:15 PM' } }),
    { phone: '+91 11 2336 5358', imam: 'Sheikh Ahmed Bukhari', capacity: 25000, rating: 4.8 }),
  base('2', 'Fatehpuri Masjid', 'Fatehpuri, Chandni Chowk, Delhi 110006', 'Chandni Chowk', 3.1, 28.6568, 77.2295,
    t({ Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:02 PM', jamat: '8:18 PM' } }),
    { phone: '+91 11 2396 2345', imam: 'Sheikh Mahmoud Hassan', sect: 'Shia', rating: 4.6 }),
  base('3', 'Jama Masjid Kashmere Gate', 'Lothian Rd, Kashmere Gate, Delhi 110006', 'Kashmere Gate', 4.5, 28.6672, 77.229,
    t({ Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '7:58 PM', jamat: '8:12 PM' } }),
    { phone: '+91 11 2391 5678', imam: 'Sheikh Khalid Ansari', rating: 4.9 }),
  base('4', 'Hazrat Nizamuddin Dargah Masjid', 'Nizamuddin West, Delhi 110013', 'Nizamuddin', 2.8, 28.5911, 77.2418,
    t({ Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:00 PM', jamat: '8:10 PM' } }),
    { phone: '+91 11 2435 9012', imam: 'Sheikh Yusuf Ibrahim', sect: 'Ahle Hadees', rating: 4.7 }),
  base('5', 'Masjid Moth', 'South Extension II, Delhi 110049', 'South Delhi', 5.2, 28.5562, 77.2100,
    t({ Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:01 PM', jamat: '8:16 PM' } }),
    { phone: '+91 11 2621 3456', imam: 'Sheikh Abdullah Nour', capacity: 800, rating: 4.5 }),
  base('6', 'Sunehri Masjid', 'Netaji Subhash Marg, Chandni Chowk, Delhi 110006', 'Chandni Chowk', 2.9, 28.6560, 77.2312,
    t({
      Fajr: { start: '4:53 AM', azan: '4:53 AM', jamat: '5:08 AM', end: '5:40 AM' },
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:35 PM', end: '3:30 PM' },
      Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:03 PM', jamat: '8:17 PM' },
    }),
    { phone: '+91 11 2327 4521', imam: 'Sheikh Raza Ali', capacity: 1200, rating: 4.4 }),
  base('7', 'Zinat-ul-Masjid', 'Sita Ram Bazar, Daryaganj, Delhi 110002', 'Daryaganj', 3.6, 28.6408, 77.2384,
    t({
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:28 PM', end: '3:30 PM' },
      Asr: { start: '3:30 PM', azan: '3:32 PM', jamat: '3:48 PM', end: '6:45 PM' },
      Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '7:59 PM', jamat: '8:14 PM' },
    }),
    { phone: '+91 11 2327 8890', imam: 'Sheikh Iqbal Hussain', capacity: 1800, rating: 4.5 }),
  base('8', 'Khairul Manazil Masjid', 'Mathura Road, Near Purana Qila, Delhi 110003', 'Pragati Maidan', 4.1, 28.6098, 77.2442,
    t({
      Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:52 PM', end: '8:00 PM' },
      Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:04 PM', jamat: '8:20 PM' },
    }),
    { phone: '+91 11 2331 2244', imam: 'Sheikh Hamid Akhtar', capacity: 900, rating: 4.3 }),
  base('9', 'Shia Jama Masjid', 'Esplanade Road, Kashmere Gate, Delhi 110006', 'Kashmere Gate', 4.8, 28.6612, 77.2278,
    t({
      Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:12 AM', end: '5:40 AM' },
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:40 PM', end: '3:30 PM' },
      Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:01 PM', jamat: '8:19 PM' },
    }),
    { phone: '+91 11 2391 7788', imam: 'Maulana Syed Abbas', sect: 'Shia', capacity: 3500, rating: 4.6 }),
  base('10', 'Banglewali Masjid', 'Banglewali Masjid Rd, Nizamuddin West, Delhi 110013', 'Nizamuddin', 3.0, 28.5918, 77.2425,
    t({
      Asr: { start: '3:30 PM', azan: '3:31 PM', jamat: '3:50 PM', end: '6:45 PM' },
      Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:48 PM', end: '8:00 PM' },
      Isha: { ...DEFAULT_MOSQUE_TIMINGS.Isha, azan: '8:02 PM', jamat: '8:12 PM' },
    }),
    { phone: '+91 11 2435 6677', imam: 'Sheikh Abdul Wahab', capacity: 2200, rating: 4.7 }),
]

export const ISLAMIC_CALENDAR = {
  hijriDate: '14 Muharram 1448',
  gregorianDate: 'Friday, July 17, 2026',
}

export const DAILY_HADITH = {
  text: 'The most beloved of deeds to Allah are those that are most consistent, even if they are small.',
  source: 'Sahih Bukhari 6464',
}

export const HADITH_COLLECTION = [
  DAILY_HADITH,
  {
    text: 'None of you truly believes until he loves for his brother what he loves for himself.',
    source: 'Sahih Bukhari 13',
  },
  {
    text: 'The strong person is not the one who can wrestle, but the one who controls himself when angry.',
    source: 'Sahih Bukhari 6114',
  },
]

export const DAILY_VERSE = {
  arabic: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِينَ كِتَابًا مَّوْقُوتًا',
  translation: 'Indeed, prayer has been decreed upon the believers a decree of specified times.',
  reference: 'Quran 4:103',
}
