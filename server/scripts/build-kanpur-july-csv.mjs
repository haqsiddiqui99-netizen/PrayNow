/**
 * Build Kanpur July 2026 city_prayer_days CSV from Aladhan calendar
 * (matches user's downloaded July table for Kanpur within ~1 minute).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-qamrulhs-PrayNow/agent-tools/95fa4552-6bd3-4121-9b7e-8bdc4865f132.txt',
)
const out = path.join(__dirname, '../data/kanpur-2026-07.csv')

function parse24(raw) {
  // "03:49 (IST)" or "15:39 (IST)"
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

const json = JSON.parse(fs.readFileSync(src, 'utf8'))
const days = json.data
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

const rows = days.map((day, idx) => {
  const t = day.timings
  const fajr = parse24(t.Fajr)
  const sunrise = parse24(t.Sunrise)
  const dhuhr = parse24(t.Dhuhr)
  const asr = parse24(t.Asr)
  const maghrib = parse24(t.Maghrib)
  const isha = parse24(t.Isha)
  const nextFajr = idx + 1 < days.length ? parse24(days[idx + 1].timings.Fajr) : fajr

  const date = `2026-07-${String(idx + 1).padStart(2, '0')}`
  const zawalStart = addMinutes(dhuhr, -25)
  const zawalEnd = addMinutes(dhuhr, -5)
  const tahajjudStart = { h: 0, min: 30 }
  const tahajjudEnd = addMinutes(fajr, -20)
  const sehriStart = addMinutes(fajr, -90)

  return [
    date,
    'Kanpur',
    to12(fajr),
    to12(sunrise), // fajr window ends near sunrise / namaz end
    to12(dhuhr),
    to12(asr),
    to12(asr),
    to12(maghrib),
    to12(maghrib),
    to12(addMinutes(maghrib, 5)),
    to12(isha),
    to12(nextFajr),
    to12(sunrise),
    to12(addMinutes(sunrise, -10)), // fajr namaz end ~ before sunrise
    to12(zawalStart),
    to12(zawalEnd),
    to12(tahajjudStart),
    to12(tahajjudEnd),
    to12(sehriStart),
    to12(fajr), // sehri ends at fajr / subh sadiq
  ].join(',')
})

fs.writeFileSync(out, [header, ...rows].join('\n') + '\n', 'utf8')
console.log('Wrote', out, 'rows=', rows.length)
console.log('Sample day 1:', rows[0])
console.log('Sample day 15:', rows[14])
console.log('Sample day 31:', rows[30])
