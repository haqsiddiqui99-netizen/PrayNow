import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { withClient, formatDbError } from './pool.js'
import { generateYearFromDefaults } from '../services/cityPrayerDays.js'
import dotenv from 'dotenv'

dotenv.config()

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

/** Stable IDs so mobile JWTs still match after in-memory DB restarts. */
const SEED_ADMIN_ID = 'a0000000-0000-4000-8000-000000000001'
const SEED_MANAGER_ID = 'a1111111-1111-4111-8111-111111111111'
const SEED_KHAIRUL_MANAGER_ID = 'a2222222-2222-4222-8222-222222222222'

const DEFAULT_TIMINGS = {
  Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:10 AM', end: '5:40 AM' },
  Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:30 PM', end: '3:30 PM' },
  Asr: { start: '3:30 PM', azan: '3:30 PM', jamat: '3:45 PM', end: '6:45 PM' },
  Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:50 PM', end: '8:00 PM' },
  Isha: { start: '8:00 PM', azan: '8:00 PM', jamat: '8:15 PM', end: '4:55 AM' },
}

const MOSQUES = [
  {
    legacy_id: '1', name: 'Jama Masjid', address: 'Jama Masjid Rd, Chandni Chowk', area: 'Old Delhi',
    phone: '+91 11 2336 5358', lat: 28.6507, lng: 77.2332, sect: 'Sunni', imam: 'Sheikh Ahmed Bukhari',
    capacity: 25000, sermon_language: 'Urdu & Arabic', facilities: ['Wudu Area', 'Parking', 'WiFi', 'Wheelchair access'],
    events: ['Friday Khutbah 12:30 PM', 'Quran classes — Sat 10 AM'],
    timings: { ...DEFAULT_TIMINGS, Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:00 PM', jamat: '8:15 PM' } },
    night: { tahajjud_start: '12:30 AM', tahajjud_end: '4:40 AM', sehri_start: '3:10 AM', sehri_end: '4:50 AM' },
  },
  {
    legacy_id: '2', name: 'Fatehpuri Masjid', address: 'Fatehpuri, Chandni Chowk', area: 'Chandni Chowk, Delhi',
    phone: '+91 11 2396 2345', lat: 28.6568, lng: 77.2295, sect: 'Shia', imam: 'Sheikh Mahmoud Hassan',
    capacity: 3000, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Wheelchair access'],
    events: ['Evening Tafsir — Wed 7 PM', 'Youth program — Fri 5 PM'],
    timings: { ...DEFAULT_TIMINGS, Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:02 PM', jamat: '8:18 PM' } },
    night: { tahajjud_start: '1:35 AM', tahajjud_end: '2:05 AM', sehri_start: '8:02 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '3', name: 'Jama Masjid Kashmere Gate', address: 'Lothian Rd, Kashmere Gate', area: 'Kashmere Gate, Delhi',
    phone: '+91 11 2391 5678', lat: 28.6672, lng: 77.2290, sect: 'Sunni', imam: 'Sheikh Khalid Ansari',
    capacity: 2000, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Parking'],
    events: ['Community Iftar — Ramadan'],
    timings: { ...DEFAULT_TIMINGS, Isha: { ...DEFAULT_TIMINGS.Isha, azan: '7:58 PM', jamat: '8:12 PM' } },
    night: { tahajjud_start: '1:28 AM', tahajjud_end: '1:55 AM', sehri_start: '7:58 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '4', name: 'Hazrat Nizamuddin Auliya Dargah Masjid', address: 'Nizamuddin West', area: 'Nizamuddin, Delhi',
    phone: '+91 11 2435 9012', lat: 28.5911, lng: 77.2418, sect: 'Ahle Hadees', imam: 'Sheikh Yusuf Ibrahim',
    capacity: 1500, sermon_language: 'Urdu & Arabic', facilities: ['Wudu Area', 'Parking'],
    events: ['Qawwali sessions — Thu evening'],
    timings: { ...DEFAULT_TIMINGS, Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:00 PM', jamat: '8:10 PM' } },
    night: { tahajjud_start: '1:40 AM', tahajjud_end: '2:10 AM', sehri_start: '8:00 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '5', name: 'Masjid Moth', address: 'South Extension II, Delhi 110049', area: 'South Delhi',
    phone: '+91 11 2621 3456', lat: 28.5562, lng: 77.2100, sect: 'Wahabi', imam: 'Sheikh Abdullah Nour',
    capacity: 800, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Historical site'],
    events: ['Heritage tour — Sun 11 AM'],
    timings: { ...DEFAULT_TIMINGS, Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:01 PM', jamat: '8:16 PM' } },
    night: { tahajjud_start: '1:32 AM', tahajjud_end: '2:02 AM', sehri_start: '8:01 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '6', name: 'Sunehri Masjid', address: 'Netaji Subhash Marg, Chandni Chowk, Delhi 110006', area: 'Chandni Chowk',
    phone: '+91 11 2327 4521', lat: 28.6560, lng: 77.2312, sect: 'Sunni', imam: 'Sheikh Raza Ali',
    capacity: 1200, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Historical site'],
    events: ['Heritage walk — Sat 9 AM'],
    timings: {
      ...DEFAULT_TIMINGS,
      Fajr: { start: '4:53 AM', azan: '4:53 AM', jamat: '5:08 AM', end: '5:40 AM' },
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:35 PM', end: '3:30 PM' },
      Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:03 PM', jamat: '8:17 PM' },
    },
    night: { tahajjud_start: '1:33 AM', tahajjud_end: '2:03 AM', sehri_start: '8:03 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '7', name: 'Zinat-ul-Masjid', address: 'Sita Ram Bazar, Daryaganj, Delhi 110002', area: 'Daryaganj',
    phone: '+91 11 2327 8890', lat: 28.6408, lng: 77.2384, sect: 'Sunni', imam: 'Sheikh Iqbal Hussain',
    capacity: 1800, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Women section'],
    events: ['Arabic classes — Tue 6 PM'],
    timings: {
      ...DEFAULT_TIMINGS,
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:28 PM', end: '3:30 PM' },
      Asr: { start: '3:30 PM', azan: '3:32 PM', jamat: '3:48 PM', end: '6:45 PM' },
      Isha: { ...DEFAULT_TIMINGS.Isha, azan: '7:59 PM', jamat: '8:14 PM' },
    },
    night: { tahajjud_start: '1:29 AM', tahajjud_end: '1:58 AM', sehri_start: '7:59 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '8', name: 'Khairul Manazil Masjid', address: 'Mathura Road, Near Purana Qila, Delhi 110003', area: 'Pragati Maidan',
    phone: '+91 11 2331 2244', lat: 28.6098, lng: 77.2442, sect: 'Sunni', imam: 'Sheikh Hamid Akhtar',
    capacity: 900, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Parking'],
    events: ['Community outreach — Sun 4 PM'],
    timings: {
      ...DEFAULT_TIMINGS,
      Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:52 PM', end: '8:00 PM' },
      Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:04 PM', jamat: '8:20 PM' },
    },
    night: { tahajjud_start: '1:36 AM', tahajjud_end: '2:06 AM', sehri_start: '8:04 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '9', name: 'Shia Jama Masjid', address: 'Esplanade Road, Kashmere Gate, Delhi 110006', area: 'Kashmere Gate',
    phone: '+91 11 2391 7788', lat: 28.6612, lng: 77.2278, sect: 'Shia', imam: 'Maulana Syed Abbas',
    capacity: 3500, sermon_language: 'Urdu', facilities: ['Wudu Area', 'Wheelchair access'],
    events: ['Muharram majlis — evening programs'],
    timings: {
      ...DEFAULT_TIMINGS,
      Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:12 AM', end: '5:40 AM' },
      Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:40 PM', end: '3:30 PM' },
      Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:01 PM', jamat: '8:19 PM' },
    },
    night: { tahajjud_start: '1:31 AM', tahajjud_end: '2:01 AM', sehri_start: '8:01 PM', sehri_end: '4:55 AM' },
  },
  {
    legacy_id: '10', name: 'Banglewali Masjid', address: 'Banglewali Masjid Rd, Nizamuddin West, Delhi 110013', area: 'Nizamuddin',
    phone: '+91 11 2435 6677', lat: 28.5918, lng: 77.2425, sect: 'Sunni', imam: 'Sheikh Abdul Wahab',
    capacity: 2200, sermon_language: 'Urdu & Arabic', facilities: ['Wudu Area', 'Parking', 'Library'],
    events: ['Tablighi gathering — Thu evening'],
    timings: {
      ...DEFAULT_TIMINGS,
      Asr: { start: '3:30 PM', azan: '3:31 PM', jamat: '3:50 PM', end: '6:45 PM' },
      Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:48 PM', end: '8:00 PM' },
      Isha: { ...DEFAULT_TIMINGS.Isha, azan: '8:02 PM', jamat: '8:12 PM' },
    },
    night: { tahajjud_start: '1:38 AM', tahajjud_end: '2:08 AM', sehri_start: '8:02 PM', sehri_end: '4:55 AM' },
  },
]

const CITY_SCHEDULE = [
  { prayer_name: 'Fajr', start_time: '4:55 AM', end_time: '5:40 AM' },
  { prayer_name: 'Dhuhr', start_time: '12:15 PM', end_time: '3:30 PM' },
  { prayer_name: 'Asr', start_time: '3:30 PM', end_time: '6:45 PM' },
  { prayer_name: 'Maghrib', start_time: '6:45 PM', end_time: '8:00 PM' },
  { prayer_name: 'Isha', start_time: '8:00 PM', end_time: '4:55 AM' },
]

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@praynow.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345'
  const adminName = process.env.SEED_ADMIN_NAME || 'PrayNow Admin'
  const adminMobile = String(process.env.SEED_ADMIN_MOBILE || '9999999999').replace(/\D/g, '')

  await withClient(async (client) => {
    const hash = await bcrypt.hash(adminPassword, 10)
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         mobile = COALESCE(EXCLUDED.mobile, users.mobile),
         role = 'admin'`,
      [SEED_ADMIN_ID, adminEmail, hash, adminName, adminMobile],
    )
    console.log('Admin user:', adminEmail, '| mobile login:', adminMobile)

    await client.query(
      `INSERT INTO city_settings (
         id, city, country, lat, lng, zawal_start, zawal_end, sunrise, fajr_namaz_end,
         tahajjud_start, tahajjud_end, sehri_start, sehri_end
       )
       VALUES (
         1, 'Delhi', 'India', 28.6139, 77.2090, '11:20 AM', '11:55 AM', '5:45 AM', '5:40 AM',
         '12:30 AM', '4:40 AM', '3:10 AM', '4:50 AM'
       )
       ON CONFLICT (id) DO NOTHING`,
    )

    await client.query(`DELETE FROM city_prayer_schedule`)

    for (const row of CITY_SCHEDULE) {
      await client.query(
        `INSERT INTO city_prayer_schedule (id, prayer_name, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), row.prayer_name, row.start_time, row.end_time],
      )
    }

    for (const m of MOSQUES) {
      const { rows } = await client.query(
        `INSERT INTO mosques (id, legacy_id, name, address, area, city, phone, lat, lng, sect, imam, sermon_language, facilities, events, capacity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (legacy_id) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city
         RETURNING id`,
        [randomUUID(), m.legacy_id, m.name, m.address, m.area, m.city || 'Delhi', m.phone, m.lat, m.lng, m.sect, m.imam, m.sermon_language, m.facilities, m.events, m.capacity ?? 500],
      )

      let mosqueId = rows[0]?.id
      if (!mosqueId) {
        const existing = await client.query(`SELECT id FROM mosques WHERE legacy_id = $1`, [m.legacy_id])
        mosqueId = existing.rows[0]?.id
      }
      if (!mosqueId) continue

      for (const prayer of PRAYER_NAMES) {
        const t = m.timings[prayer]
        await client.query(
          `INSERT INTO mosque_timings (id, mosque_id, prayer_name, prayer_start, azan, jamat, prayer_end)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (mosque_id, prayer_name) DO UPDATE SET
             prayer_start = EXCLUDED.prayer_start,
             azan = EXCLUDED.azan,
             jamat = EXCLUDED.jamat,
             prayer_end = EXCLUDED.prayer_end`,
          [randomUUID(), mosqueId, prayer, t.start || '', t.azan, t.jamat, t.end || ''],
        )
      }

      await client.query(
        `INSERT INTO mosque_night_timings (mosque_id, tahajjud_start, tahajjud_end, sehri_start, sehri_end)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (mosque_id) DO UPDATE SET
           tahajjud_start = EXCLUDED.tahajjud_start,
           tahajjud_end = EXCLUDED.tahajjud_end,
           sehri_start = EXCLUDED.sehri_start,
           sehri_end = EXCLUDED.sehri_end`,
        [mosqueId, m.night.tahajjud_start, m.night.tahajjud_end, m.night.sehri_start, m.night.sehri_end],
      )
    }

    console.log('Seeded', MOSQUES.length, 'mosques and city schedule')

    const year = new Date().getFullYear()
    const generated = await generateYearFromDefaults(client, year, 'Delhi')
    console.log(`Seeded ${generated.upserted} city prayer days for ${generated.city} ${year}`)

    // Demo mosque admin (mobile login) assigned to Khairul Manazil (legacy_id 8)
    const managerMobile = String(process.env.SEED_MANAGER_MOBILE || '8888888888').replace(/\D/g, '')
    const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'Manager@12345'
    const managerHash = await bcrypt.hash(managerPassword, 10)
    const managerEmail = `manager_${managerMobile}@app.praynow.local`
    const { rows: managerRows } = await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role)
       VALUES ($1, $2, $3, $4, $5, 'mosque_manager')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         mobile = COALESCE(EXCLUDED.mobile, users.mobile),
         full_name = EXCLUDED.full_name,
         role = 'mosque_manager'
       RETURNING id`,
      [SEED_MANAGER_ID, managerEmail, managerHash, 'Demo Mosque Admin', managerMobile],
    )
    let managerId = managerRows[0]?.id
    if (!managerId) {
      const existing = await client.query(`SELECT id FROM users WHERE email = $1 OR mobile = $2`, [
        managerEmail,
        managerMobile,
      ])
      managerId = existing.rows[0]?.id
    }
    // Demo mosque admin can manage every seeded mosque (any mosque in the city seed set)
    if (managerId) {
      const { rows: allMosques } = await client.query(`SELECT id FROM mosques`)
      for (const row of allMosques) {
        await client.query(
          `INSERT INTO mosque_assignments (user_id, mosque_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [managerId, row.id],
        )
      }
      console.log(
        'Mosque admin mobile login:',
        managerMobile,
        '| password:',
        managerPassword,
        `| assigned ${allMosques.length} mosque(s)`,
      )
    } else {
      console.warn('Could not create demo mosque admin user')
    }

    // Dedicated admin for Khairul Manazil Masjid only (legacy_id 8)
    const khairulMobile = String(process.env.SEED_KHAIRUL_MOBILE || '7777777777').replace(/\D/g, '')
    // Avoid special chars — some phone keyboards mangling "@" caused invalid credentials
    const khairulPassword = process.env.SEED_KHAIRUL_PASSWORD || 'Khairul12345'
    const khairulHash = await bcrypt.hash(khairulPassword, 10)
    const khairulEmail = `manager_${khairulMobile}@app.praynow.local`
    const { rows: khairulRows } = await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role)
       VALUES ($1, $2, $3, $4, $5, 'mosque_manager')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         mobile = COALESCE(EXCLUDED.mobile, users.mobile),
         full_name = EXCLUDED.full_name,
         role = 'mosque_manager'
       RETURNING id`,
      [SEED_KHAIRUL_MANAGER_ID, khairulEmail, khairulHash, 'Khairul Manazil Admin', khairulMobile],
    )
    let khairulManagerId = khairulRows[0]?.id
    if (!khairulManagerId) {
      const existing = await client.query(`SELECT id FROM users WHERE email = $1 OR mobile = $2`, [
        khairulEmail,
        khairulMobile,
      ])
      khairulManagerId = existing.rows[0]?.id
    }
    const { rows: khairulMosque } = await client.query(`SELECT id FROM mosques WHERE legacy_id = '8' LIMIT 1`)
    if (khairulManagerId && khairulMosque[0]?.id) {
      await client.query(
        `INSERT INTO mosque_assignments (user_id, mosque_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [khairulManagerId, khairulMosque[0].id],
      )
      console.log(
        'Khairul Manazil admin:',
        khairulMobile,
        '| password:',
        khairulPassword,
        '| mosque: Khairul Manazil Masjid',
      )
    } else {
      console.warn('Could not create Khairul Manazil mosque admin')
    }
  })
}

export async function runSeed() {
  await seed()
}

const isDirectRun = process.argv[1]?.endsWith('seed.js')
if (isDirectRun) {
  runSeed().catch((err) => {
    console.error('Seed failed:', formatDbError(err))
    process.exit(1)
  })
}
