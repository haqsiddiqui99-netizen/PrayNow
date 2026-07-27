/**
 * Kanpur Aug–Dec 2026 from user-provided monthly tables.
 * Builds CSV and optionally imports via API.
 *
 * Usage:
 *   node scripts/import-kanpur-aug-dec-2026.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const CITY = 'Kanpur'
const outCsv = path.join(__dirname, '../data/kanpur-2026-aug-dec.csv')

/** @type {Record<number, Array<[string, string, string, string, string, string]>>} */
const MONTHS = {
  // [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha] — day index 0 = day 1
  8: [
    ['4:09 AM', '5:33 AM', '12:15 PM', '3:45 PM', '6:56 PM', '8:22 PM'],
    ['4:10 AM', '5:34 AM', '12:15 PM', '3:45 PM', '6:56 PM', '8:21 PM'],
    ['4:11 AM', '5:34 AM', '12:15 PM', '3:45 PM', '6:55 PM', '8:20 PM'],
    ['4:12 AM', '5:35 AM', '12:15 PM', '3:45 PM', '6:54 PM', '8:19 PM'],
    ['4:12 AM', '5:35 AM', '12:15 PM', '3:45 PM', '6:54 PM', '8:18 PM'],
    ['4:13 AM', '5:36 AM', '12:15 PM', '3:45 PM', '6:53 PM', '8:17 PM'],
    ['4:14 AM', '5:36 AM', '12:15 PM', '3:45 PM', '6:52 PM', '8:16 PM'],
    ['4:14 AM', '5:37 AM', '12:15 PM', '3:45 PM', '6:52 PM', '8:15 PM'],
    ['4:15 AM', '5:37 AM', '12:15 PM', '3:45 PM', '6:51 PM', '8:14 PM'],
    ['4:16 AM', '5:38 AM', '12:15 PM', '3:45 PM', '6:50 PM', '8:13 PM'],
    ['4:17 AM', '5:38 AM', '12:14 PM', '3:45 PM', '6:49 PM', '8:12 PM'],
    ['4:17 AM', '5:39 AM', '12:14 PM', '3:45 PM', '6:48 PM', '8:11 PM'],
    ['4:18 AM', '5:39 AM', '12:14 PM', '3:45 PM', '6:48 PM', '8:10 PM'],
    ['4:19 AM', '5:40 AM', '12:14 PM', '3:45 PM', '6:47 PM', '8:09 PM'],
    ['4:19 AM', '5:40 AM', '12:14 PM', '3:45 PM', '6:46 PM', '8:08 PM'],
    ['4:20 AM', '5:41 AM', '12:13 PM', '3:45 PM', '6:45 PM', '8:07 PM'],
    ['4:21 AM', '5:41 AM', '12:13 PM', '3:44 PM', '6:44 PM', '8:06 PM'],
    ['4:21 AM', '5:42 AM', '12:13 PM', '3:44 PM', '6:43 PM', '8:05 PM'],
    ['4:22 AM', '5:42 AM', '12:13 PM', '3:44 PM', '6:42 PM', '8:04 PM'],
    ['4:23 AM', '5:42 AM', '12:13 PM', '3:44 PM', '6:41 PM', '8:02 PM'],
    ['4:23 AM', '5:43 AM', '12:12 PM', '3:43 PM', '6:40 PM', '8:01 PM'],
    ['4:24 AM', '5:43 AM', '12:12 PM', '3:43 PM', '6:39 PM', '8:00 PM'],
    ['4:25 AM', '5:44 AM', '12:12 PM', '3:43 PM', '6:38 PM', '7:59 PM'],
    ['4:25 AM', '5:44 AM', '12:12 PM', '3:43 PM', '6:37 PM', '7:58 PM'],
    ['4:26 AM', '5:45 AM', '12:11 PM', '3:42 PM', '6:36 PM', '7:57 PM'],
    ['4:26 AM', '5:45 AM', '12:11 PM', '3:42 PM', '6:35 PM', '7:56 PM'],
    ['4:27 AM', '5:46 AM', '12:11 PM', '3:42 PM', '6:34 PM', '7:54 PM'],
    ['4:28 AM', '5:46 AM', '12:10 PM', '3:41 PM', '6:33 PM', '7:53 PM'],
    ['4:28 AM', '5:46 AM', '12:10 PM', '3:41 PM', '6:32 PM', '7:52 PM'],
    ['4:29 AM', '5:47 AM', '12:10 PM', '3:41 PM', '6:31 PM', '7:51 PM'],
    ['4:29 AM', '5:47 AM', '12:10 PM', '3:40 PM', '6:30 PM', '7:50 PM'],
  ],
  9: [
    ['4:30 AM', '5:48 AM', '12:09 PM', '3:40 PM', '6:29 PM', '7:48 PM'],
    ['4:31 AM', '5:48 AM', '12:09 PM', '3:39 PM', '6:28 PM', '7:47 PM'],
    ['4:31 AM', '5:49 AM', '12:09 PM', '3:39 PM', '6:27 PM', '7:46 PM'],
    ['4:32 AM', '5:49 AM', '12:08 PM', '3:39 PM', '6:26 PM', '7:45 PM'],
    ['4:32 AM', '5:49 AM', '12:08 PM', '3:38 PM', '6:25 PM', '7:43 PM'],
    ['4:33 AM', '5:50 AM', '12:08 PM', '3:38 PM', '6:24 PM', '7:42 PM'],
    ['4:33 AM', '5:50 AM', '12:07 PM', '3:37 PM', '6:23 PM', '7:41 PM'],
    ['4:34 AM', '5:51 AM', '12:07 PM', '3:37 PM', '6:22 PM', '7:40 PM'],
    ['4:34 AM', '5:51 AM', '12:07 PM', '3:36 PM', '6:21 PM', '7:39 PM'],
    ['4:35 AM', '5:52 AM', '12:06 PM', '3:36 PM', '6:19 PM', '7:37 PM'],
    ['4:36 AM', '5:52 AM', '12:06 PM', '3:35 PM', '6:18 PM', '7:36 PM'],
    ['4:36 AM', '5:52 AM', '12:05 PM', '3:35 PM', '6:17 PM', '7:35 PM'],
    ['4:37 AM', '5:53 AM', '12:05 PM', '3:34 PM', '6:16 PM', '7:34 PM'],
    ['4:37 AM', '5:53 AM', '12:05 PM', '3:33 PM', '6:15 PM', '7:32 PM'],
    ['4:38 AM', '5:54 AM', '12:04 PM', '3:33 PM', '6:14 PM', '7:31 PM'],
    ['4:38 AM', '5:54 AM', '12:04 PM', '3:32 PM', '6:13 PM', '7:30 PM'],
    ['4:39 AM', '5:54 AM', '12:04 PM', '3:32 PM', '6:12 PM', '7:29 PM'],
    ['4:39 AM', '5:55 AM', '12:03 PM', '3:31 PM', '6:10 PM', '7:28 PM'],
    ['4:40 AM', '5:55 AM', '12:03 PM', '3:31 PM', '6:09 PM', '7:26 PM'],
    ['4:40 AM', '5:56 AM', '12:03 PM', '3:30 PM', '6:08 PM', '7:25 PM'],
    ['4:40 AM', '5:56 AM', '12:02 PM', '3:29 PM', '6:07 PM', '7:24 PM'],
    ['4:41 AM', '5:57 AM', '12:02 PM', '3:29 PM', '6:06 PM', '7:23 PM'],
    ['4:41 AM', '5:57 AM', '12:02 PM', '3:28 PM', '6:05 PM', '7:22 PM'],
    ['4:42 AM', '5:57 AM', '12:01 PM', '3:27 PM', '6:04 PM', '7:21 PM'],
    ['4:42 AM', '5:58 AM', '12:01 PM', '3:27 PM', '6:03 PM', '7:19 PM'],
    ['4:43 AM', '5:58 AM', '12:01 PM', '3:26 PM', '6:01 PM', '7:18 PM'],
    ['4:43 AM', '5:59 AM', '12:00 PM', '3:25 PM', '6:00 PM', '7:17 PM'],
    ['4:44 AM', '5:59 AM', '12:00 PM', '3:25 PM', '5:59 PM', '7:16 PM'],
    ['4:44 AM', '6:00 AM', '12:00 PM', '3:24 PM', '5:58 PM', '7:15 PM'],
    ['4:45 AM', '6:00 AM', '11:59 AM', '3:23 PM', '5:57 PM', '7:14 PM'],
  ],
  10: [
    ['4:45 AM', '6:00 AM', '11:59 AM', '3:23 PM', '5:56 PM', '7:13 PM'],
    ['4:46 AM', '6:01 AM', '11:59 AM', '3:22 PM', '5:55 PM', '7:11 PM'],
    ['4:46 AM', '6:01 AM', '11:58 AM', '3:21 PM', '5:54 PM', '7:10 PM'],
    ['4:46 AM', '6:02 AM', '11:58 AM', '3:21 PM', '5:53 PM', '7:09 PM'],
    ['4:47 AM', '6:02 AM', '11:58 AM', '3:20 PM', '5:52 PM', '7:08 PM'],
    ['4:47 AM', '6:03 AM', '11:57 AM', '3:19 PM', '5:50 PM', '7:07 PM'],
    ['4:48 AM', '6:03 AM', '11:57 AM', '3:19 PM', '5:49 PM', '7:06 PM'],
    ['4:48 AM', '6:04 AM', '11:57 AM', '3:18 PM', '5:48 PM', '7:05 PM'],
    ['4:49 AM', '6:04 AM', '11:56 AM', '3:17 PM', '5:47 PM', '7:04 PM'],
    ['4:49 AM', '6:05 AM', '11:56 AM', '3:17 PM', '5:46 PM', '7:03 PM'],
    ['4:50 AM', '6:05 AM', '11:56 AM', '3:16 PM', '5:45 PM', '7:02 PM'],
    ['4:50 AM', '6:06 AM', '11:56 AM', '3:15 PM', '5:44 PM', '7:01 PM'],
    ['4:51 AM', '6:06 AM', '11:55 AM', '3:15 PM', '5:43 PM', '7:00 PM'],
    ['4:51 AM', '6:07 AM', '11:55 AM', '3:14 PM', '5:42 PM', '6:59 PM'],
    ['4:52 AM', '6:07 AM', '11:55 AM', '3:13 PM', '5:41 PM', '6:58 PM'],
    ['4:52 AM', '6:08 AM', '11:55 AM', '3:13 PM', '5:40 PM', '6:57 PM'],
    ['4:53 AM', '6:08 AM', '11:55 AM', '3:12 PM', '5:39 PM', '6:56 PM'],
    ['4:53 AM', '6:09 AM', '11:54 AM', '3:11 PM', '5:38 PM', '6:56 PM'],
    ['4:54 AM', '6:09 AM', '11:54 AM', '3:11 PM', '5:38 PM', '6:55 PM'],
    ['4:54 AM', '6:10 AM', '11:54 AM', '3:10 PM', '5:37 PM', '6:54 PM'],
    ['4:55 AM', '6:10 AM', '11:54 AM', '3:10 PM', '5:36 PM', '6:53 PM'],
    ['4:55 AM', '6:11 AM', '11:54 AM', '3:09 PM', '5:35 PM', '6:52 PM'],
    ['4:56 AM', '6:12 AM', '11:53 AM', '3:08 PM', '5:34 PM', '6:51 PM'],
    ['4:56 AM', '6:12 AM', '11:53 AM', '3:08 PM', '5:33 PM', '6:51 PM'],
    ['4:57 AM', '6:13 AM', '11:53 AM', '3:07 PM', '5:32 PM', '6:50 PM'],
    ['4:57 AM', '6:13 AM', '11:53 AM', '3:07 PM', '5:31 PM', '6:49 PM'],
    ['4:58 AM', '6:14 AM', '11:53 AM', '3:06 PM', '5:31 PM', '6:48 PM'],
    ['4:58 AM', '6:15 AM', '11:53 AM', '3:05 PM', '5:30 PM', '6:48 PM'],
    ['4:59 AM', '6:15 AM', '11:53 AM', '3:05 PM', '5:29 PM', '6:47 PM'],
    ['4:59 AM', '6:16 AM', '11:53 AM', '3:04 PM', '5:28 PM', '6:46 PM'],
    ['5:00 AM', '6:17 AM', '11:53 AM', '3:04 PM', '5:28 PM', '6:46 PM'],
  ],
  11: [
    ['5:00 AM', '6:17 AM', '11:53 AM', '3:03 PM', '5:27 PM', '6:45 PM'],
    ['5:01 AM', '6:18 AM', '11:53 AM', '3:03 PM', '5:26 PM', '6:45 PM'],
    ['5:01 AM', '6:18 AM', '11:53 AM', '3:02 PM', '5:26 PM', '6:44 PM'],
    ['5:02 AM', '6:19 AM', '11:53 AM', '3:02 PM', '5:25 PM', '6:43 PM'],
    ['5:02 AM', '6:20 AM', '11:53 AM', '3:01 PM', '5:24 PM', '6:43 PM'],
    ['5:03 AM', '6:21 AM', '11:53 AM', '3:01 PM', '5:24 PM', '6:42 PM'],
    ['5:04 AM', '6:21 AM', '11:53 AM', '3:01 PM', '5:23 PM', '6:42 PM'],
    ['5:04 AM', '6:22 AM', '11:53 AM', '3:00 PM', '5:23 PM', '6:42 PM'],
    ['5:05 AM', '6:23 AM', '11:53 AM', '3:00 PM', '5:22 PM', '6:41 PM'],
    ['5:05 AM', '6:23 AM', '11:53 AM', '2:59 PM', '5:21 PM', '6:41 PM'],
    ['5:06 AM', '6:24 AM', '11:53 AM', '2:59 PM', '5:21 PM', '6:40 PM'],
    ['5:07 AM', '6:25 AM', '11:53 AM', '2:59 PM', '5:20 PM', '6:40 PM'],
    ['5:07 AM', '6:25 AM', '11:53 AM', '2:58 PM', '5:20 PM', '6:40 PM'],
    ['5:08 AM', '6:26 AM', '11:54 AM', '2:58 PM', '5:20 PM', '6:39 PM'],
    ['5:08 AM', '6:27 AM', '11:54 AM', '2:58 PM', '5:19 PM', '6:39 PM'],
    ['5:09 AM', '6:28 AM', '11:54 AM', '2:58 PM', '5:19 PM', '6:39 PM'],
    ['5:10 AM', '6:28 AM', '11:54 AM', '2:57 PM', '5:18 PM', '6:38 PM'],
    ['5:10 AM', '6:29 AM', '11:54 AM', '2:57 PM', '5:18 PM', '6:38 PM'],
    ['5:11 AM', '6:30 AM', '11:54 AM', '2:57 PM', '5:18 PM', '6:38 PM'],
    ['5:11 AM', '6:31 AM', '11:55 AM', '2:57 PM', '5:18 PM', '6:38 PM'],
    ['5:12 AM', '6:31 AM', '11:55 AM', '2:57 PM', '5:17 PM', '6:38 PM'],
    ['5:13 AM', '6:32 AM', '11:55 AM', '2:56 PM', '5:17 PM', '6:38 PM'],
    ['5:13 AM', '6:33 AM', '11:55 AM', '2:56 PM', '5:17 PM', '6:38 PM'],
    ['5:14 AM', '6:34 AM', '11:56 AM', '2:56 PM', '5:17 PM', '6:37 PM'],
    ['5:15 AM', '6:34 AM', '11:56 AM', '2:56 PM', '5:17 PM', '6:37 PM'],
    ['5:15 AM', '6:35 AM', '11:56 AM', '2:56 PM', '5:16 PM', '6:37 PM'],
    ['5:16 AM', '6:36 AM', '11:57 AM', '2:56 PM', '5:16 PM', '6:37 PM'],
    ['5:17 AM', '6:37 AM', '11:57 AM', '2:56 PM', '5:16 PM', '6:37 PM'],
    ['5:17 AM', '6:37 AM', '11:57 AM', '2:56 PM', '5:16 PM', '6:37 PM'],
    ['5:18 AM', '6:38 AM', '11:58 AM', '2:56 PM', '5:16 PM', '6:38 PM'],
  ],
  12: [
    ['5:18 AM', '6:39 AM', '11:58 AM', '2:56 PM', '5:16 PM', '6:38 PM'],
    ['5:19 AM', '6:39 AM', '11:58 AM', '2:56 PM', '5:16 PM', '6:38 PM'],
    ['5:20 AM', '6:40 AM', '11:59 AM', '2:56 PM', '5:16 PM', '6:38 PM'],
    ['5:20 AM', '6:41 AM', '11:59 AM', '2:57 PM', '5:16 PM', '6:38 PM'],
    ['5:21 AM', '6:42 AM', '12:00 PM', '2:57 PM', '5:16 PM', '6:38 PM'],
    ['5:22 AM', '6:42 AM', '12:00 PM', '2:57 PM', '5:17 PM', '6:38 PM'],
    ['5:22 AM', '6:43 AM', '12:00 PM', '2:57 PM', '5:17 PM', '6:39 PM'],
    ['5:23 AM', '6:44 AM', '12:01 PM', '2:57 PM', '5:17 PM', '6:39 PM'],
    ['5:23 AM', '6:44 AM', '12:01 PM', '2:58 PM', '5:17 PM', '6:39 PM'],
    ['5:24 AM', '6:45 AM', '12:02 PM', '2:58 PM', '5:17 PM', '6:40 PM'],
    ['5:25 AM', '6:46 AM', '12:02 PM', '2:58 PM', '5:18 PM', '6:40 PM'],
    ['5:25 AM', '6:46 AM', '12:03 PM', '2:58 PM', '5:18 PM', '6:40 PM'],
    ['5:26 AM', '6:47 AM', '12:03 PM', '2:59 PM', '5:18 PM', '6:41 PM'],
    ['5:26 AM', '6:48 AM', '12:04 PM', '2:59 PM', '5:19 PM', '6:41 PM'],
    ['5:27 AM', '6:48 AM', '12:04 PM', '3:00 PM', '5:19 PM', '6:41 PM'],
    ['5:28 AM', '6:49 AM', '12:05 PM', '3:00 PM', '5:19 PM', '6:42 PM'],
    ['5:28 AM', '6:49 AM', '12:05 PM', '3:00 PM', '5:20 PM', '6:42 PM'],
    ['5:29 AM', '6:50 AM', '12:06 PM', '3:01 PM', '5:20 PM', '6:43 PM'],
    ['5:29 AM', '6:51 AM', '12:06 PM', '3:01 PM', '5:21 PM', '6:43 PM'],
    ['5:30 AM', '6:51 AM', '12:07 PM', '3:02 PM', '5:21 PM', '6:44 PM'],
    ['5:30 AM', '6:52 AM', '12:07 PM', '3:02 PM', '5:21 PM', '6:44 PM'],
    ['5:31 AM', '6:52 AM', '12:08 PM', '3:03 PM', '5:22 PM', '6:44 PM'],
    ['5:31 AM', '6:53 AM', '12:08 PM', '3:03 PM', '5:22 PM', '6:45 PM'],
    ['5:32 AM', '6:53 AM', '12:09 PM', '3:04 PM', '5:23 PM', '6:46 PM'],
    ['5:32 AM', '6:54 AM', '12:09 PM', '3:04 PM', '5:24 PM', '6:46 PM'],
    ['5:32 AM', '6:54 AM', '12:10 PM', '3:05 PM', '5:24 PM', '6:47 PM'],
    ['5:33 AM', '6:54 AM', '12:10 PM', '3:05 PM', '5:25 PM', '6:47 PM'],
    ['5:33 AM', '6:55 AM', '12:11 PM', '3:06 PM', '5:25 PM', '6:48 PM'],
    ['5:34 AM', '6:55 AM', '12:11 PM', '3:07 PM', '5:26 PM', '6:48 PM'],
    ['5:34 AM', '6:55 AM', '12:11 PM', '3:07 PM', '5:27 PM', '6:49 PM'],
    ['5:34 AM', '6:56 AM', '12:12 PM', '3:08 PM', '5:27 PM', '6:50 PM'],
  ],
}

