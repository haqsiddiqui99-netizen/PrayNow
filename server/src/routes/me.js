import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import { resolveMosqueDbId } from '../services/mosques.js'
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  fetchPhotoWithStatus,
  insertMosqueRequest,
  isValidationError,
  listRequestsForUser,
  normalizeRequestInput,
} from '../services/mosqueRequests.js'

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

router.get('/me/subscriptions', authMiddleware, async (req, res) => {
  try {
    const mosqueIds = await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT COALESCE(m.legacy_id, m.id::text) AS mosque_id
         FROM mosque_subscriptions s
         INNER JOIN mosques m ON m.id = s.mosque_id
         WHERE s.user_id = $1`,
        [req.user.sub],
      )
      return rows.map((r) => String(r.mosque_id))
    })
    res.json({ mosqueIds })
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
        `SELECT n.id, n.type, n.title, n.body, n.read_at, n.created_at,
                COALESCE(m.legacy_id, m.id::text) AS mosque_id,
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
