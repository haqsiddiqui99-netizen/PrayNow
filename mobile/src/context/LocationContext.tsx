import * as Location from 'expo-location'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveSupportedCity, type SupportedCity } from '@/src/constants/cities'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { LOCATION } from '@/src/data/mockData'
import {
  buildSavedLocation,
  loadSavedLocations,
  upsertSavedLocation,
  type SavedLocation,
} from '@/src/services/savedLocations'
import { formatLocationLabel } from '@/src/utils/geo'

export interface UserLocation {
  lat: number
  lng: number
  label: string
  city: string
  region: string
  country: string
  isLive: boolean
  supportedCity: SupportedCity | null
  error?: string
}

type LocationContextValue = {
  location: UserLocation
  savedLocations: SavedLocation[]
  loading: boolean
  refresh: () => Promise<boolean>
  selectCity: (city: SupportedCity) => Promise<void>
  selectSavedLocation: (saved: SavedLocation) => Promise<void>
  searchAddress: (query: string) => Promise<boolean>
}

function toUserLocation(input: {
  lat: number
  lng: number
  city: string
  region: string
  country: string
  isLive: boolean
}): UserLocation {
  const supportedCity = resolveSupportedCity(input.city, input.region)
  return {
    lat: input.lat,
    lng: input.lng,
    label: formatLocationLabel(input.city, input.region, input.country),
    city: input.city,
    region: input.region,
    country: input.country,
    isLive: input.isLive,
    supportedCity,
    error: undefined,
  }
}

async function persistLocation(loc: UserLocation) {
  const saved = buildSavedLocation({
    label: loc.label,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    supportedCityId: loc.supportedCity?.id,
  })
  return upsertSavedLocation(saved)
}

const defaultLocation = toUserLocation({
  lat: LOCATION.lat,
  lng: LOCATION.lng,
  city: LOCATION.city,
  region: LOCATION.city,
  country: LOCATION.country,
  isLive: false,
})

const LocationContext = createContext<LocationContextValue>({
  location: defaultLocation,
  savedLocations: [],
  loading: true,
  refresh: async () => false,
  selectCity: async () => {},
  selectSavedLocation: async () => {},
  searchAddress: async () => false,
})

export function LocationProvider({ children }: { children: ReactNode }) {
  const { fromApi } = useCityPrayer()
  const [location, setLocation] = useState<UserLocation>(defaultLocation)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const saved = await loadSavedLocations()
      if (saved.length === 0) {
        const seeded = await persistLocation(defaultLocation)
        setSavedLocations(seeded)
        return
      }
      setSavedLocations(saved)
      const latest = saved[0]
      setLocation(
        toUserLocation({
          lat: latest.lat,
          lng: latest.lng,
          city: latest.city,
          region: latest.region,
          country: latest.country,
          isLive: false,
        }),
      )
    })()
  }, [])

  const applyLocation = useCallback(async (next: UserLocation) => {
    setLocation(next)
    const saved = await persistLocation(next)
    setSavedLocations(saved)
  }, [])

  const refresh = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync()
      if (!servicesEnabled) {
        throw new Error('Turn on location services in your phone settings')
      }

      let permission = await Location.getForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync()
      }
      if (permission.status !== 'granted') {
        throw new Error('Location permission denied')
      }

      let pos = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
      }

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      const city = geo?.city || geo?.subregion || geo?.district || LOCATION.city
      const region = geo?.district || geo?.subregion || geo?.city || city
      const country = geo?.country || LOCATION.country

      await applyLocation(
        toUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city,
          region,
          country,
          isLive: true,
        }),
      )
      return true
    } catch (e) {
      setLocation((prev) => ({
        ...prev,
        isLive: false,
        error: e instanceof Error ? e.message : 'Location unavailable',
      }))
      return false
    } finally {
      setLoading(false)
    }
  }, [applyLocation])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setLocation((prev) => ({
      ...prev,
      supportedCity: resolveSupportedCity(prev.city, prev.region),
    }))
  }, [fromApi])

  const selectCity = useCallback(
    async (city: SupportedCity) => {
      await applyLocation(
        toUserLocation({
          lat: city.lat,
          lng: city.lng,
          city: city.name,
          region: city.name,
          country: city.country,
          isLive: false,
        }),
      )
    },
    [applyLocation],
  )

  const selectSavedLocation = useCallback(
    async (saved: SavedLocation) => {
      await applyLocation(
        toUserLocation({
          lat: saved.lat,
          lng: saved.lng,
          city: saved.city,
          region: saved.region,
          country: saved.country,
          isLive: false,
        }),
      )
    },
    [applyLocation],
  )

  const searchAddress = useCallback(
    async (query: string): Promise<boolean> => {
      setLoading(true)
      try {
        const trimmed = query.trim()
        if (!trimmed) return false

        const candidates = [trimmed, `${trimmed}, India`]
        let hit: Location.LocationGeocodedLocation | null = null

        for (const candidate of candidates) {
          const results = await Location.geocodeAsync(candidate)
          if (results.length > 0) {
            hit = results[0]
            break
          }
        }

        if (!hit) return false

        const [geo] = await Location.reverseGeocodeAsync({
          latitude: hit.latitude,
          longitude: hit.longitude,
        })
        const city = geo?.city || geo?.subregion || trimmed
        const region = geo?.district || geo?.subregion || city
        const country = geo?.country || LOCATION.country

        await applyLocation(
          toUserLocation({
            lat: hit.latitude,
            lng: hit.longitude,
            city,
            region,
            country,
            isLive: false,
          }),
        )
        return true
      } catch {
        return false
      } finally {
        setLoading(false)
      }
    },
    [applyLocation],
  )

  const value = useMemo(
    () => ({
      location,
      savedLocations,
      loading,
      refresh,
      selectCity,
      selectSavedLocation,
      searchAddress,
    }),
    [location, savedLocations, loading, refresh, selectCity, selectSavedLocation, searchAddress],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  return useContext(LocationContext)
}
