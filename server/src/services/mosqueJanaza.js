const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

/** A janaza stays listed this long after its prayer time. */
const SHOW_AFTER_MS = 3 * 60 * 60 * 1000

const SELECT_JANAZA = `
  SELECT j.id, j.deceased_name, j.after_prayer, j.prayer_at, j.burial, j.note, j.created_at,
         COALESCE(m.legacy_id::text, m.id::text) AS public_id, m.name AS mosque_name
  FROM mosque_janaza j
  INNER JOIN mosques m ON m.id = j.mosque_id`

export function janazaFromRow(row) {
  return {
    id: String(row.id),
    mosqueId: String(row.public_id),
    mosqueName: row.mosque_name || '',
    deceasedName: row.deceased_name || '',
    afterPrayer: row.after_prayer || null,
    prayerAt: new Date(row.prayer_at).toISOString(),
    burial: row.burial || '',
    note: row.note || '',
    createdAt: new Date(row.created_at).toISOString(),
  }
}

/** Janazas still worth showing, soonest first; optionally for one mosque. */
export async function listActiveJanaza(client, mosqueDbId = null) {
  const params = [new Date(Date.now() - SHOW_AFTER_MS)]
  let where = 'WHERE j.prayer_at >= $1'
  if (mosqueDbId) {
    params.push(mosqueDbId)
    where += ' AND j.mosque_id = $2'
  }
  const { rows } = await client.query(`${SELECT_JANAZA} ${where} ORDER BY j.prayer_at ASC LIMIT 200`, params)
  return rows.map(janazaFromRow)
}

export async function fetchJanazaById(client, id) {
  const { rows } = await client.query(`${SELECT_JANAZA} WHERE j.id = $1`, [id])
  return rows[0] ? janazaFromRow(rows[0]) : null
}

/** Returns `{ error }` for bad input, otherwise the cleaned fields. */
export function janazaFieldsFromBody(body) {
  const deceasedName = String(body?.deceasedName || '').trim().slice(0, 160)
  const afterPrayer = body?.afterPrayer ? String(body.afterPrayer) : null
  if (afterPrayer && !PRAYERS.includes(afterPrayer)) return { error: 'Pick a prayer' }
  const prayerAt = new Date(String(body?.prayerAt || ''))
  if (Number.isNaN(prayerAt.getTime())) return { error: 'Pick the janaza time' }
  const now = Date.now()
  if (prayerAt.getTime() < now - 30 * 60 * 1000) return { error: 'That time has already passed' }
  if (prayerAt.getTime() > now + 3 * 24 * 60 * 60 * 1000) return { error: 'Pick a time within the next 3 days' }
  const burial = String(body?.burial || '').trim().slice(0, 255)
  const note = String(body?.note || '').trim().slice(0, 1000)
  return { deceasedName, afterPrayer, prayerAt, burial, note }
}
