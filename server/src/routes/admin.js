import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getPool } from '../db/pool.js'
import { signToken, authMiddleware, requireRole } from '../middleware/auth.js'
import {
  fetchMosqueRows,
  fetchMosqueById,
  upsertMosqueTimings,
  upsertNightTimings,
  mosqueFieldsFromBody,
  userCanManageMosque,
  resolveMosqueDbId,
} from '../services/mosques.js'
import { startSession, stopSession, getLiveSessionForMosque } from '../services/liveAzanSessions.js'
import { buildAgoraCredentials } from '../services/agora.js'
import { notifyMosqueSubscribers } from '../services/notifications.js'
import {
  listCityDays,
  dayRowToScheduleAndExtras,
  countCityDays,
  normalizeCityName,
  csvTemplateHeader,
  normalizeDayInput,
  upsertCityDays,
  parseCityDaysCsv,
  generateYearFromDefaults,
} from '../services/cityPrayerDays.js'
import { generateYearFromAladhan } from '../services/aladhanCityDays.js'
import {
  fetchRequestById,
  listRequestsForAdmin,
  markRequestReviewed,
  photoUrl,
  requestPhotoIds,
} from '../services/mosqueRequests.js'

const router = Router()
// About 2 minutes of compressed speech, base64-encoded.
const MAX_VOICE_NOTE_B64 = 3 * 1024 * 1024

/** pg-mem can return TEXT[] defaults as the literal '{}' / '{a,b}' instead of an array. */
function toTextArray(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  const inner = value.trim().replace(/^\{|\}$/g, '')
  return inner ? inner.split(',').map((item) => item.replace(/^"|"$/g, '').trim()).filter(Boolean) : []
}
const pool = getPool()

router.post('/login', async (req, res) => {
  const { email, mobile, password: rawPassword } = req.body || {}
  const password = typeof rawPassword === 'string' ? rawPassword.trim() : ''
  if (!password) return res.status(400).json({ error: 'Password required' })
  if (!email && !mobile) return res.status(400).json({ error: 'Email or mobile required' })

  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    let rows = []
    if (mobile) {
      const digits = String(mobile).replace(/\D/g, '')
      const candidates = [...new Set([digits, digits.length > 10 ? digits.slice(-10) : null].filter(Boolean))]
      for (const candidate of candidates) {
        ;({ rows } = await client.query(
          `SELECT id, email, password_hash, full_name, mobile, role, is_active FROM users WHERE mobile = $1`,
          [candidate],
        ))
        if (rows[0]) break
      }
    } else {
      ;({ rows } = await client.query(
        `SELECT id, email, password_hash, full_name, mobile, role, is_active FROM users WHERE email = $1`,
        [String(email).toLowerCase().trim()],
      ))
    }
    const user = rows?.[0]
    if (!user || user.is_active === false) {
      console.warn('[login] unknown or inactive user', { mobile, email })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      console.warn('[login] bad password for', user.mobile || user.email, 'len=', password.length)
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = signToken(user)
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        mobile: user.mobile || '',
        role: user.role,
      },
    })
  } finally {
    client.release()
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user })
})

// --- Admin: full access ---
router.get('/admin/users', authMiddleware, requireRole('admin'), async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: users } = await client.query(
      `SELECT id, email, full_name, mobile, role, is_active, created_at
       FROM users ORDER BY created_at DESC`,
    )
    const rows = []
    for (const user of users) {
      const { rows: assignments } = await client.query(
        `SELECT mosque_assignments.mosque_id, mosques.name AS mosque_name
         FROM mosque_assignments
         INNER JOIN mosques ON mosques.id = mosque_assignments.mosque_id
         WHERE mosque_assignments.user_id = $1`,
        [user.id],
      )
      rows.push({ ...user, assignments })
    }
    res.json(rows)
  } finally {
    client.release()
  }
})

