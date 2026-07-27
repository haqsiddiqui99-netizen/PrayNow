import { useCallback, useEffect, useState } from 'react'
import { useUserLocation } from '../context/UserLocationContext'
import { fetchLiveWeather, type LiveWeatherData, type WeatherTheme } from '../services/liveWeather'

export type { WeatherTheme }

export interface WeatherHeaderState {
  theme: WeatherTheme
  currentTime: string
  currentDate: string
  temperature: number | null
  condition: string
  city: string
  area: string
  country: string
  locationLabel: string
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  isLive: boolean
  precipitation: number
  locationLoading: boolean
  locationLive: boolean
  locationError: string | null
  refreshLocation: () => Promise<void>
}

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now)
}

function formatShortDate(now: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now)
}

export function useWeatherHeader(): WeatherHeaderState {
  const {
    lat,
    lng,
    city,
    area,
    country,
    locationLabel,
    loading: locationLoading,
    isLive: locationLive,
    error: locationError,
    refresh: refreshLocation,
  } = useUserLocation()

  const [weather, setWeather] = useState<{
    theme: WeatherTheme
    temperature: number | null
    condition: string
    loading: boolean
    error: string | null
    lastUpdated: Date | null
    isLive: boolean
    precipitation: number
  }>({
    theme: 'sunny',
    temperature: null,
    condition: 'Loading…',
    loading: true,
    error: null,
    lastUpdated: null,
    isLive: false,
    precipitation: 0,
  })

  const [clock, setClock] = useState(() => {
    const now = new Date()
    return { currentTime: formatClock(now), currentDate: formatShortDate(now) }
  })

  const refreshWeather = useCallback(async () => {
    setWeather((s) => ({ ...s, loading: true, error: null }))
    try {
      const data: LiveWeatherData = await fetchLiveWeather(lat, lng).then((w) => ({
        ...w,
        city,
        country,
      }))
      setWeather({
        theme: data.theme,
        temperature: data.temperature,
        condition: data.condition,
        loading: false,
        error: null,
        lastUpdated: data.fetchedAt,
        isLive: true,
        precipitation: data.precipitation,
      })
    } catch (err) {
      setWeather((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Weather unavailable',
        isLive: false,
      }))
    }
  }, [lat, lng, city, country])

  useEffect(() => {
    void refreshWeather()
  }, [refreshWeather])

  useEffect(() => {
    const weatherInterval = setInterval(() => { void refreshWeather() }, 5 * 60 * 1000)
    const clockInterval = setInterval(() => {
      const now = new Date()
      setClock({ currentTime: formatClock(now), currentDate: formatShortDate(now) })
    }, 30_000)
    return () => {
      clearInterval(weatherInterval)
      clearInterval(clockInterval)
    }
  }, [refreshWeather])

  return {
    theme: weather.theme,
    currentTime: clock.currentTime,
    currentDate: clock.currentDate,
    temperature: weather.temperature,
    condition: weather.condition,
    city,
    area,
    country,
    locationLabel,
    loading: weather.loading,
    error: weather.error,
    lastUpdated: weather.lastUpdated,
    isLive: weather.isLive,
    precipitation: weather.precipitation,
    locationLoading,
    locationLive,
    locationError,
    refreshLocation,
  }
}
