import { Linking, Platform, Share } from 'react-native'
import type { useLanguage } from '@/src/context/LanguageContext'
import type { MosqueEvent, MosqueJanaza } from '@/src/services/api'
import type { Mosque, PrayerName } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export type ShareLang = Pick<ReturnType<typeof useLanguage>, 't' | 'prayerName' | 'placeName' | 'formatClock' | 'digits'>

/** Opens WhatsApp with the message ready; falls back to the phone's share sheet. */
export async function shareToWhatsApp(message: string): Promise<void> {
  const text = encodeURIComponent(message)
  if (Platform.OS === 'web') {
    await Linking.openURL(`https://wa.me/?text=${text}`)
    return
  }
  try {
    await Linking.openURL(`whatsapp://send?text=${text}`)
  } catch {
    await Share.share({ message })
  }
}

function mapLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
}

export function todayTimesMessage(
  lang: ShareLang,
  city: string,
  schedule: ReadonlyArray<{ name: PrayerName; start: string }>,
  hijri: string,
): string {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const lines = schedule.map((p) => `${lang.prayerName(p.name)}: ${lang.formatClock(p.start)}`)
  return [
    lang.t('share.todayTitle', { city: lang.placeName(city) }),
    lang.digits(`${date} · ${hijri}`),
    '',
    ...lines,
    '',
    lang.t('share.footer'),
  ].join('\n')
}

export function mosqueMessage(lang: ShareLang, mosque: Mosque): string {
  const lines: string[] = [lang.placeName(mosque.name)]
  const place = [mosque.area, mosque.city].filter(Boolean).map((part) => lang.placeName(part)).join(', ')
  if (place) lines.push(place)
  const jamaat = PRAYERS.flatMap((p) => {
    const time = mosque.timings?.[p]?.jamat
    return time ? [`${lang.prayerName(p)}: ${lang.formatClock(time)}`] : []
  })
  if (jamaat.length) lines.push('', lang.t('share.jamaatToday'), ...jamaat)
  const juma = getJumaSessions(mosque.jumaTimings, mosque.timings?.Dhuhr?.azan || '').filter((s) => s.namaz)
  if (juma.length) lines.push(`${lang.prayerName('juma')}: ${juma.map((s) => lang.formatClock(s.namaz)).join(' · ')}`)
  if (Number.isFinite(mosque.lat) && Number.isFinite(mosque.lng) && (mosque.lat || mosque.lng)) {
    lines.push('', `${lang.t('share.map')}: ${mapLink(mosque.lat, mosque.lng)}`)
  }
  if (mosque.phone) lines.push(`${lang.t('share.phone')}: ${mosque.phone}`)
  lines.push('', lang.t('share.footer'))
  return lines.join('\n')
}

export function janazaMessage(
  lang: ShareLang,
  janaza: MosqueJanaza,
  when: string,
  mosque?: Pick<Mosque, 'lat' | 'lng'> | null,
): string {
  const lines = [lang.t('janaza.shareTitle')]
  if (janaza.deceasedName) lines.push(janaza.deceasedName)
  lines.push(
    '',
    janaza.afterPrayer ? lang.t('janaza.afterAt', { prayer: lang.prayerName(janaza.afterPrayer), when }) : when,
    lang.t('share.at', { mosque: lang.placeName(janaza.mosqueName) }),
  )
  if (janaza.burial) lines.push(lang.t('janaza.burialAt', { place: janaza.burial }))
  if (janaza.note) lines.push('', janaza.note)
  if (mosque && (mosque.lat || mosque.lng)) lines.push('', `${lang.t('share.map')}: ${mapLink(mosque.lat, mosque.lng)}`)
  lines.push('', lang.t('janaza.shareDua'), lang.t('share.footer'))
  return lines.join('\n')
}

/** `when` is the next session as the app already shows it, e.g. "Fri 14 Mar · 7:30 PM". */
export function eventMessage(
  lang: ShareLang,
  event: MosqueEvent,
  when: string,
  mosque?: Pick<Mosque, 'name' | 'lat' | 'lng'> | null,
): string {
  const lines = [event.title, event.weekly ? lang.t('share.weeklyFrom', { when }) : when]
  if (mosque?.name) lines.push(lang.t('share.at', { mosque: lang.placeName(mosque.name) }))
  if (event.details) lines.push('', event.details)
  if (mosque && (mosque.lat || mosque.lng)) lines.push('', `${lang.t('share.map')}: ${mapLink(mosque.lat, mosque.lng)}`)
  lines.push('', lang.t('share.footer'))
  return lines.join('\n')
}