router.post('/admin/users', authMiddleware, requireRole('admin'), async (req, res) => {
  const { email, mobile, password, fullName, role = 'mosque_manager', mosqueIds = [] } = req.body || {}
  if (!password || !fullName) return res.status(400).json({ error: 'Missing fields' })
  if (!['admin', 'mosque_manager'].includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : ''
  if (role === 'mosque_manager' && cleanMobile.length < 10) {
    return res.status(400).json({ error: 'Mobile number required for mosque admin (10+ digits)' })
  }
  const resolvedEmail =
    email?.trim()
      ? String(email).toLowerCase().trim()
      : cleanMobile
        ? `manager_${cleanMobile}@app.praynow.local`
        : null
  if (!resolvedEmail) return res.status(400).json({ error: 'Email or mobile required' })

  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    if (cleanMobile) {
      const existing = await client.query(`SELECT id FROM users WHERE mobile = $1`, [cleanMobile])
      if (existing.rows[0]) return res.status(409).json({ error: 'Mobile number already registered' })
    }
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, full_name, mobile, role`,
      [randomUUID(), resolvedEmail, hash, fullName, cleanMobile || null, role],
    )
    const user = rows[0]
    for (const mosqueId of mosqueIds) {
      const dbId = await resolveMosqueDbId(client, mosqueId)
      if (!dbId) continue
      await client.query(
        `INSERT INTO mosque_assignments (user_id, mosque_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, dbId],
      )
    }
    res.status(201).json(user)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email or mobile already exists' })
    throw err
  } finally {
    client.release()
  }
})

