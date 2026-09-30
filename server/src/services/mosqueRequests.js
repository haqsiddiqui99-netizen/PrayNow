import { randomUUID } from 'node:crypto'

/** Keeps a single submission comfortably inside the 10mb express.json limit. */
export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 1_200_000
export const MAX_TOTAL_PHOTO_BYTES = 5_000_000

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const DATA_URL_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.*)$/i

class RequestValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = 400
  }
}

export function isValidationError(err) {
  return err instanceof RequestValidationError
}

function text(value, { field, max, required = false }) {
  const trimmed = String(value ?? '').trim()
  if (required && !trimmed) throw new RequestValidationError(`${field} is required`)
  if (trimmed.length > max) throw new RequestValidationError(`${field} must be ${max} characters or fewer`)
  return trimmed
}

function coordinate(value, { field, limit }) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) throw new RequestValidationError(`${field} must be a number`)
  if (Math.abs(num) > limit) throw new RequestValidationError(`${field} is out of range`)
  return num
}

/**
 * Accepts either a bare base64 string or a `data:` URL and returns the decoded
 * bytes. Re-encoding the buffer is how we reject payloads that only look like
 * base64 — `Buffer.from` silently drops invalid characters instead of throwing.
 */
function decodePhoto(entry, index) {
  const raw = typeof entry === 'string' ? entry : entry?.data
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new RequestValidationError(`Photo ${index + 1} is empty`)
  }

  let contentType = typeof entry === 'object' && entry?.contentType ? String(entry.contentType) : ''
  let base64 = raw.trim()

  const match = DATA_URL_RE.exec(base64)
  if (match) {
    contentType = match[1].toLowerCase()
    base64 = match[2]
  }
  if (!contentType) contentType = 'image/jpeg'
  contentType = contentType.toLowerCase()

  if (!ALLOWED_PHOTO_TYPES.includes(contentType)) {
    throw new RequestValidationError(
      `Photo ${index + 1} must be a JPEG, PNG or WebP image`,
    )
  }

  const data = Buffer.from(base64, 'base64')
  if (data.length === 0) throw new RequestValidationError(`Photo ${index + 1} could not be decoded`)
  if (data.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw new RequestValidationError(`Photo ${index + 1} is not valid base64`)
  }
  if (data.length > MAX_PHOTO_BYTES) {
    throw new RequestValidationError(
      `Photo ${index + 1} is ${Math.round(data.length / 1024)}KB — the limit is ${Math.round(MAX_PHOTO_BYTES / 1024)}KB`,
    )
  }
  return { contentType, data }
}

/** Validates the submit payload, throwing RequestValidationError on bad input. */
export function normalizeRequestInput(body) {
  const photosInput = body?.photos
  if (photosInput !== undefined && !Array.isArray(photosInput)) {
    throw new RequestValidationError('photos must be an array')
  }
  const list = photosInput ?? []
  if (list.length > MAX_PHOTOS) {
    throw new RequestValidationError(`Attach at most ${MAX_PHOTOS} photos`)
  }

  const photos = list.map(decodePhoto)
  const totalBytes = photos.reduce((sum, p) => sum + p.data.length, 0)
  if (totalBytes > MAX_TOTAL_PHOTO_BYTES) {
    throw new RequestValidationError(
      `Photos total ${Math.round(totalBytes / 1024)}KB — the limit is ${Math.round(MAX_TOTAL_PHOTO_BYTES / 1024)}KB`,
    )
  }

  const mobileDigits = String(body?.ownerMobile ?? '').replace(/\D/g, '')
  if (mobileDigits.length < 10 || mobileDigits.length > 15) {
    throw new RequestValidationError('Owner mobile must be 10 to 15 digits')
  }

  const ownerEmail = text(body?.ownerEmail, { field: 'Owner email', max: 255 })
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new RequestValidationError('Owner email is not a valid address')
  }

  return {
    name: text(body?.name, { field: 'Mosque name', max: 255, required: true }),
    address: text(body?.address, { field: 'Address', max: 2000, required: true }),
    area: text(body?.area, { field: 'Area', max: 255 }),
    city: text(body?.city, { field: 'City', max: 128 }),
    lat: coordinate(body?.lat, { field: 'Latitude', limit: 90 }),
    lng: coordinate(body?.lng, { field: 'Longitude', limit: 180 }),
    ownerName: text(body?.ownerName, { field: 'Owner name', max: 255, required: true }),
    ownerMobile: mobileDigits,
    ownerEmail,
    notes: text(body?.notes, { field: 'Notes', max: 2000 }),
    photos,
  }
}

