import { toHijri } from 'hijri-converter'

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
]

function formatHijriViaIntl(date: Date): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'islamic-umalqura',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    if (typeof formatter.formatToParts !== 'function') return null

    const parts = formatter.formatToParts(date)
    const day = parts.find((p) => p.type === 'day')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const year = parts.find((p) => p.type === 'year')?.value

    if (day && month && year) {
      return `${day} ${month} ${year}`
    }
  } catch {
    // Intl islamic calendar unavailable on this runtime (e.g. Hermes on mobile)
  }
  return null
}

function formatHijriViaConverter(date: Date): string {
  const { hy, hm, hd } = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const month = HIJRI_MONTHS[hm - 1]
  if (!month) return ''
  return `${hd} ${month} ${hy}`
}

/** Format today's Hijri (Islamic) date, e.g. "26 Safar 1448". Uses Umm al-Qura calendar. */
export function formatHijriDate(date: Date): string {
  return formatHijriViaIntl(date) ?? formatHijriViaConverter(date)
}