router.post('/admin/mosques', authMiddleware, requireRole('admin'), async (req, res) => {
  const body = req.body || {}
  const f = mosqueFieldsFromBody(body)
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows } = await client.query(
      `INSERT INTO mosques (id, name, address, area, city, phone, lat, lng, sect, imam, imam_mobile, imam_photo,
         moazzin_name, moazzin_mobile, moazzin_photo, imams, moazzins, juma_khutba, juma_namaz, juma_sessions, sermon_language, facilities, events, photos, capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
      [
        randomUUID(), f.name, f.address, f.area, f.city || 'Kanpur', f.phone, f.lat, f.lng, f.sect,
        f.imam, f.imam_mobile, f.imam_photo, f.moazzin_name, f.moazzin_mobile, f.moazzin_photo,
        f.imams, f.moazzins, f.juma_khutba, f.juma_namaz, f.juma_sessions, f.sermon_language, f.facilities, f.events, f.photos, f.capacity,
      ],
    )
    const mosqueId = rows[0].id
    if (body.timings) await upsertMosqueTimings(client, mosqueId, body.timings)
    await upsertNightTimings(client, mosqueId, body.nightTimings)
    const mosque = await fetchMosqueById(client, mosqueId)
    res.status(201).json(mosque)
  } catch (err) {
    console.error('Create mosque failed:', err)
    res.status(500).json({ error: err.message || 'Failed to create mosque' })
  } finally {
    client.release()
  }
})

router.put('/admin/mosques/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    const b = req.body || {}
    const f = mosqueFieldsFromBody(b)
    await client.query(
      `UPDATE mosques SET name=COALESCE($2,name), address=COALESCE($3,address), area=COALESCE($4,area),
       city=COALESCE($5,city), phone=COALESCE($6,phone), lat=COALESCE($7,lat), lng=COALESCE($8,lng), sect=COALESCE($9,sect),
       imam=COALESCE($10,imam), imam_mobile=COALESCE($11,imam_mobile), imam_photo=COALESCE($12,imam_photo),
       moazzin_name=COALESCE($13,moazzin_name), moazzin_mobile=COALESCE($14,moazzin_mobile),
       moazzin_photo=COALESCE($15,moazzin_photo), imams=COALESCE($16,imams), moazzins=COALESCE($17,moazzins),
       juma_khutba=COALESCE($18,juma_khutba),
       juma_namaz=COALESCE($19,juma_namaz), juma_sessions=COALESCE($20,juma_sessions),
       sermon_language=COALESCE($21,sermon_language),
       facilities=COALESCE($22,facilities), events=COALESCE($23,events), photos=COALESCE($24,photos),
       capacity=COALESCE($25,capacity), is_active=COALESCE($26,is_active), updated_at=NOW() WHERE id=$1`,
      [
        dbId, f.name, f.address, f.area, f.city, f.phone, f.lat, f.lng, f.sect,
        f.imam, f.imam_mobile, f.imam_photo, f.moazzin_name, f.moazzin_mobile, f.moazzin_photo,
        f.imams, f.moazzins, f.juma_khutba, f.juma_namaz, f.juma_sessions, f.sermon_language, f.facilities, f.events, f.photos, f.capacity, b.isActive,
      ],
    )
    if (b.timings) await upsertMosqueTimings(client, dbId, b.timings)
    await upsertNightTimings(client, dbId, b.nightTimings)
    const mosque = await fetchMosqueById(client, dbId)
    if (b.timings) {
      try {
        await notifyMosqueSubscribers(client, dbId, {
          type: 'timings',
          title: `${mosque.name}: prayer timings updated`,
          body: 'Azan / Jamat (or Juma) timings were changed. Open the app to see the latest schedule.',
        })
      } catch (err) {
        console.warn('[notify] admin update fan-out failed', err instanceof Error ? err.message : err)
      }
    }
    res.json(mosque)
  } catch (err) {
    console.error('Update mosque failed:', err)
    res.status(500).json({ error: err.message || 'Failed to update mosque' })
  } finally {
    client.release()
  }
})

router.put('/admin/mosques/:id/timings', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    await upsertMosqueTimings(client, dbId, req.body.timings || req.body)
    const mosque = await fetchMosqueById(client, dbId)
    try {
      await notifyMosqueSubscribers(client, dbId, {
        type: 'timings',
        title: `${mosque.name}: prayer timings updated`,
        body: 'Azan / Jamat (or Juma) timings were changed. Open the app to see the latest schedule.',
      })
    } catch (err) {
      console.warn('[notify] admin timings fan-out failed', err instanceof Error ? err.message : err)
    }
    res.json(mosque)
  } finally {
    client.release()
  }
})

router.post('/admin/mosques/:id/assign', authMiddleware, requireRole('admin'), async (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
    await client.query(
      `INSERT INTO mosque_assignments (user_id, mosque_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [userId, dbId],
    )
    res.json({ ok: true })
  } finally {
    client.release()
  }
})

router.get('/admin/city/settings', authMiddleware, requireRole('admin'), async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settings } = await client.query(`SELECT * FROM city_settings WHERE id = 1`)
    const { rows: schedule } = await client.query(`SELECT * FROM city_prayer_schedule ORDER BY prayer_name`)
    res.json({ settings: settings[0] || null, schedule })
  } finally {
    client.release()
  }
})

