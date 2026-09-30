import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { signToken } from '../middleware/auth.js'
import { fetchMosqueRows, fetchMosqueById, resolveMosqueDbId } from '../services/mosques.js'
import { buildLiveAzanFeeds } from '../services/liveAzan.js'
import { getLiveSessions, getLiveSessionForMosque, getLatestRecording } from '../services/liveAzanSessions.js'
import { buildAgoraCredentials } from '../services/agora.js'
import { askOpenAiIslamicQuestion } from '../services/islamicChat.js'
import {
  formatDateYmd,
  getCityDay,
  dayRowToScheduleAndExtras,
  countCityDays,
  normalizeCityName,
  listCityDays,
} from '../services/cityPrayerDays.js'
import { catalogEntry, cityIdFromName, listCatalogCities } from '../data/cityCatalog.js'

const router = Router()
const pool = getPool()

function normalizeMobile(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

router.post('/register', async (req, res) => {
  const { name, mobile, password } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  const cleanMobile = normalizeMobile(mobile)
  if (!cleanMobile) return res.status(400).json({ error: 'Valid mobile number is required' })

  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const existing = await client.query(`SELECT id FROM users WHERE mobile = $1`, [cleanMobile])
    if (existing.rows[0]) return res.status(409).json({ error: 'Mobile number already registered' })

    const email = `user_${cleanMobile}@app.praynow.local`
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, mobile, role)
       VALUES ($1, $2, $3, $4, $5, 'app_user')
       RETURNING id, email, full_name, mobile, role`,
      [randomUUID(), email, hash, name.trim(), cleanMobile],
    )
    const user = rows[0]
    const token = signToken({ ...user, full_name: user.full_name })
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        mobile: user.mobile,
        role: user.role,
      },
    })
  } finally {
    client.release()
  }
})

router.get('/cities', async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settings } = await client.query(
      `SELECT city, country, lat, lng FROM city_settings WHERE id = 1`,
    )
    const defaultCountry = settings[0]?.country || 'India'
    const { rows } = await client.query(
      `SELECT city,
              COUNT(*)::int AS mosque_count,
              AVG(lat)::float AS lat,
              AVG(lng)::float AS lng
       FROM mosques
       WHERE is_active = TRUE AND city IS NOT NULL AND city <> ''
       GROUP BY city
       ORDER BY city`,
    )

    const byName = new Map()
    for (const r of rows) {
      const name = normalizeCityName(r.city)
      const meta = catalogEntry(name)
      const id = cityIdFromName(name)
      byName.set(name.toLowerCase(), {
        id,
        name,
        country: defaultCountry,
        mosqueCount: r.mosque_count,
        lat: Number(r.lat) || meta?.lat || null,
        lng: Number(r.lng) || meta?.lng || null,
        aliases: meta?.aliases || [name.toLowerCase(), id.replace(/-/g, ' ')],
        pinCodes: meta?.pinCodes || [],
        pinPrefixes: meta?.pinPrefixes || [],
      })
    }

    // Always include the configured home city even with zero mosques.
    const home = settings[0]?.city ? normalizeCityName(settings[0].city) : null
    if (home && !byName.has(home.toLowerCase())) {
      const meta = catalogEntry(home)
      byName.set(home.toLowerCase(), {
        id: cityIdFromName(home),
        name: home,
        country: defaultCountry,
        mosqueCount: 0,
        lat: Number(settings[0].lat) || meta?.lat || null,
        lng: Number(settings[0].lng) || meta?.lng || null,
        aliases: meta?.aliases || [home.toLowerCase()],
        pinCodes: meta?.pinCodes || [],
        pinPrefixes: meta?.pinPrefixes || [],
      })
    }

    // Tier-1 catalog cities (incl. Navi Mumbai / Thane) even before mosques exist.
    for (const c of listCatalogCities()) {
      const key = c.name.toLowerCase()
      if (byName.has(key)) {
        const existing = byName.get(key)
        byName.set(key, {
          ...existing,
          lat: existing.lat ?? c.lat,
          lng: existing.lng ?? c.lng,
          aliases: c.aliases?.length ? c.aliases : existing.aliases,
          pinCodes: c.pinCodes?.length ? c.pinCodes : existing.pinCodes || [],
          pinPrefixes: c.pinPrefixes?.length ? c.pinPrefixes : existing.pinPrefixes || [],
        })
        continue
      }
      byName.set(key, {
        id: c.id,
        name: c.name,
        country: defaultCountry,
        mosqueCount: 0,
        lat: c.lat,
        lng: c.lng,
        aliases: c.aliases,
        pinCodes: c.pinCodes || [],
        pinPrefixes: c.pinPrefixes || [],
      })
    }

    const list = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    if (list.length) return res.json(list)

    const s = settings[0]
    const fallbackName = normalizeCityName(s?.city || 'Kanpur')
    const meta = catalogEntry(fallbackName)
    res.json([
      {
        id: cityIdFromName(fallbackName),
        name: fallbackName,
        country: defaultCountry,
        mosqueCount: 0,
        lat: Number(s?.lat) || meta?.lat || 26.4499,
        lng: Number(s?.lng) || meta?.lng || 80.3319,
        aliases: meta?.aliases || [fallbackName.toLowerCase()],
      },
    ])
  } finally {
    client.release()
  }
})

router.get('/mosques', async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    res.json(await fetchMosqueRows(client))
  } finally {
    client.release()
  }
})

router.get('/mosques/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Not found' })
    res.json(await fetchMosqueById(client, dbId))
  } finally {
    client.release()
  }
})

router.get('/city/settings', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const { rows: settingsRows } = await client.query(`SELECT * FROM city_settings WHERE id = 1`)
    const settings = settingsRows[0] || null
    let { rows: schedule } = await client.query(`SELECT * FROM city_prayer_schedule ORDER BY prayer_name`)

    const city = normalizeCityName(req.query.city || settings?.city || 'Delhi')
    const dateYmd = String(req.query.date || formatDateYmd(new Date())).slice(0, 10)
    const dayRow = await getCityDay(client, city, dateYmd)
    const day = dayRowToScheduleAndExtras(dayRow)

    // Prefer per-day windows when available (365-day calendar).
    if (day?.schedule?.length) {
      schedule = day.schedule
      if (settings) {
        settings.sunrise = day.sunrise
        settings.fajr_namaz_end = day.fajr_namaz_end
        settings.zawal_start = day.zawal_start
        settings.zawal_end = day.zawal_end
        settings.tahajjud_start = day.nightTimings.tahajjud.start
        settings.tahajjud_end = day.nightTimings.tahajjud.end
        settings.sehri_start = day.nightTimings.sehri.start
        settings.sehri_end = day.nightTimings.sehri.end
      }
    }

    const year = Number(dateYmd.slice(0, 4)) || new Date().getFullYear()
    const daysInYear = await countCityDays(client, city, year)

    res.json({
      settings,
      schedule,
      day,
      date: dateYmd,
      city,
      yearDaysLoaded: daysInYear,
    })
  } finally {
    client.release()
  }
})

router.get('/city/days', async (req, res) => {
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
      from,
      to,
      count: rows.length,
      yearDaysLoaded: await countCityDays(client, city, year),
      today: formatDateYmd(new Date()),
      days: rows.map((r) => dayRowToScheduleAndExtras(r)),
    })
  } finally {
    client.release()
  }
})

router.get('/live-azan', async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    res.json(await buildLiveAzanFeeds(client))
  } finally {
    client.release()
  }
})

// All mosques currently broadcasting azan (used to light up LIVE badges).
router.get('/live-azan/sessions', async (_req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    res.json({ sessions: await getLiveSessions(client), serverTime: new Date().toISOString() })
  } finally {
    client.release()
  }
})

// Subscriber (listener) credentials to join a mosque's live azan channel.
// Returns 404 when the mosque is not currently broadcasting.
router.get('/mosques/:id/azan/listen', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    const dbId = await resolveMosqueDbId(client, req.params.id)
    if (!dbId) return res.status(404).json({ error: 'Mosque not found' })
    const session = await getLiveSessionForMosque(client, dbId)
    if (!session) {
      const recording = await getLatestRecording(client, dbId)
      return res.status(404).json({ error: 'Not live', recording: recording?.recording_url || null })
    }
    res.json({
      sessionId: session.id,
      channel: session.channel,
      agora: buildAgoraCredentials(session.channel, 'subscriber', 0),
    })
  } finally {
    client.release()
  }
})

router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {}
    const answer = await askOpenAiIslamicQuestion(message, history)
    res.json({ answer, provider: 'openai' })
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: error.message, code: error.code })
    }
    if (error.code === 'INVALID_MESSAGE') {
      return res.status(400).json({ error: error.message, code: error.code })
    }
    console.error('Chat error:', error.status || error.code, error.detail || error.message)
    res.status(502).json({
      error: 'Unable to get an AI response right now. Please try again.',
      code: error.code || 'AI_ERROR',
    })
  }
})

export default router
