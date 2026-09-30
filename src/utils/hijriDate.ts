/** Format today's Hijri (Islamic) date, e.g. "26 Safar 1448". Uses Umm al-Qura calendar. */
export function formatHijriDate(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      calendar: 'islamic-umalqura',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date)

    const day = parts.find((p) => p.type === 'day')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const year = parts.find((p) => p.type === 'year')?.value

    if (day && month && year) {
      return `${day} ${month} ${year}`
    }
  } catch {
    // Intl islamic calendar unavailable on this runtime
  }
  return ''
}