router.put('/admin/city/settings', authMiddleware, requireRole('admin'), async (req, res) => {
  const { settings = {}, schedule = [] } = req.body || {}
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    await client.query(
      `INSERT INTO city_settings (
         id, city, country, lat, lng, zawal_start, zawal_end, sunrise, fajr_namaz_end,
         tahajjud_start, tahajjud_end, sehri_start, sehri_end, updated_at
       )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (id) DO UPDATE SET
         city = COALESCE(EXCLUDED.city, city_settings.city),
         country = COALESCE(EXCLUDED.country, city_settings.country),
         lat = COALESCE(EXCLUDED.lat, city_settings.lat),
         lng = COALESCE(EXCLUDED.lng, city_settings.lng),
         zawal_start = COALESCE(EXCLUDED.zawal_start, city_settings.zawal_start),
         zawal_end = COALESCE(EXCLUDED.zawal_end, city_settings.zawal_end),
         sunrise = COALESCE(EXCLUDED.sunrise, city_settings.sunrise),
         fajr_namaz_end = COALESCE(EXCLUDED.fajr_namaz_end, city_settings.fajr_namaz_end),
         tahajjud_start = COALESCE(EXCLUDED.tahajjud_start, city_settings.tahajjud_start),
         tahajjud_end = COALESCE(EXCLUDED.tahajjud_end, city_settings.tahajjud_end),
         sehri_start = COALESCE(EXCLUDED.sehri_start, city_settings.sehri_start),
         sehri_end = COALESCE(EXCLUDED.sehri_end, city_settings.sehri_end),
         updated_at = NOW()`,
      [
        settings.city || 'Delhi',
        settings.country || 'India',
        settings.lat ?? 28.6139,
        settings.lng ?? 77.209,
        settings.zawal_start || '11:20 AM',
        settings.zawal_end || '11:55 AM',
        settings.sunrise || '5:45 AM',
        settings.fajr_namaz_end || '5:40 AM',
        settings.tahajjud_start || '12:30 AM',
        settings.tahajjud_end || '4:40 AM',
        settings.sehri_start || '3:10 AM',
        settings.sehri_end || '4:50 AM',
      ],
    )

    for (const row of schedule) {
      if (!row?.prayer_name) continue
      await client.query(
        `INSERT INTO city_prayer_schedule (id, prayer_name, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (prayer_name) DO UPDATE SET
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time`,
        [randomUUID(), row.prayer_name, row.start_time || '', row.end_time || ''],
      )
    }

    const { rows: savedSettings } = await client.query(`SELECT * FROM city_settings WHERE id = 1`)
    const { rows: savedSchedule } = await client.query(`SELECT * FROM city_prayer_schedule ORDER BY prayer_name`)
    res.json({ settings: savedSettings[0] || null, schedule: savedSchedule })
  } finally {
    client.release()
  }
})

router.get('/admin/city/days', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settingsRows } = await client.query(`SELECT city FROM city_settings WHERE id = 1`)
    const city = normalizeCityName(req.query.city || settingsRows[0]?.city || 'Delhi')
    const year = Number(req.query.year) || new Date().getFullYear()
    const from = String(req.query.from || `${year}-01-01`).slice(0, 10)
    const to = String(req.query.to || `${year}-12-31`).slice(0, 10)
    const rows = await listCityDays(client, city, from, to)
    res.json({
      city,
      year,
      from,
      to,
      count: rows.length,
      yearDaysLoaded: await countCityDays(client, city, year),
      csvHeader: csvTemplateHeader(),
      days: rows.map((r) => dayRowToScheduleAndExtras(r)),
    })
  } finally {
    client.release()
  }
})

router.put('/admin/city/days', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settingsRows } = await client.query(`SELECT city FROM city_settings WHERE id = 1`)
    const city = normalizeCityName(req.body?.city || settingsRows[0]?.city || 'Delhi')
    const rawDays = Array.isArray(req.body?.days) ? req.body.days : []
    if (!rawDays.length) return res.status(400).json({ error: 'days array required' })
    const days = rawDays.map((d) => normalizeDayInput(d, city))
    const upserted = await upsertCityDays(client, days)
    const year = Number(String(days[0].prayer_date).slice(0, 4)) || new Date().getFullYear()
    res.json({ ok: true, city, upserted, yearDaysLoaded: await countCityDays(client, city, year) })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Import failed' })
  } finally {
    client.release()
  }
})

router.post('/admin/city/days/import-csv', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settingsRows } = await client.query(`SELECT city FROM city_settings WHERE id = 1`)
    const city = normalizeCityName(req.body?.city || settingsRows[0]?.city || 'Delhi')
    const csv = req.body?.csv
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv string required' })
    const days = parseCityDaysCsv(csv, city)
    const upserted = await upsertCityDays(client, days)
    const year = Number(String(days[0]?.prayer_date || '').slice(0, 4)) || new Date().getFullYear()
    res.json({ ok: true, city, upserted, yearDaysLoaded: await countCityDays(client, city, year) })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'CSV import failed' })
  } finally {
    client.release()
  }
})

