import { randomUUID } from 'node:crypto'

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

async function loadMosqueExtras(client, mosqueId) {
  const { rows: timingRows } = await client.query(
    `SELECT prayer_name, prayer_start, azan, jamat, prayer_end FROM mosque_timings WHERE mosque_id = $1`,
    [mosqueId],
  )
  const { rows: nightRows } = await client.query(
    `SELECT tahajjud_start, tahajjud_end, sehri_start, sehri_end
     FROM mosque_night_timings WHERE mosque_id = $1`,
    [mosqueId],
  )
  return { timingRows, night: nightRows[0] || null }
}

export async function fetchMosqueRows(client, { activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE is_active = TRUE' : ''
  const { rows } = await client.query(`SELECT * FROM mosques ${where} ORDER BY name`)

  const result = []
  for (const row of rows) {
    const { timingRows, night } = await loadMosqueExtras(client, row.id)
    result.push(mapMosqueRow(row, timingRows, night))
  }
  return result
}

export async function fetchMosqueById(client, id) {
  const { rows } = await client.query(`SELECT * FROM mosques WHERE id = $1`, [id])
  if (!rows[0]) return null
  const { timingRows, night } = await loadMosqueExtras(client, rows[0].id)
  return mapMosqueRow(rows[0], timingRows, night)
}

function parseStaffList(raw, fallback = null) {
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) {
        return parsed
          .map((person) => ({
            name: String(person?.name || '').trim(),
            mobile: String(person?.mobile || '').trim(),
            photo: String(person?.photo || '').trim(),
          }))
          .filter((person) => person.name)
      }
    } catch {
      // fall through
    }
  }
  if (fallback?.name) {
    return [{
      name: String(fallback.name).trim(),
      mobile: String(fallback.mobile || '').trim(),
      photo: String(fallback.photo || '').trim(),
    }]
  }
  return []
}

function parseJumaSessions(row) {
  if (row.juma_sessions) {
    try {
      const parsed = typeof row.juma_sessions === 'string'
        ? JSON.parse(row.juma_sessions)
        : row.juma_sessions
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => ({
          azan: s?.azan || '',
          khutba: s?.khutba || '',
          namaz: s?.namaz || '',
        }))
      }
    } catch {
      // fall through to legacy columns
    }
  }
  return [{ azan: '', khutba: row.juma_khutba || '', namaz: row.juma_namaz || '' }]
}

function mapMosqueRow(row, timingRows = [], night = null) {
  const timings = {}
  for (const p of PRAYERS) timings[p] = { start: '', azan: '', jamat: '', end: '' }
  for (const t of timingRows) {
    if (t.prayer_name) {
      timings[t.prayer_name] = {
        start: t.prayer_start || '',
        azan: t.azan || '',
        jamat: t.jamat || '',
        end: t.prayer_end || '',
      }
    }
  }
  const sessions = parseJumaSessions(row)
  const imamDetails = {
    name: row.imam || '',
    mobile: row.imam_mobile || row.phone || '',
    photo: row.imam_photo || '',
  }
  const moazzinDetails = {
    name: row.moazzin_name || '',
    mobile: row.moazzin_mobile || '',
    photo: row.moazzin_photo || '',
  }
  const imams = parseStaffList(row.imams, imamDetails.name ? imamDetails : null)
  const moazzins = parseStaffList(row.moazzins, moazzinDetails.name ? moazzinDetails : null)
  return {
    id: row.legacy_id || row.id,
    dbId: row.id,
    name: row.name,
    address: row.address,
    area: row.area,
    city: row.city || 'Delhi',
    phone: row.phone || '',
    lat: row.lat,
    lng: row.lng,
    sect: row.sect || '',
    imam: imams[0]?.name || row.imam || '',
    imamDetails: imams[0] || imamDetails,
    imams,
    moazzinDetails: moazzins[0] || moazzinDetails,
    moazzins,
    jumaTimings: {
      azan: sessions[0]?.azan || '',
      khutba: sessions[0]?.khutba || '',
      namaz: sessions[0]?.namaz || '',
      sessions,
    },
    sermonLanguage: row.sermon_language || '',
    capacity: row.capacity != null ? Number(row.capacity) : 0,
    facilities: row.facilities || [],
    events: row.events || [],
    photos: Array.isArray(row.photos) ? row.photos : [],
    isActive: row.is_active,
    timings,
    nightTimings: {
      tahajjud: { start: night?.tahajjud_start || '', end: night?.tahajjud_end || '' },
      sehri: { start: night?.sehri_start || '', end: night?.sehri_end || '' },
    },
    distance: 0,
    rating: row.rating != null ? Number(row.rating) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    travelMinutes: 0,
    arrivalStatus: 'early',
    arrivalMessage: '',
    reviews: [],
  }
}

