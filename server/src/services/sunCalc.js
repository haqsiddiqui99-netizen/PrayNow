/**
 * Offline sun times (NOAA solar equations). Used when the Aladhan lookup is unreachable.
 * Maghrib is sunset. Fajr uses the 18 degree twilight angle, the same as Karachi (Aladhan method 1).
 * Accurate to about a minute or two for the latitudes the app serves.
 */

const RAD = Math.PI / 180
const FAJR_ANGLE = 18
const SUNSET_ZENITH = 90.833

function dayOfYear(year, month, day) {
  const start = Date.UTC(year, 0, 0)
  const now = Date.UTC(year, month - 1, day)
  return Math.round((now - start) / 86400000)
}

function solarTerms(year, month, day) {
  const n = dayOfYear(year, month, day)
  const g = ((2 * Math.PI) / 365) * (n - 1)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)
  return { eqTime, decl }
}

/** Hour angle in degrees for a given solar zenith, or null when the sun never reaches it. */
function hourAngle(latDeg, decl, zenithDeg) {
  const lat = latDeg * RAD
  const cosH = (Math.cos(zenithDeg * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))
  if (cosH < -1 || cosH > 1) return null
  return Math.acos(cosH) / RAD
}

/** India runs on one clock. Elsewhere fall back to the longitude's nominal zone. */
export function guessUtcOffsetHours(lat, lng) {
  if (lat >= 6 && lat <= 36 && lng >= 68 && lng <= 98) return 5.5
  return Math.round(lng / 15)
}

/** Minutes after local midnight for sunrise, sunset and Fajr on one date. */
export function sunMinutes({ lat, lng, ymd, utcOffsetHours }) {
  const [year, month, day] = ymd.split('-').map(Number)
  const { eqTime, decl } = solarTerms(year, month, day)
  const noonUtc = 720 - 4 * lng - eqTime
  const offset = (utcOffsetHours ?? guessUtcOffsetHours(lat, lng)) * 60
  const local = (minutes) => minutes + offset

  const rise = hourAngle(lat, decl, SUNSET_ZENITH)
  const fajr = hourAngle(lat, decl, 90 + FAJR_ANGLE)
  if (rise == null || fajr == null) return null
  return {
    sunrise: local(noonUtc - 4 * rise),
    maghrib: local(noonUtc + 4 * rise),
    fajr: local(noonUtc - 4 * fajr),
  }
}