router.post('/admin/city/days/generate-year', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const year = Number(req.body?.year) || new Date().getFullYear()
    const city = req.body?.city ? normalizeCityName(req.body.city) : undefined
    const source = String(req.body?.source || 'aladhan').toLowerCase()
    const result =
      source === 'defaults'
        ? await generateYearFromDefaults(client, year, city)
        : await generateYearFromAladhan(client, year, city || 'Delhi')
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Generate failed' })
  } finally {
    client.release()
  }
})

// --- Mosque manager: assigned mosques only ---
router.get('/manager/mosques', authMiddleware, requireRole('admin', 'mosque_manager'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    if (req.user.role === 'admin') {
      return res.json(await fetchMosqueRows(client, { activeOnly: false }))
    }
    const { rows } = await client.query(
      `SELECT mosques.id FROM mosques
       INNER JOIN mosque_assignments ON mosque_assignments.mosque_id = mosques.id
       WHERE mosque_assignments.user_id = $1`,
      [req.user.sub],
    )
    const mosques = []
    for (const r of rows) {
      mosques.push(await fetchMosqueById(client, r.id))
    }
    res.json(mosques)
  } finally {
    client.release()
  }
})

// Assigned mosque admin can edit that mosque's details and prayer timings.
router.put('/manager/mosques/:id', authMiddleware, requireRole('admin', 'mosque_manager'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
    if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })

    const b = req.body || {}
    await client.query(
      `UPDATE mosques SET
         name = COALESCE($2, name),
         address = COALESCE($3, address),
         area = COALESCE($4, area),
         phone = COALESCE($5, phone),
         sect = COALESCE($6, sect),
         lat = COALESCE($7, lat),
         lng = COALESCE($8, lng),
         capacity = COALESCE($9, capacity),
         updated_at = NOW()
       WHERE id = $1`,
      [
        dbId,
        b.name || null,
        b.address || null,
        b.area || null,
        b.phone ?? null,
        b.sect || null,
        b.lat ?? null,
        b.lng ?? null,
        b.capacity ?? null,
      ],
    )
    if (Array.isArray(b.facilities) || Array.isArray(b.featureOptions)) {
      const options = Array.isArray(b.featureOptions) ? b.featureOptions : b.facilities
      const names = [...new Set(options.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 40)
      const enabled = new Set(
        (Array.isArray(b.facilities) ? b.facilities : names).map((item) => String(item || '').trim()),
      )
      const active = names.filter((name) => enabled.has(name))
      const { rows: prevRows } = await client.query(
        `SELECT name, facilities, facility_options FROM mosques WHERE id = $1`,
        [dbId],
      )
      const prevActive = new Set(toTextArray(prevRows[0]?.facilities))
      const prevOptions = new Set([...toTextArray(prevRows[0]?.facility_options), ...prevActive])
      await client.query(
        `UPDATE mosques SET facilities = $2, facility_options = $3, updated_at = NOW() WHERE id = $1`,
        [dbId, active, names],
      )
      const nowActive = new Set(active)
      const nowOptions = new Set(names)
      const changes = []
      for (const name of prevOptions) {
        if (!nowOptions.has(name)) changes.push(`${name} is no longer listed`)
        else if (prevActive.has(name) && !nowActive.has(name)) changes.push(`${name} is not available right now`)
      }
      for (const name of nowActive) {
        if (!prevActive.has(name)) changes.push(`${name} is now available`)
      }
      if (changes.length) {
        try {
          await notifyMosqueSubscribers(client, dbId, {
            type: 'facilities',
            title: `${prevRows[0]?.name || 'Your mosque'}: facilities updated`,
            body: changes.join('. ') + '.',
          })
        } catch (err) {
          console.warn('[notify] facilities fan-out failed', err instanceof Error ? err.message : err)
        }
      }
    }
    if (b.timings) await upsertMosqueTimings(client, dbId, b.timings)
    if (b.nightTimings) await upsertNightTimings(client, dbId, b.nightTimings)
    const mosque = await fetchMosqueById(client, dbId)
    if (b.timings) {
      try {
        await notifyMosqueSubscribers(client, dbId, {
          type: 'timings',
          title: `${mosque.name}: prayer timings updated`,
          body: 'Azan / Jamat timings were changed. Open the app to see the latest schedule.',
        })
      } catch (err) {
        console.warn('[notify] manager update fan-out failed', err instanceof Error ? err.message : err)
      }
    }
    res.json(mosque)
  } catch (err) {
    console.error('Manager update mosque failed:', err)
    res.status(500).json({ error: err.message || 'Failed to update mosque' })
  } finally {
    client.release()
  }
})

