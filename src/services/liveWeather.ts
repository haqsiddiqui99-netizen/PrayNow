import { LOCATION } from '../data/mockData'

export type WeatherTheme = 'sunny' | 'night' | 'rainy' | 'cloudy'

export interface LiveWeatherData {
  theme: WeatherTheme
  temperature: number
  weatherCode: number
  condition: string
  isDay: boolean
  cloudCover: number
  precipitation: number
  city: string
  country: string
  lat: number
  lng: number
  fetchedAt: Date
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

export function resolveTheme(code: number, isDay: boolean, precipitation: number): WeatherTheme {
  if (precipitation > 0 || RAIN_CODES.has(code)) return 'rainy'
  if (!isDay) return 'night'
  if (code <= 1) return 'sunny'
  return 'cloudy'
}

export function wmoLabel(code: number): string {
  return WMO_LABELS[code] ?? 'Cloudy'
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city: string; area: string; country: string }> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    )
    if (!res.ok) throw new Error('Geocode failed')
    const data = await res.json()
    const city = data.city || data.locality || data.principalSubdivision || LOCATION.city
    const area = data.locality || data.city || data.principalSubdivision || city
    return {
      city,
      area,
      country: data.countryName || LOCATION.country,
    }
  } catch {
    return { city: LOCATION.city, area: LOCATION.city, country: LOCATION.country }
  }
}

export async function fetchLiveWeather(lat: number, lng: number): Promise<Omit<LiveWeatherData, 'city' | 'country'>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=weather_code,is_day,temperature_2m,cloud_cover,precipitation,wind_speed_10m` +
    `&timezone=auto`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather API error ${res.status}`)

  const data = await res.json()
  const c = data.current
  const code = c.weather_code as number
  const isDay = c.is_day === 1
  const precipitation = c.precipitation as number

  return {
    theme: resolveTheme(code, isDay, precipitation),
    temperature: c.temperature_2m as number,
    weatherCode: code,
    condition: wmoLabel(code),
    isDay,
    cloudCover: c.cloud_cover as number,
    precipitation,
    lat,
    lng,
    fetchedAt: new Date(),
  }
}

export function getDevicePosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 5 * 60 * 1000,
      ...options,
    })
  })
}
