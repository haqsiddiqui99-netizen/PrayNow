import { randomUUID } from 'node:crypto'

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const DAY_COLUMNS = [
  'fajr_start',
  'fajr_end',
  'dhuhr_start',
  'dhuhr_end',
  'asr_start',
  'asr_end',
  'maghrib_start',
  'maghrib_end',
  'isha_start',
  'isha_end',
  'sunrise',
  'fajr_namaz_end',
  'zawal_start',
  'zawal_end',
  'tahajjud_start',
  'tahajjud_end',
  'sehri_start',
  'sehri_end',
]

export function formatDateYmd(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeCityName(city) {
  return String(city || 'Delhi').trim() || 'Delhi'
}

function prayerKey(name, which) {
  return `${name.toLowerCase()}_${which}`
}

/** Map a DB day row into schedule-style objects used by the app. */
export function dayRowToScheduleAndExtras(row) {
  if (!row) return null
  const schedule = PRAYERS.map((name) => ({
    prayer_name: name,
    start_time: row[prayerKey(name, 'start')] || '',
    end_time: row[prayerKey(name, 'end')] || '',
  }))
  return {
    date: row.prayer_date instanceof Date ? formatDateYmd(row.prayer_date) : String(row.prayer_date).slice(0, 10),
    city: row.city,
    schedule,
    sunrise: row.sunrise,
    fajr_namaz_end: row.fajr_namaz_end,
    zawal_start: row.zawal_start,
    zawal_end: row.zawal_end,
    nightTimings: {
      tahajjud: { start: row.tahajjud_start, end: row.tahajjud_end },
      sehri: { start: row.sehri_start, end: row.sehri_end },
    },
  }
}

export function normalizeDayInput(raw, fallbackCity, defaults = {}) {
  const city = normalizeCityName(raw.city || fallbackCity)
  const date =
    String(raw.date || raw.prayer_date || '')
      .trim()
      .slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date: ${raw.date || raw.prayer_date || '(missing)'}`)
  }

  const get = (snake, alt) => {
    const v = raw[snake] ?? raw[alt]
    if (v != null && String(v).trim()) return String(v).trim()
    return defaults[snake] || ''
  }

  return {
    city,
    prayer_date: date,
    fajr_start: get('fajr_start', 'fajrStart') || defaults.fajr_start || '4:55 AM',
    fajr_end: get('fajr_end', 'fajrEnd') || defaults.fajr_end || '5:40 AM',
    dhuhr_start: get('dhuhr_start', 'dhuhrStart') || defaults.dhuhr_start || '12:15 PM',
    dhuhr_end: get('dhuhr_end', 'dhuhrEnd') || defaults.dhuhr_end || '3:30 PM',
    asr_start: get('asr_start', 'asrStart') || defaults.asr_start || '3:30 PM',
    asr_end: get('asr_end', 'asrEnd') || defaults.asr_end || '6:45 PM',
    maghrib_start: get('maghrib_start', 'maghribStart') || defaults.maghrib_start || '6:45 PM',
    maghrib_end: get('maghrib_end', 'maghribEnd') || defaults.maghrib_end || '8:00 PM',
    isha_start: get('isha_start', 'ishaStart') || defaults.isha_start || '8:00 PM',
    isha_end: get('isha_end', 'ishaEnd') || defaults.isha_end || '4:55 AM',
    sunrise: get('sunrise') || defaults.sunrise || '5:45 AM',
    fajr_namaz_end: get('fajr_namaz_end', 'fajrNamazEnd') || defaults.fajr_namaz_end || '5:40 AM',
    zawal_start: get('zawal_start', 'zawalStart') || defaults.zawal_start || '11:20 AM',
    zawal_end: get('zawal_end', 'zawalEnd') || defaults.zawal_end || '11:55 AM',
    tahajjud_start: get('tahajjud_start', 'tahajjudStart') || defaults.tahajjud_start || '12:30 AM',
    tahajjud_end: get('tahajjud_end', 'tahajjudEnd') || defaults.tahajjud_end || '4:40 AM',
    sehri_start: get('sehri_start', 'sehriStart') || defaults.sehri_start || '3:10 AM',
    sehri_end: get('sehri_end', 'sehriEnd') || defaults.sehri_end || '4:50 AM',
  }
}

export async function getCityDay(client, city, dateYmd) {
  const { rows } = await client.query(
    `SELECT * FROM city_prayer_days WHERE city = $1 AND prayer_date = $2::date LIMIT 1`,
    [normalizeCityName(city), dateYmd],
  )
  return rows[0] || null
}

export async function countCityDays(client, city, year) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM city_prayer_days
     WHERE city = $1
       AND EXTRACT(YEAR FROM prayer_date) = $2`,
    [normalizeCityName(city), year],
  )
  return rows[0]?.count ?? 0
}

export async function listCityDays(client, city, fromYmd, toYmd) {
  const { rows } = await client.query(
    `SELECT * FROM city_prayer_days
     WHERE city = $1
       AND prayer_date >= $2::date
       AND prayer_date <= $3::date
     ORDER BY prayer_date`,
    [normalizeCityName(city), fromYmd, toYmd],
  )
  return rows
}