export function mosqueFieldsFromBody(body) {
  const imam = body.imamDetails || {}
  const moazzin = body.moazzinDetails || {}
  const imams = parseStaffList(
    body.imams,
    imam.name || body.imam
      ? { name: imam.name || body.imam || '', mobile: imam.mobile || '', photo: imam.photo || '' }
      : null,
  )
  const moazzins = parseStaffList(
    body.moazzins,
    moazzin.name ? moazzin : null,
  )
  const leadImam = imams[0] || { name: imam.name || body.imam || '', mobile: imam.mobile || '', photo: imam.photo || '' }
  const leadMoazzin = moazzins[0] || { name: moazzin.name || '', mobile: moazzin.mobile || '', photo: moazzin.photo || '' }
  const juma = body.jumaTimings || {}
  const sessions = Array.isArray(juma.sessions) && juma.sessions.length > 0
    ? juma.sessions.map((s) => ({
      azan: s?.azan || '',
      khutba: s?.khutba || '',
      namaz: s?.namaz || '',
    }))
    : [{ azan: juma.azan || '', khutba: juma.khutba || '', namaz: juma.namaz || '' }]
  return {
    name: body.name,
    address: body.address,
    area: body.area,
    city: body.city || null,
    phone: body.phone || null,
    lat: body.lat,
    lng: body.lng,
    sect: body.sect || null,
    imam: leadImam.name || null,
    imam_mobile: leadImam.mobile || null,
    imam_photo: leadImam.photo || null,
    moazzin_name: leadMoazzin.name || null,
    moazzin_mobile: leadMoazzin.mobile || null,
    moazzin_photo: leadMoazzin.photo || null,
    imams: JSON.stringify(imams),
    moazzins: JSON.stringify(moazzins),
    juma_khutba: sessions[0]?.khutba || null,
    juma_namaz: sessions[0]?.namaz || null,
    juma_sessions: JSON.stringify(sessions),
    sermon_language: body.sermonLanguage || null,
    capacity: body.capacity != null ? Number(body.capacity) : 0,
    facilities: body.facilities || [],
    events: body.events || [],
    photos: body.photos || [],
  }
}

export async function upsertMosqueTimings(client, mosqueId, timings) {
  for (const prayer of PRAYERS) {
    const slot = timings[prayer]
    if (!slot?.azan && !slot?.jamat) continue
    await client.query(
      `INSERT INTO mosque_timings (id, mosque_id, prayer_name, prayer_start, azan, jamat, prayer_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (mosque_id, prayer_name) DO UPDATE SET
         prayer_start = EXCLUDED.prayer_start,
         azan = EXCLUDED.azan,
         jamat = EXCLUDED.jamat,
         prayer_end = EXCLUDED.prayer_end`,
      [
        randomUUID(),
        mosqueId,
        prayer,
        slot.start || '',
        slot.azan || '',
        slot.jamat || '',
        slot.end || '',
      ],
    )
  }
}

export async function upsertNightTimings(client, mosqueId, nightTimings) {
  if (!nightTimings) return
  const n = nightTimings
  await client.query(
    `INSERT INTO mosque_night_timings (mosque_id, tahajjud_start, tahajjud_end, sehri_start, sehri_end)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (mosque_id) DO UPDATE SET
       tahajjud_start=EXCLUDED.tahajjud_start, tahajjud_end=EXCLUDED.tahajjud_end,
       sehri_start=EXCLUDED.sehri_start, sehri_end=EXCLUDED.sehri_end`,
    [mosqueId, n.tahajjud.start, n.tahajjud.end || n.tahajjud.jamat || '', n.sehri.start, n.sehri.end],
  )
}

export async function userCanManageMosque(client, userId, role, mosqueId) {
  if (role === 'admin') return true
  const { rows } = await client.query(
    `SELECT 1 FROM mosque_assignments WHERE user_id = $1 AND mosque_id = $2`,
    [userId, mosqueId],
  )
  return rows.length > 0
}

export async function resolveMosqueDbId(client, idOrLegacy) {
  const { rows } = await client.query(
    `SELECT id FROM mosques WHERE id::text = $1 OR legacy_id = $1 LIMIT 1`,
    [idOrLegacy],
  )
  return rows[0]?.id || null
}
