import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import { fetchMosqueById, resolveMosqueDbId } from '../services/mosques.js'
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  fetchPhotoWithStatus,
  insertMosqueRequest,
  isValidationError,
  listRequestsForUser,
  normalizeRequestInput,
} from '../services/mosqueRequests.js'
import {
  correctionFieldsFromBody,
  correctionFromRow,
  correctionLimitReason,
  correctionReviewerIds,
  correctionSummary,
  fetchCorrectionById,
} from '../services/mosqueCorrections.js'
import { notifyUsers } from '../services/notifications.js'

const router = Router()
const pool = getPool()

async function withClient(fn) {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${process.env.PGSCHEMA || 'praynow'}, public`)
    return await fn(client)
  } finally {
    client.release()
  }
}

// Voice notes go to every subscriber of a mosque; the random id is the only key.
router.get('/voice-notes/:id', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).end()
  try {
    const note = await withClient(async (client) => {
      const { rows } = await client.query(`SELECT mime, audio FROM mosque_voice_notes WHERE id = $1`, [req.params.id])
      return rows[0] || null
    })
    if (!note) return res.status(404).end()
    res.setHeader('Content-Type', note.mime || 'audio/mp4')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.send(Buffer.from(note.audio, 'base64'))
  } catch (err) {
    console.error('voice note failed', err)
    res.status(500).end()
  }
})

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const JAMAAT_LEADS = [0, 5, 10, 15, 30]

function remindersFromRow(row) {
  const prayers = String(row.remind_prayers || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => PRAYER_KEYS.includes(p))
  return {
    jamaat: Boolean(row.remind_jamaat),
    lead: Number(row.jamaat_lead) || 0,
    azan: Boolean(row.remind_azan),
    leave: Boolean(row.remind_leave),
    travel: Number(row.travel_minutes) || 0,
    taraweeh: Boolean(row.remind_taraweeh),
    prayers,
  }
}

function reminderMosque(mosque) {
  if (!mosque) return null
  return { name: mosque.name, timings: mosque.timings, jumaTimings: mosque.jumaTimings, taraweeh: mosque.taraweeh }
}

function normalizeReminders(body) {
  const lead = Number(body?.lead)
  const prayers = Array.isArray(body?.prayers)
    ? PRAYER_KEYS.filter((p) => body.prayers.includes(p))
    : PRAYER_KEYS
  const travel = Math.round(Number(body?.travel))
  return {
    jamaat: Boolean(body?.jamaat),
    lead: JAMAAT_LEADS.includes(lead) ? lead : 10,
    azan: Boolean(body?.azan),
    leave: Boolean(body?.leave),
    travel: Number.isFinite(travel) ? Math.min(180, Math.max(0, travel)) : 0,
    taraweeh: Boolean(body?.taraweeh),
    prayers,
  }
}

router.get('/me/subscriptions', authMiddleware, async (req, res) => {
  try {
    const subscriptions = await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT s.mosque_id AS db_id, COALESCE(m.legacy_id::text, m.id::text) AS mosque_id,
                s.remind_jamaat, s.jamaat_lead, s.remind_azan, s.remind_prayers,
                s.remind_leave, s.travel_minutes, s.remind_taraweeh
         FROM mosque_subscriptions s
         INNER JOIN mosques m ON m.id = s.mosque_id
         WHERE s.user_id = $1`,
        [req.user.sub],
      )
      const list = []
      for (const row of rows) {
        const reminders = remindersFromRow(row)
        const wantsTimes = reminders.jamaat || reminders.azan || reminders.leave || reminders.taraweeh
        const mosque = wantsTimes ? await fetchMosqueById(client, row.db_id) : null
        list.push({ mosqueId: String(row.mosque_id), reminders, mosque: reminderMosque(mosque) })
      }
      return list
    })
    res.json({ mosqueIds: subscriptions.map((s) => s.mosqueId), subscriptions })
  } catch (err) {
    console.error('subscriptions list failed', err)
    res.status(500).json({ error: err.message || 'Failed to load subscriptions' })
  }
})

