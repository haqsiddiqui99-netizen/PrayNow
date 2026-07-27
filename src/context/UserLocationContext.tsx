import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LOCATION } from '../data/mockData'
import { formatLocationLabel } from '../utils/geo'
import { getDevicePosition, reverseGeocode } from '../services/liveWeather'

export interface UserLocationState {
  lat: number
  lng: number
  city: string
  area: string
  country: string
  locationLabel: string
  loading: boolean
  isLive: boolean
  error: string | null
}

interface UserLocationContextValue extends UserLocationState {
  refresh: () => Promise<void>
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null)

function defaultState(): UserLocationState {
  return {
    lat: LOCATION.lat,
    lng: LOCATION.lng,
    city: LOCATION.city,
    area: LOCATION.city,
    country: LOCATION.country,
    locationLabel: formatLocationLabel(LOCATION.city, LOCATION.city, LOCATION.country),
    loading: true,
    isLive: false,
    error: null,
  }
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserLocationState>(defaultState)

  const resolveLocation = useCallback(async (lat: number, lng: number, isLive: boolean) => {
    const geo = await reverseGeocode(lat, lng)
    const locationLabel = formatLocationLabel(geo.city, geo.area, geo.country)
    setState({
      lat,
      lng,
      city: geo.city,
      area: geo.area,
      country: geo.country,
      locationLabel,
      loading: false,
      isLive,
      error: null,
    })
  }, [])

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const pos = await getDevicePosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      })
      await resolveLocation(pos.coords.latitude, pos.coords.longitude, true)
    } catch (err) {
      const message =
        err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED
          ? 'Location permission denied'
          : err instanceof Error
            ? err.message
            : 'Location unavailable'

      try {
        await resolveLocation(LOCATION.lat, LOCATION.lng, false)
        setState((s) => ({ ...s, error: message }))
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          isLive: false,
          error: message,
        }))
      }
    }
  }, [resolveLocation])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => { void refresh() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
}

export function useUserLocation(): UserLocationContextValue {
  const ctx = useContext(UserLocationContext)
  if (!ctx) throw new Error('useUserLocation must be used within UserLocationProvider')
  return ctx
}
