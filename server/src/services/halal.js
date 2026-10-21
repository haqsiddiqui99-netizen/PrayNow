import { randomUUID } from 'node:crypto'

export const HALAL_CATEGORIES = [
  'restaurant',
  'meat',
  'bakery',
  'grocery',
  'perfume',
  'cosmetics',
  'modest',
  'books',
  'travel',
  'janazah',
]

export const HALAL_REQUEST_STATUSES = ['new', 'contacted', 'listed', 'declined']

const LISTING_COLUMNS = `id, category, name, tagline, description, area, address, city, lat, lng, phone, whatsapp,
  website, photo_url, tags, price_level, delivers, cert_body, cert_number, cert_valid_until, verified,
  featured, featured_until, sort_boost, is_active, views, contacts, created_at, updated_at`

function todayYmd() {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** A featured spot with an end date lapses on its own, so an unpaid renewal never stays on top. */
function featuredNow(row) {
  if (!row.featured) return false
  return !row.featured_until || row.featured_until >= todayYmd()
}

function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function num(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function listingFromRow(row, { admin = false } = {}) {
  const out = {
    id: String(row.id),
    category: row.category,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description || '',
    area: row.area || '',
    address: row.address || '',
    city: row.city || '',
    lat: num(row.lat),
    lng: num(row.lng),
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    website: row.website || '',
    photoUrl: row.photo_url || '',
    tags: splitTags(row.tags),
    priceLevel: Number(row.price_level) || 0,
    delivers: Boolean(row.delivers),
    certBody: row.cert_body || '',
    certNumber: row.cert_number || '',
    certValidUntil: row.cert_valid_until || '',
    verified: Boolean(row.verified),
    featured: featuredNow(row),
  }
  if (admin) {
    Object.assign(out, {
      featuredFlag: Boolean(row.featured),
      featuredUntil: row.featured_until || '',
      sortBoost: Number(row.sort_boost) || 0,
      isActive: Boolean(row.is_active),
      views: Number(row.views) || 0,
      contacts: Number(row.contacts) || 0,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    })
  }
  return out
}

function rankRows(rows) {
  return [...rows].sort(
    (a, b) =>
      Number(featuredNow(b)) - Number(featuredNow(a)) ||
      (Number(b.sort_boost) || 0) - (Number(a.sort_boost) || 0) ||
      Number(Boolean(b.verified)) - Number(Boolean(a.verified)) ||
      String(a.name).localeCompare(String(b.name)),
  )
}

export async function listPublicListings(client) {
  const { rows } = await client.query(
    `SELECT ${LISTING_COLUMNS} FROM halal_listings WHERE is_active = TRUE LIMIT 1000`,
  )
  return rankRows(rows).map((row) => listingFromRow(row))
}

export async function listAdminListings(client) {
  const { rows } = await client.query(`SELECT ${LISTING_COLUMNS} FROM halal_listings LIMIT 2000`)
  return rankRows(rows).map((row) => listingFromRow(row, { admin: true }))
}

export async function fetchListingById(client, id, { admin = false } = {}) {
  const { rows } = await client.query(`SELECT ${LISTING_COLUMNS} FROM halal_listings WHERE id = $1`, [id])
  return rows[0] ? listingFromRow(rows[0], { admin }) : null
}

/** Only plain https links, so a listing can never open an app scheme or a script URL. */
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

function cleanPhone(raw) {
  const text = String(raw || '').trim()
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  return (text.startsWith('+') ? `+${digits}` : digits).slice(0, 20)
}

function cleanDate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function cleanText(raw, max) {
  return String(raw ?? '').trim().slice(0, max)
}

/** Maps request body keys to columns. Returns `{ error }` for bad input, otherwise `{ fields }`. */
export function listingFieldsFromBody(body, { partial = false } = {}) {
  const b = body || {}
  const has = (key) => !partial || b[key] !== undefined
  const fields = {}

  if (has('category')) {
    if (!HALAL_CATEGORIES.includes(String(b.category))) return { error: 'Pick a category' }
    fields.category = String(b.category)
  }
  if (has('name')) {
    const name = cleanText(b.name, 160)
    if (!name) return { error: 'Name is required' }
    fields.name = name
  }
  if (has('tagline')) fields.tagline = cleanText(b.tagline, 200)
  if (has('description')) fields.description = cleanText(b.description, 2000)
  if (has('area')) fields.area = cleanText(b.area, 120)
  if (has('address')) fields.address = cleanText(b.address, 300)
  if (has('city')) fields.city = cleanText(b.city, 80)
  for (const key of ['lat', 'lng']) {
    if (!has(key)) continue
    const value = num(b[key])
    const limit = key === 'lat' ? 90 : 180
    if (value != null && Math.abs(value) > limit) return { error: `${key} is out of range` }
    fields[key] = value
  }
  if (has('phone')) fields.phone = cleanPhone(b.phone)
  if (has('whatsapp')) fields.whatsapp = cleanPhone(b.whatsapp)
  for (const [key, column] of [['website', 'website'], ['photoUrl', 'photo_url']]) {
    if (!has(key)) continue
    const link = cleanLink(b[key])
    if (link === null) return { error: 'Links must start with https://' }
    fields[column] = link
  }
  if (has('tags')) {
    const list = Array.isArray(b.tags) ? b.tags : splitTags(b.tags)
    fields.tags = list.map((tag) => cleanText(tag, 40).replace(/,/g, ' ')).filter(Boolean).slice(0, 8).join(',')
  }
  if (has('priceLevel')) fields.price_level = Math.max(0, Math.min(3, Math.round(Number(b.priceLevel) || 0)))
  if (has('delivers')) fields.delivers = Boolean(b.delivers)
  if (has('certBody')) fields.cert_body = cleanText(b.certBody, 160)
  if (has('certNumber')) fields.cert_number = cleanText(b.certNumber, 80)
  for (const [key, column] of [['certValidUntil', 'cert_valid_until'], ['featuredUntil', 'featured_until']]) {
    if (!has(key)) continue
    const date = cleanDate(b[key])
    if (date === null) return { error: 'Dates must look like 2026-12-31' }
    fields[column] = date
  }
  if (has('verified')) fields.verified = Boolean(b.verified)
  if (has('featured')) fields.featured = Boolean(b.featured)
  if (has('sortBoost')) fields.sort_boost = Math.max(-100, Math.min(100, Math.round(Number(b.sortBoost) || 0)))
  if (has('isActive')) fields.is_active = b.isActive === undefined ? true : Boolean(b.isActive)
  return { fields }
}

export async function insertListing(client, fields) {
  const id = randomUUID()
  const columns = Object.keys(fields)
  await client.query(
    `INSERT INTO halal_listings (id, ${columns.join(', ')}) VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})`,
    [id, ...columns.map((column) => fields[column])],
  )
  return id
}

export async function updateListing(client, id, fields) {
  const columns = Object.keys(fields)
  if (!columns.length) return true
  const { rowCount } = await client.query(
    `UPDATE halal_listings SET ${columns.map((column, i) => `${column} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
    [id, ...columns.map((column) => fields[column])],
  )
  return rowCount > 0
}

/** Counts opens and taps on call / WhatsApp / directions. These numbers are what a featured spot is sold on. */
export async function trackListing(client, id, kind) {
  const column = kind === 'contact' ? 'contacts' : 'views'
  await client.query(`UPDATE halal_listings SET ${column} = ${column} + 1 WHERE id = $1 AND is_active = TRUE`, [id])
}

export function requestFieldsFromBody(body) {
  const b = body || {}
  const businessName = cleanText(b.businessName, 160)
  if (!businessName) return { error: 'Business name is required' }
  const category = String(b.category || '')
  if (!HALAL_CATEGORIES.includes(category)) return { error: 'Pick a category' }
  const phone = cleanPhone(b.phone)
  if (phone.replace(/\D/g, '').length < 8) return { error: 'A phone number is required' }
  return {
    fields: {
      business_name: businessName,
      category,
      city: cleanText(b.city, 80),
      area: cleanText(b.area, 120),
      contact_name: cleanText(b.contactName, 120),
      phone,
      note: cleanText(b.note, 1000),
      wants_featured: Boolean(b.wantsFeatured),
    },
  }
}

export async function insertListingRequest(client, userId, fields) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO halal_listing_requests
       (id, business_name, category, city, area, contact_name, phone, note, wants_featured, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      fields.business_name,
      fields.category,
      fields.city,
      fields.area,
      fields.contact_name,
      fields.phone,
      fields.note,
      fields.wants_featured,
      userId || null,
    ],
  )
  return id
}