router.post('/me/subscriptions/:mosqueId', authMiddleware, async (req, res) => {
  try {
    const result = await withClient(async (client) => {
      const dbId = await resolveMosqueDbId(client, req.params.mosqueId)
      if (!dbId) return { notFound: true }
      await client.query(
        `INSERT INTO mosque_subscriptions (user_id, mosque_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, mosque_id) DO NOTHING`,
        [req.user.sub, dbId],
      )
      return { ok: true }
    })
    if (result.notFound) return res.status(404).json({ error: 'Mosque not found' })
    res.status(201).json({ ok: true, mosqueId: req.params.mosqueId })
  } catch (err) {
    console.error('subscribe failed', err)
    res.status(500).json({ error: err.message || 'Failed to subscribe' })
  }
})

router.put('/me/subscriptions/:mosqueId/reminders', authMiddleware, async (req, res) => {
  const reminders = normalizeReminders(req.body)
  try {
    const result = await withClient(async (client) => {
      const dbId = await resolveMosqueDbId(client, req.params.mosqueId)
      if (!dbId) return { notFound: true }
      await client.query(
        `INSERT INTO mosque_subscriptions
           (user_id, mosque_id, remind_jamaat, jamaat_lead, remind_azan, remind_prayers, remind_leave, travel_minutes,
            remind_taraweeh)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, mosque_id) DO UPDATE SET
           remind_jamaat = EXCLUDED.remind_jamaat,
           jamaat_lead = EXCLUDED.jamaat_lead,
           remind_azan = EXCLUDED.remind_azan,
           remind_prayers = EXCLUDED.remind_prayers,
           remind_leave = EXCLUDED.remind_leave,
           travel_minutes = EXCLUDED.travel_minutes,
           remind_taraweeh = EXCLUDED.remind_taraweeh`,
        [
          req.user.sub,
          dbId,
          reminders.jamaat,
          reminders.lead,
          reminders.azan,
          reminders.prayers.join(','),
          reminders.leave,
          reminders.travel,
          reminders.taraweeh,
        ],
      )
      return { mosque: reminderMosque(await fetchMosqueById(client, dbId)) }
    })
    if (result.notFound) return res.status(404).json({ error: 'Mosque not found' })
    res.json({ ok: true, mosqueId: req.params.mosqueId, reminders, mosque: result.mosque })
  } catch (err) {
    console.error('save reminders failed', err)
    res.status(500).json({ error: err.message || 'Failed to save reminders' })
  }
})