export async function insertMosqueRequest(client, userId, input) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO mosque_requests
       (id, submitted_by, name, address, area, city, lat, lng,
        owner_name, owner_mobile, owner_email, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id, userId, input.name, input.address, input.area, input.city, input.lat, input.lng,
      input.ownerName, input.ownerMobile, input.ownerEmail, input.notes,
    ],
  )
  for (const [index, photo] of input.photos.entries()) {
    await client.query(
      `INSERT INTO mosque_request_photos (id, request_id, content_type, byte_size, sort_order, data)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), id, photo.contentType, photo.data.length, index, photo.data],
    )
  }
  return id
}

/** Public URL for a stored photo. Kept relative so it works on LAN and prod alike. */
export function photoUrl(photoId) {
  return `/api/mosque-requests/photos/${photoId}`
}

function mapRequestRow(row, photoIds = []) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    area: row.area || '',
    city: row.city || '',
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    ownerName: row.owner_name,
    ownerMobile: row.owner_mobile,
    ownerEmail: row.owner_email || '',
    notes: row.notes || '',
    status: row.status,
    reviewNote: row.review_note || '',
    reviewedAt: row.reviewed_at,
    createdMosqueId: row.created_mosque_id || null,
    submittedByName: row.submitted_by_name || '',
    submittedByMobile: row.submitted_by_mobile || '',
    createdAt: row.created_at,
    photoUrls: photoIds.map(photoUrl),
  }
}

async function attachPhotos(client, rows) {
  const result = []
  for (const row of rows) {
    const { rows: photoRows } = await client.query(
      `SELECT id FROM mosque_request_photos WHERE request_id = $1 ORDER BY sort_order`,
      [row.id],
    )
    result.push(mapRequestRow(row, photoRows.map((p) => p.id)))
  }
  return result
}

export async function listRequestsForUser(client, userId) {
  const { rows } = await client.query(
    `SELECT * FROM mosque_requests WHERE submitted_by = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  )
  return attachPhotos(client, rows)
}

export async function listRequestsForAdmin(client, status) {
  const params = []
  let where = ''
  if (status && status !== 'all') {
    where = 'WHERE r.status = $1'
    params.push(status)
  }
  const { rows } = await client.query(
    `SELECT r.*, u.full_name AS submitted_by_name, u.mobile AS submitted_by_mobile
     FROM mosque_requests r
     LEFT JOIN users u ON u.id = r.submitted_by
     ${where}
     ORDER BY r.created_at DESC
     LIMIT 200`,
    params,
  )
  return attachPhotos(client, rows)
}

export async function fetchRequestById(client, id) {
  const { rows } = await client.query(`SELECT * FROM mosque_requests WHERE id = $1`, [id])
  return rows[0] || null
}

/**
 * Returns the photo plus the status of its request, so callers can keep
 * unreviewed submissions admin-only while approved photos stay public.
 */
export async function fetchPhotoWithStatus(client, photoId) {
  const { rows } = await client.query(
    `SELECT p.data, p.content_type, r.status
     FROM mosque_request_photos p
     INNER JOIN mosque_requests r ON r.id = p.request_id
     WHERE p.id = $1`,
    [photoId],
  )
  return rows[0] || null
}

export async function markRequestReviewed(client, id, { status, reviewNote, reviewerId, mosqueId = null }) {
  await client.query(
    `UPDATE mosque_requests
     SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW(),
         created_mosque_id = COALESCE($5, created_mosque_id), updated_at = NOW()
     WHERE id = $1`,
    [id, status, reviewNote, reviewerId, mosqueId],
  )
}

export async function requestPhotoIds(client, requestId) {
  const { rows } = await client.query(
    `SELECT id FROM mosque_request_photos WHERE request_id = $1 ORDER BY sort_order`,
    [requestId],
  )
  return rows.map((r) => r.id)
}