function parse12(s) {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) throw new Error(`bad time ${s}`)
  let h = Number(m[1])
  const min = Number(m[2])
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return { h, min }
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

function buildRows() {
  const flat = []
  for (const month of [8, 9, 10, 11, 12]) {
    MONTHS[month].forEach((times, i) => {
      flat.push({
        date: `2026-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
        times,
      })
    })
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

  const lines = flat.map((row, idx) => {
    const [fajrS, sunriseS, dhuhrS, asrS, maghribS, ishaS] = row.times
    const fajr = parse12(fajrS)
    const sunrise = parse12(sunriseS)
    const dhuhr = parse12(dhuhrS)
    const asr = parse12(asrS)
    const maghrib = parse12(maghribS)
    const isha = parse12(ishaS)
    const nextFajr = idx + 1 < flat.length ? parse12(flat[idx + 1].times[0]) : fajr

    return [
      row.date,
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
      to12(addMinutes(dhuhr, -25)),
      to12(addMinutes(dhuhr, -5)),
      to12({ h: 0, min: 30 }),
      to12(addMinutes(fajr, -20)),
      to12(addMinutes(fajr, -90)),
      to12(fajr),
    ].join(',')
  })

  return [header, ...lines].join('\n') + '\n'
}

async function importCsv(csv) {
  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
  const { token } = await loginRes.json()

  const importRes = await fetch(`${API}/api/admin/city/days/import-csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: CITY, csv }),
  })
  const body = await importRes.json().catch(async () => ({ error: await importRes.text() }))
  if (!importRes.ok) throw new Error(`Import failed: ${JSON.stringify(body)}`)
  return body
}

const csv = buildRows()
fs.writeFileSync(outCsv, csv, 'utf8')
const dataRows = csv.trim().split('\n').length - 1
console.log(`Wrote ${outCsv} (${dataRows} days)`)

const result = await importCsv(csv)
console.log('Import OK', result)

const check = await fetch(`${API}/api/city/settings?city=Kanpur&date=2026-12-31`)
const data = await check.json()
console.log('Verify Dec 31 Fajr:', data.schedule?.find((s) => s.prayer_name === 'Fajr'))
console.log('yearDaysLoaded:', data.yearDaysLoaded)
