import { randomUUID, createHash } from 'node:crypto'
import { withClient } from './pool.js'
import { loadAllLocalMosqueRecords, mosqueDedupeKey } from '../services/localMosqueFiles.js'

const LEGACY_ID_MAX = 32

function compactLegacyId(raw) {
  if (!raw) return null
  const id = String(raw).trim()
  if (id.length <= LEGACY_ID_MAX) return id
  const hash = createHash('sha256').update(id).digest('hex').slice(0, LEGACY_ID_MAX - 2)
  return `h-${hash}`
}

function normalizeRecord(raw, cityFallback) {
  const city = raw.city?.trim() || cityFallback
  const address =
    raw.pinCode && raw.address && !String(raw.address).includes(raw.pinCode)
      ? `${raw.address} ${raw.pinCode}`
      : raw.address || `${city}, India`

  return {
    legacyId: compactLegacyId(raw.legacy_id),
    city,
    name: String(raw.name).trim(),
    address: String(address).trim(),
    area: raw.area?.trim() || city,
    phone: raw.phone || '',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    sect: raw.sect || '',
    capacity: raw.capacity != null ? Number(raw.capacity) : 0,
  }
}

async function existingKeys(client) {
  const { rows } = await client.query(
    `SELECT legacy_id, name, lat, lng FROM mosques WHERE is_active = TRUE`,
  )
  const keys = new Set()
  for (const row of rows) {
    keys.add(mosqueDedupeKey(row))
    if (row.legacy_id) keys.add(`legacy:${row.legacy_id}`)
  }
  return keys
}

async function insertMosque(client, rec) {
  const id = randomUUID()
  const legacyId = rec.legacyId || `local-${id.slice(0, 8)}`
  await client.query(
    `INSERT INTO mosques (
       id, legacy_id, name, address, area, city, phone, lat, lng, sect,
       sermon_language, facilities, events, photos, capacity, is_active
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,TRUE
     )`,
    [
      id,
      legacyId,
      rec.name,
      rec.address,
      rec.area,
      rec.city,
      rec.phone,
      rec.lat,
      rec.lng,
      rec.sect || null,
      '',
      [],
      [],
      [],
      rec.capacity,
    ],
  )
  return id
}

/**
 * Import mosques from server/data/*-mosques-*.json into the DB.
 * Reads local files only — never calls Google Places or Overpass.
 */
export async function hydrateLocalMosquesFromFiles() {
  if (process.env.HYDRATE_LOCAL_MOSQUES === 'false') {
    console.log('Local mosque hydrate skipped (HYDRATE_LOCAL_MOSQUES=false)')
    return { created: 0, skipped: 0, reason: 'disabled' }
  }

  const { mosques, byFile } = loadAllLocalMosqueRecords()
  if (!mosques.length) {
    console.log('No local mosque JSON in server/data/ — only seed data will be used.')
    return { created: 0, skipped: 0, reason: 'no-files' }
  }

  return withClient(async (client) => {
    const { rows: beforeCount } = await client.query(
      `SELECT COUNT(*)::int AS count FROM mosques WHERE is_active = TRUE`,
    )
    const existingBefore = beforeCount[0]?.count ?? 0

    console.log('Loading mosques from local JSON (no Google Places / OSM API calls):')
    for (const entry of byFile) {
      console.log(`  ${entry.city}: ${entry.count} from ${entry.files.join(', ')}`)
    }

    const keys = await existingKeys(client)
    let created = 0
    let skipped = 0

    for (const raw of mosques) {
      const rec = normalizeRecord(raw, raw.city)
      const key = mosqueDedupeKey(rec)
      if (keys.has(key) || (rec.legacyId && keys.has(`legacy:${rec.legacyId}`))) {
        skipped += 1
        continue
      }

      await insertMosque(client, rec)
      keys.add(key)
      if (rec.legacyId) keys.add(`legacy:${rec.legacyId}`)
      created += 1
    }

    const { rows: after } = await client.query(
      `SELECT city, COUNT(*)::int AS count FROM mosques WHERE is_active = TRUE GROUP BY city ORDER BY city`,
    )
    const totalAfter = after.reduce((sum, row) => sum + row.count, 0)
    console.log(
      `Local hydrate done: ${created} added, ${skipped} already in DB ` +
        `(${existingBefore} → ${totalAfter} active mosques)`,
    )
    for (const row of after) {
      console.log(`  ${row.city}: ${row.count}`)
    }

    return { created, skipped, total: totalAfter, reason: 'hydrated' }
  })
}
