export const CORRECTION_TOPICS = ['jamaat', 'juma', 'address', 'phone', 'facilities', 'other']
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const STATUSES = ['pending', 'fixed', 'dismissed']

/** One person can have this many open reports per mosque, and send this many per day overall. */
export const MAX_OPEN_PER_MOSQUE = 3
export const MAX_PER_DAY = 10

const SELECT_CORRECTIONS = `
  SELECT c.id, c.topic, c.prayer, c.suggestion, c.note, c.status, c.created_at, c.resolved_at,
         c.mosque_id AS mosque_db_id, c.user_id,
         COALESCE(m.legacy_id::text, m.id::text) AS public_id, m.name AS mosque_name,
         u.full_name AS reporter_name
  FROM mosque_corrections c
  INNER JOIN mosques m ON m.id = c.mosque_id
  LEFT JOIN users u ON u.id = c.user_id`

export function correctionFromRow(row) {
  return {
    id: String(row.id),
    mosqueId: String(row.public_id),
    mosqueName: row.mosque_name || '',
    topic: row.topic,
    prayer: row.prayer || null,
    suggestion: row.suggestion || '',
    note: row.note || '',
    status: row.status,
    reporterName: String(row.reporter_name || '').trim().split(/\s+/)[0] || '',
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  }
}

/** Returns `{ error }` for bad input, otherwise the cleaned fields. */
export function correctionFieldsFromBody(body) {
  const topic = String(body?.topic || '')
  if (!CORRECTION_TOPICS.includes(topic)) return { error: 'Pick what needs correcting' }
  const prayer = topic === 'jamaat' ? String(body?.prayer || '') : null
  if (topic === 'jamaat' && !PRAYERS.includes(prayer)) return { error: 'Pick the prayer' }
  const suggestion = String(body?.suggestion || '').trim().slice(0, 500)
  const note = String(body?.note || '').trim().slice(0, 1000)
  if (!suggestion && !note) return { error: 'Tell us the right detail' }
  return { topic, prayer, suggestion, note }
}

export function isCorrectionStatus(value) {
  return STATUSES.includes(value)
}

/** Explains why a report is refused, or null when it may be sent. */
export async function correctionLimitReason(client, userId, mosqueDbId) {
  const { rows: open } = await client.query(
    `SELECT COUNT(*)::int AS count FROM mosque_corrections
     WHERE user_id = $1 AND mosque_id = $2 AND status = 'pending'`,
    [userId, mosqueDbId],
  )
  if ((open[0]?.count ?? 0) >= MAX_OPEN_PER_MOSQUE) {
    return 'You already have reports waiting for this mosque. The admin will review them soon.'
  }
  const { rows: today } = await client.query(
    `SELECT COUNT(*)::int AS count FROM mosque_corrections WHERE user_id = $1 AND created_at >= $2`,
    [userId, new Date(Date.now() - 24 * 60 * 60 * 1000)],
  )
  if ((today[0]?.count ?? 0) >= MAX_PER_DAY) return 'You have sent many reports today. Please try again tomorrow.'
  return null
}

export async function fetchCorrectionById(client, id) {
  const { rows } = await client.query(`${SELECT_CORRECTIONS} WHERE c.id = $1`, [id])
  return rows[0] || null
}

export async function listCorrectionsForMosque(client, mosqueDbId, status = 'pending') {
  const params = [mosqueDbId]
  let where = 'WHERE c.mosque_id = $1'
  if (isCorrectionStatus(status)) {
    params.push(status)
    where += ' AND c.status = $2'
  }
  const { rows } = await client.query(`${SELECT_CORRECTIONS} ${where} ORDER BY c.created_at DESC LIMIT 100`, params)
  return rows.map(correctionFromRow)
}

/** App owner view. `unmanaged` keeps only mosques that have no assigned admin. */
export async function listCorrectionsForOwner(client, { status = 'pending', unmanaged = true } = {}) {
  const params = []
  const clauses = []
  if (isCorrectionStatus(status)) {
    params.push(status)
    clauses.push(`c.status = $${params.length}`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const { rows } = await client.query(`${SELECT_CORRECTIONS} ${where} ORDER BY c.created_at DESC LIMIT 500`, params)
  if (!unmanaged) return rows.slice(0, 200).map(correctionFromRow)
  const { rows: assigned } = await client.query('SELECT DISTINCT mosque_id FROM mosque_assignments')
  const managed = new Set(assigned.map((r) => String(r.mosque_id)))
  return rows
    .filter((row) => !managed.has(String(row.mosque_db_id)))
    .slice(0, 200)
    .map(correctionFromRow)
}

/** The mosque's own admins, or every app owner when nobody is assigned. */
export async function correctionReviewerIds(client, mosqueDbId) {
  const { rows: managers } = await client.query(
    `SELECT a.user_id FROM mosque_assignments a
     INNER JOIN users u ON u.id = a.user_id
     WHERE a.mosque_id = $1 AND u.is_active = TRUE`,
    [mosqueDbId],
  )
  if (managers.length) return managers.map((r) => r.user_id)
  const { rows: owners } = await client.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`)
  return owners.map((r) => r.id)
}

const TOPIC_LABEL = {
  jamaat: 'jamaat time',
  juma: 'Juma time',
  address: 'address',
  phone: 'phone number',
  facilities: 'facilities',
  other: 'details',
}

export function correctionSummary(fields) {
  const what = fields.topic === 'jamaat' ? `${fields.prayer} ${TOPIC_LABEL.jamaat}` : TOPIC_LABEL[fields.topic]
  return fields.suggestion ? `${what}: ${fields.suggestion}` : what
}
