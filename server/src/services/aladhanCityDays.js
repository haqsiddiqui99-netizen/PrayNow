/**
 * Fetch a year of city prayer windows from Aladhan and map into city_prayer_days rows.
 * Method 1 = University of Islamic Sciences, Karachi (common for South Asia).
 */
import https from 'node:https'
import { catalogEntry } from '../data/cityCatalog.js'
import { normalizeCityName, normalizeDayInput, upsertCityDays } from './cityPrayerDays.js'

const DEFAULT_METHOD = Number(process.env.ALADHAN_METHOD || 1)

function parse24(raw) {
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (!m) throw new Error(`bad Aladhan time: ${raw}`)
  return { h: Number(m[1]), min: Number(m[2]) }
}

function to12({ h, min }) {
  const period = h >= 12 ? 'PM' : 'AM'
  let hour = h % 12
  if (hour === 0) hour = 12
  return `${hour}:${String(min).padStart(2, '0')} ${period}`
}

function addMinutes(t, delta) {
  let total = t.h * 60 + t.min + delta
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return { h: Math.floor(total / 60), min: total % 60 }
}

async function fetchJson(url) {
  const insecure = process.env.ALADHAN_TLS_INSECURE === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
  if (!insecure) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`)
    return res.json()
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { rejectUnauthorized: false }, (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Aladhan HTTP ${res.statusCode}`))
            return
          }
          try {
            resolve(JSON.parse(body))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

async function fetchMonth(year, month, lat, lng, method) {
  const url =
    `https://api.aladhan.com/v1/calendar/${year}/${month}` +
    `?latitude=${lat}&longitude=${lng}&method=${method}`
  const json = await fetchJson(url)
  if (!Array.isArray(json?.data)) throw new Error(`Aladhan returned no data for ${year}/${month}`)
  return json.data
}

export function resolveCityCoords(cityName, settings) {
  const city = normalizeCityName(cityName)
  const meta = catalogEntry(city)
  const lat = Number(settings?.lat)
  const lng = Number(settings?.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && normalizeCityName(settings?.city || city) === city) {
    return { city, lat, lng, source: 'city_settings' }
  }
  if (meta?.lat != null && meta?.lng != null) {
    return { city: meta.name || city, lat: meta.lat, lng: meta.lng, source: 'catalog' }
  }
  throw new Error(
    `No coordinates for city "${city}". Set city lat/lng in City settings, or add it to the city catalog.`,
  )
}

/** Map Aladhan month payloads into normalized day objects. */
export function mapAladhanDaysToCityDays(aladhanDays, city) {
  const cityName = normalizeCityName(city)
  return aladhanDays.map((day, idx) => {
    const t = day.timings
    const fajr = parse24(t.Fajr)
    const sunrise = parse24(t.Sunrise)
    const dhuhr = parse24(t.Dhuhr)
    const asr = parse24(t.Asr)
    const maghrib = parse24(t.Maghrib)
    const isha = parse24(t.Isha)
    const nextFajr = idx + 1 < aladhanDays.length ? parse24(aladhanDays[idx + 1].timings.Fajr) : fajr

    const gd = day.date.gregorian
    const date = `${gd.year}-${String(gd.month.number).padStart(2, '0')}-${String(gd.day).padStart(2, '0')}`

    const zawalStart = addMinutes(dhuhr, -25)
    const zawalEnd = addMinutes(dhuhr, -5)
    const tahajjudEnd = addMinutes(fajr, -20)
    const sehriStart = addMinutes(fajr, -90)

    return normalizeDayInput(
      {
        city: cityName,
        date,
        fajr_start: to12(fajr),
        fajr_end: to12(sunrise),
        dhuhr_start: to12(dhuhr),
        dhuhr_end: to12(asr),
        asr_start: to12(asr),
        asr_end: to12(maghrib),
        maghrib_start: to12(maghrib),
        maghrib_end: to12(addMinutes(maghrib, 5)),
        isha_start: to12(isha),
        isha_end: to12(nextFajr),
        sunrise: to12(sunrise),
        fajr_namaz_end: to12(addMinutes(sunrise, -10)),
        zawal_start: to12(zawalStart),
        zawal_end: to12(zawalEnd),
        tahajjud_start: to12({ h: 0, min: 30 }),
        tahajjud_end: to12(tahajjudEnd),
        sehri_start: to12(sehriStart),
        sehri_end: to12(fajr),
      },
      cityName,
    )
  })
}

/** Fetch all months for a year from Aladhan. */
export async function fetchAladhanYearDays({ city, year, lat, lng, method = DEFAULT_METHOD }) {
  const allDays = []
  for (let month = 1; month <= 12; month += 1) {
    const days = await fetchMonth(year, month, lat, lng, method)
    allDays.push(...days)
    // Be gentle with the public API
    await new Promise((r) => setTimeout(r, 150))
  }
  return mapAladhanDaysToCityDays(allDays, city)
}

/**
 * Pull Aladhan calendar for a city and upsert into city_prayer_days.
 * Defaults to Delhi when city is omitted.
 */
export async function generateYearFromAladhan(client, year, cityOverride) {
  const { rows: settingsRows } = await client.query(`SELECT * FROM city_settings WHERE id = 1`)
  const settings = settingsRows[0] || {}
  const requested = normalizeCityName(cityOverride || settings.city || 'Delhi')
  const coords = resolveCityCoords(requested, {
    city: settings.city,
    lat: settings.lat,
    lng: settings.lng,
  })

  // Prefer catalog coords for known cities so "Delhi" always hits Delhi pins
  // even if settings still point at another city.
  const meta = catalogEntry(requested)
  const lat = meta?.lat ?? coords.lat
  const lng = meta?.lng ?? coords.lng
  const city = meta?.name || coords.city

  const days = await fetchAladhanYearDays({
    city,
    year,
    lat,
    lng,
    method: DEFAULT_METHOD,
  })
  const upserted = await upsertCityDays(client, days)
  return {
    city,
    year,
    upserted,
    source: 'aladhan',
    method: DEFAULT_METHOD,
    lat,
    lng,
  }
}