router.put('/manager/mosques/:id/taraweeh', authMiddleware, requireRole('admin', 'mosque_manager'), async (req, res) => {
  const NIGHTS = new Set([10, 15, 20, 27, 29])
  const RAKAHS = new Set([8, 20])
  const body = req.body || {}
  const nights = Number(body.nights)
  const rakahs = Number(body.rakahs)
  let night = Number(body.night)
  if (!NIGHTS.has(nights)) return res.status(400).json({ error: 'Nights must be 10, 15, 20, 27, or 29' })
  if (!RAKAHS.has(rakahs)) return res.status(400).json({ error: 'Rak‘ahs must be 8 or 20' })
  if (!Number.isFinite(night)) night = 1
  night = Math.min(nights, Math.max(1, Math.round(night)))
  const startTime = String(body.startTime || '8:45 PM').trim().slice(0, 16)

  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
    if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })
    await client.query(
      `UPDATE mosques SET
         taraweeh_enabled = $2,
         taraweeh_start = $3,
         taraweeh_nights = $4,
         taraweeh_rakahs = $5,
         taraweeh_night = $6,
         updated_at = NOW()
       WHERE id = $1`,
      [dbId, Boolean(body.enabled), startTime, nights, rakahs, night],
    )
    res.json(await fetchMosqueById(client, dbId))
  } catch (err) {
    console.error('Taraweeh update failed:', err)
    res.status(500).json({ error: err.message || 'Failed to save Taraweeh' })
  } finally {
    client.release()
  }
})

router.put('/manager/mosques/:id/timings', authMiddleware, requireRole('admin', 'mosque_manager'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
    if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })
    await upsertMosqueTimings(client, dbId, req.body.timings || req.body)
    await upsertNightTimings(client, dbId, req.body.nightTimings)
    const juma = req.body.jumaTimings
    if (juma) {
      const sessions = Array.isArray(juma.sessions) && juma.sessions.length > 0
        ? juma.sessions.map((s) => ({
          azan: s?.azan || '',
          khutba: s?.khutba || '',
          namaz: s?.namaz || '',
        }))
        : [{ azan: juma.azan || '', khutba: juma.khutba || '', namaz: juma.namaz || '' }]
      await client.query(
        `UPDATE mosques SET juma_khutba = $2, juma_namaz = $3, juma_sessions = $4, updated_at = NOW()
         WHERE id = $1`,
        [dbId, sessions[0]?.khutba || null, sessions[0]?.namaz || null, JSON.stringify(sessions)],
      )
    }
    const mosque = await fetchMosqueById(client, dbId)
    try {
      await notifyMosqueSubscribers(client, dbId, {
        type: 'timings',
        title: `${mosque.name}: prayer timings updated`,
        body: 'Azan / Jamat (or Juma) timings were changed. Open the app to see the latest schedule.',
      })
    } catch (err) {
      console.warn('[notify] timings fan-out failed', err instanceof Error ? err.message : err)
    }
    res.json(mosque)
  } finally {
    client.release()
  }
})

