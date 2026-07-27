/**
 * Build full-year Kanpur city_prayer_days CSV (Aladhan method 1 — Karachi/UoIS).
 * Usage: node scripts/build-kanpur-year-csv.mjs [year]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const year = Number(process.argv[2]) || 2026
const LAT = 26.4499
const LNG = 80.3319
const CITY = 'Kanpur'
const out = path.join(__dirname, `../data/kanpur-${year}.csv`)

function parse24(raw) {
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (!m) throw new Error(`bad time: ${raw}`)
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

async function fetchMonth(month) {
  const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${LAT}&longitude=${LNG}&method=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Aladhan ${year}/${month}: ${res.status}`)
  const json = await res.json()
  return json.data
}

const header = [
  'date',
  'city',
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
].join(',')

console.log(`Fetching Kanpur ${year} (12 months)…`)
const allDays = []
for (let month = 1; month <= 12; month += 1) {
  const days = await fetchMonth(month)
  allDays.push(...days)
  console.log(`  month ${month}: ${days.length} days`)
  // be gentle with the API
  await new Promise((r) => setTimeout(r, 200))
}

const rows = allDays.map((day, idx) => {
  const t = day.timings
  const fajr = parse24(t.Fajr)
  const sunrise = parse24(t.Sunrise)
  const dhuhr = parse24(t.Dhuhr)
  const asr = parse24(t.Asr)
  const maghrib = parse24(t.Maghrib)
  const isha = parse24(t.Isha)
  const nextFajr = idx + 1 < allDays.length ? parse24(allDays[idx + 1].timings.Fajr) : fajr

  const gd = day.date.gregorian
  const date = `${gd.year}-${String(gd.month.number).padStart(2, '0')}-${String(gd.day).padStart(2, '0')}`

  const zawalStart = addMinutes(dhuhr, -25)
  const zawalEnd = addMinutes(dhuhr, -5)
  const tahajjudEnd = addMinutes(fajr, -20)
  const sehriStart = addMinutes(fajr, -90)

  return [
    date,
    CITY,
    to12(fajr),
    to12(sunrise),
    to12(dhuhr),
    to12(asr),
    to12(asr),
    to12(maghrib),
    to12(maghrib),
    to12(addMinutes(maghrib, 5)),
    to12(isha),
    to12(nextFajr),
    to12(sunrise),
    to12(addMinutes(sunrise, -10)),
    to12(zawalStart),
    to12(zawalEnd),
    to12({ h: 0, min: 30 }),
    to12(tahajjudEnd),
    to12(sehriStart),
    to12(fajr),
  ].join(',')
})

fs.writeFileSync(out, [header, ...rows].join('\n') + '\n', 'utf8')
console.log(`Wrote ${out} (${rows.length} days)`)
console.log('First:', rows[0])
console.log('Last:', rows[rows.length - 1])
