/**
 * Bulk-import mosques from JSON into PostgreSQL (or in-memory dev DB).
 *
 * Usage:
 *   node scripts/import-mosques.js
 *   node scripts/import-mosques.js data/mosques.json
 *   node scripts/import-mosques.js --dry-run data/mosques.json
 *
 * Copy mosques.example.json → mosques.json and fill in real data from Google Maps + local jamat times.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
import { withClient, formatDbError } from '../src/db/pool.js'
import { ensureDatabaseReady } from '../src/db/ensureReady.js'
import { mosqueFieldsFromBody, upsertMosqueTimings, upsertNightTimings } from '../src/services/mosques.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_FILE = path.join(__dirname, '../data/mosques.json')

const DEFAULT_TIMINGS = {
  Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:10 AM', end: '5:40 AM' },
  Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:30 PM', end: '3:30 PM' },
  Asr: { start: '3:30 PM', azan: '3:30 PM', jamat: '3:45 PM', end: '6:45 PM' },
  Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:50 PM', end: '8:00 PM' },
  Isha: { start: '8:00 PM', azan: '8:00 PM', jamat: '8:15 PM', end: '4:55 AM' },
}

const DEFAULT_NIGHT = {
  tahajjud: { start: '12:30 AM', end: '4:40 AM' },
  sehri: { start: '3:10 AM', end: '4:50 AM' },
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const fileArg = argv.find((a) => !a.startsWith('--') && a.endsWith('.json'))
  return { dryRun, file: fileArg ? path.resolve(process.cwd(), fileArg) : DEFAULT_FILE }
}

function normalizeMosque(raw, index) {
  if (!raw.name?.trim()) throw new Error(`Mosque #${index + 1}: "name" is required`)
  if (!raw.address?.trim()) throw new Error(`Mosque "${raw.name}": "address" is required`)
  if (raw.lat == null || raw.lng == null) throw new Error(`Mosque "${raw.name}": lat/lng are required`)

  const imamDetails = raw.imamDetails || {
    name: raw.imam || '',
    mobile: raw.imam_mobile || '',
    photo: raw.imam_photo || '',
  }

  const moazzinDetails = raw.moazzinDetails || {
    name: raw.moazzin_name || '',
    mobile: raw.moazzin_mobile || '',
    photo: raw.moazzin_photo || '',
  }

  const nightRaw = raw.nightTimings || raw.night
  const nightTimings = nightRaw
    ? {
        tahajjud: {
          start: nightRaw.tahajjud?.start || nightRaw.tahajjud_start || DEFAULT_NIGHT.tahajjud.start,
          end: nightRaw.tahajjud?.end || nightRaw.tahajjud_end || DEFAULT_NIGHT.tahajjud.end,
        },
        sehri: {
          start: nightRaw.sehri?.start || nightRaw.sehri_start || DEFAULT_NIGHT.sehri.start,
          end: nightRaw.sehri?.end || nightRaw.sehri_end || DEFAULT_NIGHT.sehri.end,
        },
      }
    : { ...DEFAULT_NIGHT }

  const body = {
    name: raw.name.trim(),
    address: raw.address.trim(),
    area: raw.area?.trim() || '',
    phone: raw.phone || '',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    sect: raw.sect || '',
    capacity: raw.capacity ?? 500,
    sermonLanguage: raw.sermonLanguage || raw.sermon_language || '',
    facilities: raw.facilities || [],
    events: raw.events || [],
    photos: raw.photos?.length ? raw.photos : ['🕌'],
    imamDetails,
    moazzinDetails,
    imam: imamDetails.name,
    jumaTimings: raw.jumaTimings || {
      khutba: raw.juma_khutba || '12:15 PM',
      namaz: raw.juma_namaz || '12:30 PM',
    },
    timings: { ...DEFAULT_TIMINGS, ...(raw.timings || {}) },
    nightTimings,
  }

  return {
    legacyId: raw.legacy_id?.trim() || null,
    city: raw.city?.trim() || 'Delhi',
    body,
    fields: mosqueFieldsFromBody(body),
  }
}

async function upsertMosque(client, entry) {
  const { legacyId, city, body, fields } = entry

  let mosqueId = null
  let action = 'created'

  if (legacyId) {
    const existing = await client.query(`SELECT id FROM mosques WHERE legacy_id = $1`, [legacyId])
    mosqueId = existing.rows[0]?.id || null
  }

  if (!mosqueId) {
    const byName = await client.query(
      `SELECT id FROM mosques WHERE lower(name) = lower($1) AND lower(address) = lower($2) LIMIT 1`,
      [body.name, body.address],
    )
    mosqueId = byName.rows[0]?.id || null
  }

  if (mosqueId) {
    action = 'updated'
    await client.query(
      `UPDATE mosques SET
         name = $2, address = $3, area = $4, city = $5, phone = $6, lat = $7, lng = $8, sect = $9,
         imam = $10, imam_mobile = $11, imam_photo = $12,
         moazzin_name = $13, moazzin_mobile = $14, moazzin_photo = $15,
         juma_khutba = $16, juma_namaz = $17, sermon_language = $18,
         facilities = $19, events = $20, photos = $21, capacity = $22,
         is_active = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [
        mosqueId,
        fields.name,
        fields.address,
        fields.area,
        city,
        fields.phone,
        fields.lat,
        fields.lng,
        fields.sect,
        fields.imam,
        fields.imam_mobile,
        fields.imam_photo,
        fields.moazzin_name,
        fields.moazzin_mobile,
        fields.moazzin_photo,
        fields.juma_khutba,
        fields.juma_namaz,
        fields.sermon_language,
        fields.facilities,
        fields.events,
        fields.photos,
        fields.capacity ?? 500,
      ],
    )
  } else {
    const id = randomUUID()
    const { rows } = await client.query(
      `INSERT INTO mosques (id, legacy_id, name, address, area, city, phone, lat, lng, sect, imam, imam_mobile, imam_photo,
         moazzin_name, moazzin_mobile, moazzin_photo, juma_khutba, juma_namaz, sermon_language, facilities, events, photos, capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING id`,
      [
        id,
        legacyId || String(Date.now()),
        fields.name,
        fields.address,
        fields.area,
        city,
        fields.phone,
        fields.lat,
        fields.lng,
        fields.sect,
        fields.imam,
        fields.imam_mobile,
        fields.imam_photo,
        fields.moazzin_name,
        fields.moazzin_mobile,
        fields.moazzin_photo,
        fields.juma_khutba,
        fields.juma_namaz,
        fields.sermon_language,
        fields.facilities,
        fields.events,
        fields.photos,
        fields.capacity ?? 500,
      ],
    )
    mosqueId = rows[0].id
  }

  if (body.timings) await upsertMosqueTimings(client, mosqueId, body.timings)
  if (body.nightTimings) await upsertNightTimings(client, mosqueId, body.nightTimings)

  return { mosqueId, name: body.name, action }
}

async function main() {
  const { dryRun, file } = parseArgs(process.argv.slice(2))

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`)
    console.error('Copy server/data/mosques.example.json → server/data/mosques.json and add your mosques.')
    process.exit(1)
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  const list = Array.isArray(parsed) ? parsed : parsed.mosques
  if (!Array.isArray(list) || list.length === 0) {
    console.error('JSON must be an array or { "mosques": [...] } with at least one entry.')
    process.exit(1)
  }

  const entries = list.map((raw, i) => normalizeMosque(raw, i))

  if (dryRun) {
    console.log(`Dry run — would import ${entries.length} mosque(s) from ${file}:`)
    for (const e of entries) console.log(`  • ${e.body.name} (${e.body.area || e.city})`)
    return
  }

  await ensureDatabaseReady()

  await withClient(async (client) => {
    let created = 0
    let updated = 0
    for (const entry of entries) {
      const result = await upsertMosque(client, entry)
      if (result.action === 'updated') updated += 1
      else created += 1
      console.log(`✓ ${result.name} (${result.action})`)
    }
    console.log(`\nDone: ${created} created, ${updated} updated (${entries.length} total)`)
  })
}

main().catch((err) => {
  console.error('Import failed:', formatDbError(err))
  process.exit(1)
})