// Mosque admin posts an announcement → inbox + push for subscribers
router.post(
  '/manager/mosques/:id/announcements',
  authMiddleware,
  requireRole('admin', 'mosque_manager'),
  async (req, res) => {
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.replace(/\s/g, '') : ''
    const mime = String(req.body?.mime || 'audio/mp4').slice(0, 64)
    if (!title && !body && !audioBase64) return res.status(400).json({ error: 'Write a message or record a voice note' })
    if (audioBase64 && (audioBase64.length > MAX_VOICE_NOTE_B64 || !/^[A-Za-z0-9+/=]+$/.test(audioBase64))) {
      return res.status(400).json({ error: 'Voice note is too long or unreadable (keep it under 2 minutes)' })
    }
    if (audioBase64 && !mime.startsWith('audio/')) return res.status(400).json({ error: 'Voice note must be audio' })
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
      const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
      if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })
      const mosque = await fetchMosqueById(client, dbId)
      let voiceNoteId = null
      if (audioBase64) {
        voiceNoteId = randomUUID()
        await client.query(
          `INSERT INTO mosque_voice_notes (id, mosque_id, mime, audio) VALUES ($1, $2, $3, $4)`,
          [voiceNoteId, dbId, mime, audioBase64],
        )
      }
      const result = await notifyMosqueSubscribers(client, dbId, {
        type: 'announcement',
        title: (title || `Message from ${mosque.name}`).slice(0, 255),
        body: body || (voiceNoteId ? 'Voice note' : `Announcement from ${mosque.name}`),
        voiceNoteId,
      })
      res.status(201).json({ ok: true, notified: result.notified, mosqueId: mosque.id })
    } catch (err) {
      console.error('announcement failed', err)
      res.status(500).json({ error: err.message || 'Failed to post announcement' })
    } finally {
      client.release()
    }
  },
)

// Tell subscribers the azan is about to start.
router.post(
  '/manager/mosques/:id/azan/alert',
  authMiddleware,
  requireRole('admin', 'mosque_manager'),
  async (req, res) => {
    const prayer = String(req.body?.prayerName || '').trim().slice(0, 16)
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
      const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
      if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })
      const mosque = await fetchMosqueById(client, dbId)
      const result = await notifyMosqueSubscribers(client, dbId, {
        type: 'azan_alert',
        title: `${prayer ? `${prayer} azan` : 'Azan'} starts soon`,
        body: `${mosque.name} is about to give the azan live. Open the app to listen.`,
      })
      res.status(201).json({ ok: true, notified: result.notified })
    } catch (err) {
      console.error('azan alert failed', err)
      res.status(500).json({ error: err.message || 'Failed to alert subscribers' })
    } finally {
      client.release()
    }
  },
)

// --- Live azan broadcast (mosque manager / admin, assigned mosques only) ---

// Start broadcasting azan for a mosque. Returns Agora publisher credentials.
router.post(
  '/manager/mosques/:id/azan/start',
  authMiddleware,
  requireRole('admin', 'mosque_manager'),
  async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
      const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
      if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })

      const session = await startSession(client, {
        mosqueDbId: dbId,
        prayerName: req.body?.prayerName || null,
        userId: req.user.sub,
      })
      const agora = buildAgoraCredentials(session.channel, 'publisher', 0)
      res.status(201).json({ session, agora })
    } catch (err) {
      console.error('Start azan failed:', err)
      res.status(500).json({ error: err.message || 'Failed to start azan' })
    } finally {
      client.release()
    }
  },
)

// Stop broadcasting azan. Optionally attach a recording URL for later playback.
router.post(
  '/manager/mosques/:id/azan/stop',
  authMiddleware,
  requireRole('admin', 'mosque_manager'),
  async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
      const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
      if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })

      const session = await stopSession(client, {
        mosqueDbId: dbId,
        recordingUrl: req.body?.recordingUrl || null,
      })
      res.json({ session, ended: Boolean(session) })
    } finally {
      client.release()
    }
  },
)