export async function listListingRequests(client, status) {
  const all = !status || status === 'all'
  const { rows } = await client.query(
    `SELECT r.id, r.business_name, r.category, r.city, r.area, r.contact_name, r.phone, r.note,
            r.wants_featured, r.status, r.created_at, u.full_name AS submitted_by_name, u.mobile AS submitted_by_mobile
     FROM halal_listing_requests r
     LEFT JOIN users u ON u.id = r.submitted_by
     ${all ? '' : 'WHERE r.status = $1'}
     ORDER BY r.created_at DESC
     LIMIT 300`,
    all ? [] : [status],
  )
  return rows.map((row) => ({
    id: String(row.id),
    businessName: row.business_name,
    category: row.category,
    city: row.city || '',
    area: row.area || '',
    contactName: row.contact_name || '',
    phone: row.phone,
    note: row.note || '',
    wantsFeatured: Boolean(row.wants_featured),
    status: row.status,
    submittedByName: row.submitted_by_name || '',
    submittedByMobile: row.submitted_by_mobile || '',
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

/**
 * Well-known Delhi kitchens that serve halal food, so the tab is not empty on day one.
 * None are marked verified: the owner checks a certificate before setting that.
 * Fixed ids keep reruns from adding duplicates.
 */
const STARTER_LISTINGS = [
  ['01', "Karim's", 'Jama Masjid', 28.6506, 77.2334, 'Mutton korma, seekh', 'mughlai,kebabs'],
  ['02', 'Al-Jawahar', 'Jama Masjid', 28.6503, 77.2337, 'Nahari, biryani', 'mughlai,nahari'],
  ['03', 'Aslam Chicken', 'Jama Masjid', 28.6499, 77.2326, 'Butter chicken', 'chicken,late night'],
  ['04', "Nizam's Kathi Kabab", 'Connaught Place', 28.6325, 77.2178, 'Mutton kathi roll', 'rolls'],
  ['05', 'Al Bake', 'Connaught Place', 28.6312, 77.2194, 'Shawarma', 'shawarma,rolls'],
  ['06', 'Khan Chacha', 'Khan Market', 28.6003, 77.227, 'Kebabs, rolls', 'kebabs,rolls'],
  ['07', 'Alkauser', 'Sunder Nagar', 28.6022, 77.2415, 'Galouti, kakori', 'kebabs'],
  ['08', 'Qureshi Kabab', 'Nizamuddin', 28.5917, 77.2419, 'Seekh, shammi', 'kebabs'],
  ['09', 'Dastarkhwan', 'Connaught Place', 28.6304, 77.2169, 'Lucknowi dum biryani', 'biryani,mughlai'],
]

export async function ensureHalalStarterListings(client) {
  const { rows } = await client.query(`SELECT 1 FROM halal_listings LIMIT 1`)
  if (rows.length) return 0
  for (const [suffix, name, area, lat, lng, tagline, tags] of STARTER_LISTINGS) {
    await client.query(
      `INSERT INTO halal_listings (id, category, name, tagline, area, city, lat, lng, tags)
       VALUES ($1, 'restaurant', $2, $3, $4, 'Delhi', $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [`b0000000-0000-4000-8000-0000000000${suffix}`, name, tagline, area, lat, lng, tags],
    )
  }
  return STARTER_LISTINGS.length
}
