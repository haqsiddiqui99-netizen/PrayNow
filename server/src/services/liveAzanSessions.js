import { randomUUID } from 'node:crypto'
import { channelForMosque } from './agora.js'

/**
 * Live azan session state management.
 * A mosque has at most one 'live' session at a time.
 */

/** Return the active (live) session for a mosque, or null. */
export async function getLiveSessionForMosque(client, mosqueDbId) {
  const { rows } = await client.query(
    `SELECT * FROM mosque_live_azan_sessions
     WHERE mosque_id = $1 AND status = 'live'
     ORDER BY started_at DESC LIMIT 1`,
    [mosqueDbId],
  )
  return rows[0] || null
}

/**
 * Start (or return the existing) live session for a mosque.
 * Ends any stale live sessions for the same mosque first.
 */
export async function startSession(client, { mosqueDbId, prayerName = null, userId = null }) {
  await client.query(
    `UPDATE mosque_live_azan_sessions
     SET status = 'ended', ended_at = NOW()
     WHERE mosque_id = $1 AND status = 'live'`,
    [mosqueDbId],
  )

  const id = randomUUID()
  const channel = channelForMosque(mosqueDbId)
  const { rows } = await client.query(
    `INSERT INTO mosque_live_azan_sessions (id, mosque_id, prayer_name, channel, started_by, status)
     VALUES ($1, $2, $3, $4, $5, 'live')
     RETURNING *`,
    [id, mosqueDbId, prayerName, channel, userId],
  )
  return rows[0]
}

/** End the live session for a mosque, optionally attaching a recording URL. */
export async function stopSession(client, { mosqueDbId, recordingUrl = null }) {
  const { rows } = await client.query(
    `UPDATE mosque_live_azan_sessions
     SET status = 'ended', ended_at = NOW(),
         recording_url = COALESCE($2, recording_url)
     WHERE mosque_id = $1 AND status = 'live'
     RETURNING *`,
    [mosqueDbId, recordingUrl],
  )
  return rows[0] || null
}

/** All currently live sessions joined with mosque details. */
export async function getLiveSessions(client) {
  const { rows } = await client.query(
    `SELECT s.id, s.channel, s.prayer_name, s.listeners, s.started_at,
            m.id AS mosque_db_id, m.legacy_id, m.name AS mosque_name, m.area, m.city,
            m.lat, m.lng
     FROM mosque_live_azan_sessions s
     INNER JOIN mosques m ON m.id = s.mosque_id
     WHERE s.status = 'live'
     ORDER BY s.started_at DESC`,
  )
  return rows.map((r) => ({
    sessionId: r.id,
    mosqueId: r.legacy_id || r.mosque_db_id,
    mosqueDbId: r.mosque_db_id,
    mosqueName: r.mosque_name,
    area: r.area,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    prayerName: r.prayer_name,
    channel: r.channel,
    listeners: r.listeners,
    startedAt: r.started_at,
  }))
}

/** The most recent ended session with a recording, for a mosque. */
export async function getLatestRecording(client, mosqueDbId) {
  const { rows } = await client.query(
    `SELECT id, recording_url, prayer_name, started_at, ended_at
     FROM mosque_live_azan_sessions
     WHERE mosque_id = $1 AND recording_url IS NOT NULL
     ORDER BY ended_at DESC NULLS LAST, started_at DESC LIMIT 1`,
    [mosqueDbId],
  )
  return rows[0] || null
}
