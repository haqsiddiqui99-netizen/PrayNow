const SELECT_EVENTS = `
  SELECT e.id, e.title, e.details, e.starts_at, e.weekly,
         COALESCE(m.legacy_id::text, m.id::text) AS public_id
  FROM mosque_events e
  INNER JOIN mosques m ON m.id = e.mosque_id`

/** Events that ended more than this long ago drop off the list. */
const GRACE_MS = 2 * 60 * 60 * 1000

export function eventFromRow(row) {
  return {
    id: String(row.id),
    mosqueId: String(row.public_id),
    title: row.title,
    details: row.details || '',
    startsAt: new Date(row.starts_at).toISOString(),
    weekly: Boolean(row.weekly),
  }
}

/** Weekly events plus one-off events that have not passed yet, soonest first. */
export async function listUpcomingEvents(client, mosqueDbId = null) {
  const params = [new Date(Date.now() - GRACE_MS)]
  let where = 'WHERE (e.weekly = TRUE OR e.starts_at >= $1)'
  if (mosqueDbId) {
    params.push(mosqueDbId)
    where += ' AND e.mosque_id = $2'
  }
  const { rows } = await client.query(`${SELECT_EVENTS} ${where} ORDER BY e.starts_at ASC LIMIT 500`, params)
  return rows.map(eventFromRow)
}

export async function fetchEventById(client, id) {
  const { rows } = await client.query(`${SELECT_EVENTS} WHERE e.id = $1`, [id])
  return rows[0] ? eventFromRow(rows[0]) : null
}

/** Returns `{ error }` for bad input, otherwise the cleaned fields. */
export function eventFieldsFromBody(body) {
  const title = String(body?.title || '').trim().slice(0, 160)
  const details = String(body?.details || '').trim().slice(0, 1000)
  const startsAt = new Date(String(body?.startsAt || ''))
  const weekly = Boolean(body?.weekly)
  if (!title) return { error: 'Give the event a title' }
  if (Number.isNaN(startsAt.getTime())) return { error: 'Pick a date and time' }
  const now = Date.now()
  if (!weekly && startsAt.getTime() < now - GRACE_MS) return { error: 'That time has already passed' }
  if (startsAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) return { error: 'Pick a date within the next year' }
  return { title, details, startsAt, weekly }
}
