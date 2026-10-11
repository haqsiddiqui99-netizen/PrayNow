import { randomUUID } from 'node:crypto'

const TYPES = new Set(['timings', 'announcement', 'azan_alert', 'facilities'])

/**
 * Fan-out in-app notifications + Expo push to all subscribers of a mosque.
 * @param {import('pg').PoolClient} client
 * @param {string} mosqueDbId
 * @param {{ type: 'timings'|'announcement'|'azan_alert'|'facilities', title: string, body?: string, voiceNoteId?: string|null }} payload
 */
export async function notifyMosqueSubscribers(client, mosqueDbId, payload) {
  const type = TYPES.has(payload.type) ? payload.type : 'timings'
  const title = String(payload.title || 'Mosque update').slice(0, 255)
  const body = String(payload.body || '')
  const voiceNoteId = payload.voiceNoteId || null

  const { rows: subs } = await client.query(
    `SELECT user_id FROM mosque_subscriptions WHERE mosque_id = $1`,
    [mosqueDbId],
  )
  if (!subs.length) return { notified: 0 }

  for (const sub of subs) {
    await client.query(
      `INSERT INTO notifications (id, user_id, mosque_id, type, title, body, voice_note_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), sub.user_id, mosqueDbId, type, title, body, voiceNoteId],
    )
  }

  const userIds = subs.map((s) => s.user_id)
  const { rows: tokens } = await client.query(
    `SELECT token FROM user_push_tokens WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  )

  if (tokens.length) {
    await sendExpoPush(
      tokens.map((t) => t.token),
      title,
      body || (voiceNoteId ? 'Voice note from your mosque' : ''),
      { type, mosqueId: mosqueDbId },
    )
  }

  return { notified: subs.length }
}

async function sendExpoPush(tokens, title, body, data = {}) {
  const messages = tokens
    .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'))
    .map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }))

  if (!messages.length) return

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[push] Expo push failed', res.status, text.slice(0, 200))
    }
  } catch (err) {
    console.warn('[push] Expo push error', err instanceof Error ? err.message : err)
  }
}