// Refresh the broadcaster token for the current live session (tokens expire).
router.get(
  '/manager/mosques/:id/azan/broadcast-token',
  authMiddleware,
  requireRole('admin', 'mosque_manager'),
  async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
      const allowed = await userCanManageMosque(client, req.user.sub, req.user.role, dbId)
      if (!allowed) return res.status(403).json({ error: 'Not assigned to this mosque' })

      const session = await getLiveSessionForMosque(client, dbId)
      if (!session) return res.status(404).json({ error: 'No live session' })
      res.json({ agora: buildAgoraCredentials(session.channel, 'publisher', 0) })
    } finally {
      client.release()
    }
  },
)

// --- Review queue for user-submitted mosque requests ---

router.get('/admin/mosque-requests', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const status = String(req.query.status || 'pending')
    const requests = await listRequestsForAdmin(client, status)
    res.json({ requests })
  } catch (err) {
    console.error('mosque request review list failed', err)
    res.status(500).json({ error: err.message || 'Failed to load requests' })
  } finally {
    client.release()
  }
})

/**
 * Approving creates the real mosque from the request and carries its photos over
 * by URL, so the uploaded bytes are reused rather than copied a second time.
 */
router.post('/admin/mosque-requests/:id/approve', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const request = await fetchRequestById(client, req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `Request was already ${request.status}` })
    }

    const photoIds = await requestPhotoIds(client, request.id)
    const f = mosqueFieldsFromBody({
      name: request.name,
      address: request.address,
      area: request.area || request.city || '',
      city: request.city || null,
      phone: request.owner_mobile,
      lat: request.lat,
      lng: request.lng,
      photos: photoIds.map(photoUrl),
      capacity: 0,
    })
    const mosqueId = randomUUID()
    await client.query(
      `INSERT INTO mosques (id, name, address, area, city, phone, lat, lng, sect, imam, imam_mobile, imam_photo,
         moazzin_name, moazzin_mobile, moazzin_photo, imams, moazzins, juma_khutba, juma_namaz, juma_sessions,
         sermon_language, facilities, events, photos, capacity, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
      [
        mosqueId, f.name, f.address, f.area, f.city || 'Kanpur', f.phone, f.lat ?? 0, f.lng ?? 0, f.sect,
        f.imam, f.imam_mobile, f.imam_photo, f.moazzin_name, f.moazzin_mobile, f.moazzin_photo,
        f.imams, f.moazzins, f.juma_khutba, f.juma_namaz, f.juma_sessions, f.sermon_language,
        f.facilities, f.events, f.photos, f.capacity,
        // Hidden until an admin fills in timings, so the app never shows a blank mosque.
        false,
      ],
    )

    await markRequestReviewed(client, request.id, {
      status: 'approved',
      reviewNote: String(req.body?.reviewNote || '').slice(0, 2000),
      reviewerId: req.user.sub,
      mosqueId,
    })
    const mosque = await fetchMosqueById(client, mosqueId)
    res.json({ ok: true, mosque })
  } catch (err) {
    console.error('mosque request approve failed', err)
    res.status(500).json({ error: err.message || 'Failed to approve request' })
  } finally {
    client.release()
  }
})

router.post('/admin/mosque-requests/:id/reject', authMiddleware, requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const request = await fetchRequestById(client, req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `Request was already ${request.status}` })
    }
    await markRequestReviewed(client, request.id, {
      status: 'rejected',
      reviewNote: String(req.body?.reviewNote || '').slice(0, 2000),
      reviewerId: req.user.sub,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('mosque request reject failed', err)
    res.status(500).json({ error: err.message || 'Failed to reject request' })
  } finally {
    client.release()
  }
})

export default router