export async function upsertCityDays(client, days) {
  let upserted = 0
  for (const day of days) {
    await client.query(
      `INSERT INTO city_prayer_days (
         id, city, prayer_date,
         fajr_start, fajr_end, dhuhr_start, dhuhr_end, asr_start, asr_end,
         maghrib_start, maghrib_end, isha_start, isha_end,
         sunrise, fajr_namaz_end, zawal_start, zawal_end,
         tahajjud_start, tahajjud_end, sehri_start, sehri_end, updated_at
       ) VALUES (
         $1,$2,$3::date,
         $4,$5,$6,$7,$8,$9,
         $10,$11,$12,$13,
         $14,$15,$16,$17,
         $18,$19,$20,$21, NOW()
       )
       ON CONFLICT (city, prayer_date) DO UPDATE SET
         fajr_start = EXCLUDED.fajr_start,
         fajr_end = EXCLUDED.fajr_end,
         dhuhr_start = EXCLUDED.dhuhr_start,
         dhuhr_end = EXCLUDED.dhuhr_end,
         asr_start = EXCLUDED.asr_start,
         asr_end = EXCLUDED.asr_end,
         maghrib_start = EXCLUDED.maghrib_start,
         maghrib_end = EXCLUDED.maghrib_end,
         isha_start = EXCLUDED.isha_start,
         isha_end = EXCLUDED.isha_end,
         sunrise = EXCLUDED.sunrise,
         fajr_namaz_end = EXCLUDED.fajr_namaz_end,
         zawal_start = EXCLUDED.zawal_start,
         zawal_end = EXCLUDED.zawal_end,
         tahajjud_start = EXCLUDED.tahajjud_start,
         tahajjud_end = EXCLUDED.tahajjud_end,
         sehri_start = EXCLUDED.sehri_start,
         sehri_end = EXCLUDED.sehri_end,
         updated_at = NOW()`,
      [
        randomUUID(),
        day.city,
        day.prayer_date,
        day.fajr_start,
        day.fajr_end,
        day.dhuhr_start,
        day.dhuhr_end,
        day.asr_start,
        day.asr_end,
        day.maghrib_start,
        day.maghrib_end,
        day.isha_start,
        day.isha_end,
        day.sunrise,
        day.fajr_namaz_end,
        day.zawal_start,
        day.zawal_end,
        day.tahajjud_start,
        day.tahajjud_end,
        day.sehri_start,
        day.sehri_end,
      ],
    )
    upserted += 1
  }
  return upserted
}

export async function loadCityDefaults(client) {
  const { rows: settingsRows } = await client.query(`SELECT * FROM city_settings WHERE id = 1`)
  const settings = settingsRows[0] || {}
  const { rows: schedule } = await client.query(`SELECT * FROM city_prayer_schedule ORDER BY prayer_name`)
  const byName = Object.fromEntries(schedule.map((r) => [r.prayer_name, r]))

  return {
    city: normalizeCityName(settings.city),
    fajr_start: byName.Fajr?.start_time || '4:55 AM',
    fajr_end: byName.Fajr?.end_time || settings.fajr_namaz_end || '5:40 AM',
    dhuhr_start: byName.Dhuhr?.start_time || '12:15 PM',
    dhuhr_end: byName.Dhuhr?.end_time || '3:30 PM',
    asr_start: byName.Asr?.start_time || '3:30 PM',
    asr_end: byName.Asr?.end_time || '6:45 PM',
    maghrib_start: byName.Maghrib?.start_time || '6:45 PM',
    maghrib_end: byName.Maghrib?.end_time || '8:00 PM',
    isha_start: byName.Isha?.start_time || '8:00 PM',
    isha_end: byName.Isha?.end_time || '4:55 AM',
    sunrise: settings.sunrise || '5:45 AM',
    fajr_namaz_end: settings.fajr_namaz_end || '5:40 AM',
    zawal_start: settings.zawal_start || '11:20 AM',
    zawal_end: settings.zawal_end || '11:55 AM',
    tahajjud_start: settings.tahajjud_start || '12:30 AM',
    tahajjud_end: settings.tahajjud_end || '4:40 AM',
    sehri_start: settings.sehri_start || '3:10 AM',
    sehri_end: settings.sehri_end || '4:50 AM',
  }
}

/** Fill every day of `year` from current city defaults (starter year; replace via import). */
export async function generateYearFromDefaults(client, year, cityOverride) {
  const defaults = await loadCityDefaults(client)
  const city = normalizeCityName(cityOverride || defaults.city)
  const days = []
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const total = leap ? 366 : 365
  for (let i = 0; i < total; i += 1) {
    const d = new Date(year, 0, 1 + i)
    days.push(normalizeDayInput({ city, date: formatDateYmd(d) }, city, defaults))
  }
  const upserted = await upsertCityDays(client, days)
  return { city, year, upserted }
}

/** Parse CSV text into day objects. Header row required. */
export function parseCityDaysCsv(csvText, fallbackCity) {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const days = []
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i])
    const raw = {}
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? ''
    })
    if (raw.date && !raw.prayer_date) raw.prayer_date = raw.date
    days.push(normalizeDayInput(raw, fallbackCity))
  }
  return days
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function csvTemplateHeader() {
  return ['date', 'city', ...DAY_COLUMNS].join(',')
}
