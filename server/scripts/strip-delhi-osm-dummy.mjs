import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/delhi-mosques-osm.json')
const d = JSON.parse(fs.readFileSync(p, 'utf8'))
d.mosques = (d.mosques || []).map((m) => {
  const row = {
    legacy_id: m.legacy_id,
    name: m.name,
    address: m.address,
    area: m.area,
    city: m.city || 'Delhi',
    phone: m.phone || '',
    lat: m.lat,
    lng: m.lng,
    mapsUrl: m.mapsUrl || `https://www.google.com/maps?q=${m.lat},${m.lng}`,
    source: m.source || 'openstreetmap',
    osmType: m.osmType,
    osmId: m.osmId,
  }
  // Drop invented default Sunni; keep only non-default sect if any (rare in old file)
  if (m.sect && m.sect !== 'Sunni') row.sect = m.sect
  if (m.website) row.website = m.website
  return row
})
d.count = d.mosques.length
d.note = 'Real OSM fields only; dummy capacity/sect/facilities/photos stripped'
fs.writeFileSync(p, JSON.stringify(d, null, 2))
const phones = d.mosques.filter((x) => x.phone).length
console.log(`stripped ${d.count} mosques, ${phones} with phone`)