router.delete('/me/subscriptions/:mosqueId', authMiddleware, async (req, res) => {
  try {
    const result = await withClient(async (client) => {
      const dbId = await resolveMosqueDbId(client, req.params.mosqueId)
      if (!dbId) return { notFound: true }
      await client.query(
        `DELETE FROM mosque_subscriptions WHERE user_id = $1 AND mosque_id = $2`,
        [req.user.sub, dbId],
      )
      return { ok: true }
    })
    if (result.notFound) return res.status(404).json({ error: 'Mosque not found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('unsubscribe failed', err)
    res.status(500).json({ error: err.message || 'Failed to unsubscribe' })
  }
})

router.post('/me/push-token', authMiddleware, async (req, res) => {
  const token = String(req.body?.token || '').trim()
  const platform = String(req.body?.platform || 'unknown').slice(0, 32)
  if (!token) return res.status(400).json({ error: 'token required' })
  try {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO user_push_tokens (id, user_id, token, platform, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()`,
        [randomUUID(), req.user.sub, token, platform],
      )
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('push-token failed', err)
    res.status(500).json({ error: err.message || 'Failed to save push token' })
  }
})

router.get('/me/notifications', authMiddleware, async (req, res) => {
  try {
    const rows = await withClient(async (client) => {
      const { rows: list } = await client.query(
        `SELECT n.id, n.type, n.title, n.body, n.read_at, n.created_at, n.voice_note_id,
                COALESCE(m.legacy_id::text, m.id::text) AS mosque_id,
                m.name AS mosque_name
         FROM notifications n
         LEFT JOIN mosques m ON m.id = n.mosque_id
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT 100`,
        [req.user.sub],
      )
      return list.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        mosqueId: r.mosque_id ? String(r.mosque_id) : null,
        mosqueName: r.mosque_name || '',
        voiceNotePath: r.voice_note_id ? `/api/voice-notes/${r.voice_note_id}` : null,
        read: Boolean(r.read_at),
        createdAt: r.created_at,
      }))
    })
    res.json({ notifications: rows, unreadCount: rows.filter((r) => !r.read).length })
  } catch (err) {
    console.error('notifications list failed', err)
    res.status(500).json({ error: err.message || 'Failed to load notifications' })
  }
})

router.post('/me/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await withClient(async (client) => {
      await client.query(
        `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.sub],
      )
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

router.post('/me/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await withClient(async (client) => {
      await client.query(
        `UPDATE notifications SET read_at = NOW()
         WHERE user_id = $1 AND read_at IS NULL`,
        [req.user.sub],
      )
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

// --- User-submitted "please add this mosque" requests ---

router.get('/me/mosque-requests', authMiddleware, async (req, res) => {
  try {
    const requests = await withClient((client) => listRequestsForUser(client, req.user.sub))
    res.json({ requests, limits: { maxPhotos: MAX_PHOTOS, maxPhotoBytes: MAX_PHOTO_BYTES } })
  } catch (err) {
    console.error('mosque requests list failed', err)
    res.status(500).json({ error: err.message || 'Failed to load your requests' })
  }
})

router.post('/me/mosque-requests', authMiddleware, async (req, res) => {
  let input
  try {
    input = normalizeRequestInput(req.body || {})
  } catch (err) {
    if (isValidationError(err)) return res.status(400).json({ error: err.message })
    throw err
  }
  try {
    const id = await withClient((client) => insertMosqueRequest(client, req.user.sub, input))
    res.status(201).json({ ok: true, id, status: 'pending' })
  } catch (err) {
    console.error('mosque request submit failed', err)
    res.status(500).json({ error: err.message || 'Failed to submit request' })
  }
})

/**
 * Photos of approved requests are public because they end up on the mosque
 * profile; anything still pending or rejected stays visible to admins only.
 */
// A follower reports a wrong time or detail; the mosque admin (or app owner) is told.
router.post('/mosques/:id/corrections', authMiddleware, async (req, res) => {
  const fields = correctionFieldsFromBody(req.body)
  if (fields.error) return res.status(400).json({ error: fields.error })
  try {
    const result = await withClient(async (client) => {
      const dbId = await resolveMosqueDbId(client, req.params.id)
      if (!dbId) return { status: 404, error: 'Mosque not found' }
      const limit = await correctionLimitReason(client, req.user.sub, dbId)
      if (limit) return { status: 429, error: limit }
      const id = randomUUID()
      await client.query(
        `INSERT INTO mosque_corrections (id, mosque_id, user_id, topic, prayer, suggestion, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, dbId, req.user.sub, fields.topic, fields.prayer, fields.suggestion, fields.note],
      )
      const row = await fetchCorrectionById(client, id)
      try {
        const reviewers = (await correctionReviewerIds(client, dbId)).filter((uid) => String(uid) !== String(req.user.sub))
        await notifyUsers(client, reviewers, dbId, {
          type: 'correction',
          title: `Correction for ${row.mosque_name}`.slice(0, 255),
          body: `${correctionSummary(fields)}${fields.note ? ` · ${fields.note}` : ''}`.slice(0, 500),
        })
      } catch (err) {
        console.warn('[notify] correction alert failed', err instanceof Error ? err.message : err)
      }
      return { correction: correctionFromRow(row) }
    })
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.status(201).json(result)
  } catch (err) {
    console.error('correction submit failed', err)
    res.status(500).json({ error: err.message || 'Failed to send the correction' })
  }
})

router.get('/mosque-requests/photos/:photoId', optionalAuthMiddleware, async (req, res) => {
  try {
    const photo = await withClient((client) => fetchPhotoWithStatus(client, req.params.photoId))
    if (!photo) return res.status(404).json({ error: 'Photo not found' })
    if (photo.status !== 'approved' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.setHeader('Content-Type', photo.content_type || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(photo.data)
  } catch (err) {
    console.error('mosque request photo failed', err)
    res.status(500).json({ error: err.message || 'Failed to load photo' })
  }
})

export default router
