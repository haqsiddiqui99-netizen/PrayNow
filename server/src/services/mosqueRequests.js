import { randomUUID } from 'node:crypto'
import { isMemoryDatabase } from '../db/memory.js'

/** Keeps a single submission comfortably inside the 10mb express.json limit. */
export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 1_200_000
export const MAX_TOTAL_PHOTO_BYTES = 5_000_000

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const FACILITY_OPTIONS = [
  'Wudu Area',
  'Washroom',
  'Parking',
  'Two-wheeler parking',
  'Four-wheeler parking',
  'WiFi',
  'Wheelchair access',
  'Chairs available',
  'Drinking water',
  'Women section',
  'Library',
  'AC',
]

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

/** pg-mem can return TEXT[] as the literal '{}' / '{a,b}' instead of an array. */
function parseTextArray(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return []
  const inner = value.trim().replace(/^\{|\}$/g, '')
  return inner ? inner.split(',').map((item) => item.replace(/^"|"$/g, '').trim()).filter(Boolean) : []
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function cleanClock(value, label) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) throw new RequestValidationError(`${label} is not a clock time`)
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) throw new RequestValidationError(`${label} is not a clock time`)
  return `${hour}:${match[2]} ${match[3].toUpperCase()}`
}

function prayerTimings(body) {
  const source = body?.timings && typeof body.timings === 'object' ? body.timings : {}
  const timings = {}
  for (const name of PRAYER_NAMES) {
    const slot = source[name] && typeof source[name] === 'object' ? source[name] : {}
    timings[name] = {
      azan: name === 'Maghrib' ? '' : cleanClock(slot.azan, `${name} azan`),
      jamat: cleanClock(slot.jamat, `${name} jamat`),
    }
  }
  return timings
}

function maghribOffset(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 45) {
    throw new RequestValidationError('Maghrib minutes after sunset must be a whole number from 0 to 45')
  }
  return n
}

function nightTimes(body) {
  const night = body?.nightTimings && typeof body.nightTimings === 'object' ? body.nightTimings : {}
  const sehriEnd = night.sehriEnd ?? night.sehri?.end
  return {
    sehriEnd: cleanClock(sehriEnd, 'Sehri'),
    iftar: cleanClock(night.iftar, 'Iftar'),
  }
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function facilities(value) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new RequestValidationError('facilities must be an array')
  const allowed = new Set(FACILITY_OPTIONS)
  const picked = []
  for (const item of value) {
    const name = String(item ?? '').trim()
    if (!name) continue
    if (!allowed.has(name)) throw new RequestValidationError('Unknown facility')
    if (!picked.includes(name)) picked.push(name)
  }
  return picked
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
    facilities: facilities(body?.facilities),
    timings: prayerTimings(body),
    nightTimings: nightTimes(body),
    maghribOffsetMinutes: maghribOffset(body?.maghribOffsetMinutes),
    photos,
  }
}

/**
 * pg-mem reads BYTEA parameters as UTF-8 text, which corrupts image bytes, so the
 * in-memory DB keeps photos as base64 text. Real Postgres stores raw bytes.
 */
function storedPhotoData(bytes) {
  return isMemoryDatabase() ? bytes.toString('base64') : bytes
}

function photoBytes(stored) {
  if (!isMemoryDatabase()) return stored
  const text = Buffer.isBuffer(stored) ? stored.toString('utf8') : String(stored ?? '')
  return Buffer.from(text, 'base64')
}

export async function insertMosqueRequest(client, userId, input) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO mosque_requests
       (id, submitted_by, name, address, area, city, lat, lng,
        owner_name, owner_mobile, owner_email, notes, facilities,
        timings, night_timings, maghrib_offset_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      id, userId, input.name, input.address, input.area, input.city, input.lat, input.lng,
      input.ownerName, input.ownerMobile, input.ownerEmail, input.notes, input.facilities,
      JSON.stringify(input.timings),
      JSON.stringify(input.nightTimings),
      input.maghribOffsetMinutes,
    ],
  )
  for (const [index, photo] of input.photos.entries()) {
    await client.query(
      `INSERT INTO mosque_request_photos (id, request_id, content_type, byte_size, sort_order, data)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), id, photo.contentType, photo.data.length, index, storedPhotoData(photo.data)],
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
    facilities: parseTextArray(row.facilities),
    timings: parseJsonObject(row.timings),
    nightTimings: parseJsonObject(row.night_timings),
    maghribOffsetMinutes:
      row.maghrib_offset_minutes == null || row.maghrib_offset_minutes === ''
        ? null
        : Number(row.maghrib_offset_minutes),
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
  const row = rows[0]
  if (!row) return null
  return { ...row, data: photoBytes(row.data) }
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

/** Turns a stored request into the mosque timing rows written on approval. */
export function scheduleFromRequest(request) {
  const timings = parseJsonObject(request?.timings)
  const night = parseJsonObject(request?.night_timings)
  const slots = {}
  if (timings) {
    for (const name of PRAYER_NAMES) {
      const slot = timings[name] || {}
      slots[name] = { start: '', azan: slot.azan || '', jamat: slot.jamat || '', end: '' }
    }
  }
  const offset = request?.maghrib_offset_minutes
  const sehriEnd = night?.sehriEnd || ''
  const iftar = night?.iftar || ''
  return {
    timings: timings ? slots : null,
    night: sehriEnd || iftar
      ? { tahajjud: { start: '', end: '' }, sehri: { start: '', end: sehriEnd }, iftar }
      : null,
    maghribOffsetMinutes: offset == null || offset === '' ? null : Number(offset),
  }
}

export async function requestPhotoIds(client, requestId) {
  const { rows } = await client.query(
    `SELECT id FROM mosque_request_photos WHERE request_id = $1 ORDER BY sort_order`,
    [requestId],
  )
  return rows.map((r) => r.id)
}
