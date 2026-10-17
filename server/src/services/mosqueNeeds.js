export const NEED_KINDS = ['volunteers', 'fundraising', 'items', 'other']

const SELECT_NEEDS = `
  SELECT n.id, n.kind, n.title, n.details, n.link, n.status, n.created_at, n.updated_at,
         COALESCE(m.legacy_id::text, m.id::text) AS public_id
  FROM mosque_needs n
  INNER JOIN mosques m ON m.id = n.mosque_id`

export function needFromRow(row) {
  return {
    id: String(row.id),
    mosqueId: String(row.public_id),
    kind: row.kind,
    title: row.title,
    details: row.details || '',
    link: row.link || '',
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function listNeeds(client, mosqueDbId, { includeClosed = false } = {}) {
  const where = includeClosed ? 'WHERE n.mosque_id = $1' : `WHERE n.mosque_id = $1 AND n.status = 'open'`
  const { rows } = await client.query(`${SELECT_NEEDS} ${where} ORDER BY n.updated_at DESC LIMIT 50`, [mosqueDbId])
  const needs = rows.map(needFromRow)
  return [...needs.filter((n) => n.status === 'open'), ...needs.filter((n) => n.status !== 'open')]
}

export async function fetchNeedById(client, id) {
  const { rows } = await client.query(`${SELECT_NEEDS} WHERE n.id = $1`, [id])
  return rows[0] ? needFromRow(rows[0]) : null
}

/** Only plain https links, so a need can never open an app scheme or a script URL. */
function cleanLink(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString().slice(0, 500) : null
  } catch {
    return null
  }
}

/** Returns `{ error }` for bad input, otherwise the cleaned fields. `partial` allows updates of single fields. */
export function needFieldsFromBody(body, { partial = false } = {}) {
  const out = {}
  if (!partial || body?.kind !== undefined) {
    const kind = String(body?.kind || '')
    if (!NEED_KINDS.includes(kind)) return { error: 'Pick what kind of help is needed' }
    out.kind = kind
  }
  if (!partial || body?.title !== undefined) {
    const title = String(body?.title || '').trim().slice(0, 160)
    if (!title) return { error: 'Give it a short title' }
    out.title = title
  }
  if (!partial || body?.details !== undefined) out.details = String(body?.details || '').trim().slice(0, 1000)
  if (!partial || body?.link !== undefined) {
    const link = cleanLink(body?.link)
    if (link === null) return { error: 'Links must start with https://' }
    out.link = link
  }
  if (body?.status !== undefined) {
    const status = String(body.status)
    if (status !== 'open' && status !== 'closed') return { error: 'Status must be open or closed' }
    out.status = status
  }
  return out
}
