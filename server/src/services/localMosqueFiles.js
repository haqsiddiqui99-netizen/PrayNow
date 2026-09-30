import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CITY_CATALOG, cityIdFromName } from '../data/cityCatalog.js'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data')

/** JSON files saved by fetch-city-mosques-osm / fetch-city-mosques-places (no live API on read). */
export function dataFilesForCity(cityName) {
  const id = cityIdFromName(cityName)
  const candidates = [
    path.join(DATA_DIR, `${id}-mosques-places.json`),
    path.join(DATA_DIR, `${id}-mosques-osm.json`),
    path.join(DATA_DIR, `${id}-mosques.json`),
  ]
  return [...new Set(candidates)].filter((file) => fs.existsSync(file))
}

export function mosqueDedupeKey(m) {
  return `${String(m.name).toLowerCase()}|${Number(m.lat).toFixed(4)}|${Number(m.lng).toFixed(4)}`
}

function readMosquesFile(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  const list = Array.isArray(payload) ? payload : payload.mosques
  if (!Array.isArray(list)) return []
  const city = payload.city || null
  return list.map((m) => ({ ...m, city: m.city || city || 'Delhi' }))
}

/** Load every mosque from on-disk JSON for catalog cities (deduped). Zero Google/OSM API calls. */
export function loadAllLocalMosqueRecords() {
  const seen = new Set()
  const mosques = []
  const byFile = []

  for (const cityName of Object.keys(CITY_CATALOG)) {
    const files = dataFilesForCity(cityName)
    if (!files.length) continue

    let cityCount = 0
    for (const file of files) {
      for (const m of readMosquesFile(file)) {
        if (m.name == null || m.lat == null || m.lng == null) continue
        const key = mosqueDedupeKey(m)
        if (seen.has(key)) continue
        seen.add(key)
        mosques.push({ ...m, city: m.city || cityName })
        cityCount += 1
      }
    }
    if (cityCount > 0) {
      byFile.push({ city: cityName, count: cityCount, files: files.map((f) => path.basename(f)) })
    }
  }

  return { mosques, byFile }
}
