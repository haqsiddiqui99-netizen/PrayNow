import * as Location from 'expo-location'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getSupportedCities,
  resolveCityByPincode,
  resolveSupportedCity,
  type SupportedCity,
} from '@/src/constants/cities'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { LOCATION } from '@/src/data/mockData'
import {
  buildSavedLocation,
  isSameSavedLocation,
  loadSavedLocations,
  removeSavedLocation as removeSavedLocationFromStorage,
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
  removeSavedLocation: (id: string) => Promise<void>
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
  const supported = loc.supportedCity
  const saved = buildSavedLocation({
    label: loc.label,
    city: supported?.name ?? loc.city,
    region: supported?.name ?? loc.region,
    country: supported?.country ?? loc.country,
    lat: supported?.lat ?? loc.lat,
    lng: supported?.lng ?? loc.lng,
    supportedCityId: supported?.id,
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

/** Native GPS often fails indoors with "6000ms timeout exceeded" — keep UX quiet. */
const GPS_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /timeout/i.test(msg)
}

async function readDevicePosition(): Promise<Location.LocationObject | null> {
  const last = await Location.getLastKnownPositionAsync({
    maxAge: 15 * 60_000,
    requiredAccuracy: 1000,
  }).catch(() => null)
  if (last) return last

  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
      }),
      GPS_TIMEOUT_MS,
      'Location',
    )
  } catch {
    // Last resort: any cached fix, even stale
    return Location.getLastKnownPositionAsync({ maxAge: 24 * 60 * 60_000 }).catch(() => null)
  }
}

const LocationContext = createContext<LocationContextValue>({
  location: defaultLocation,
  savedLocations: [],
  loading: true,
  refresh: async () => false,
  selectCity: async () => {},
  selectSavedLocation: async () => {},
  removeSavedLocation: async () => {},
  searchAddress: async () => false,
})

export function LocationProvider({ children }: { children: ReactNode }) {
  const { fromApi } = useCityPrayer()
  const [location, setLocation] = useState<UserLocation>(defaultLocation)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    void (async () => {
      const saved = await loadSavedLocations()
      if (saved.length === 0) {
        const seeded = await persistLocation(defaultLocation)
        setSavedLocations(seeded)
        setHydrated(true)
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
      setHydrated(true)
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
        // Keep saved city — don't block the home screen
        setLocation((prev) => ({ ...prev, isLive: false, error: undefined }))
        return false
      }

      let permission = await Location.getForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync()
      }
      if (permission.status !== 'granted') {
        setLocation((prev) => ({ ...prev, isLive: false, error: undefined }))
        return false
      }

      const pos = await readDevicePosition()
      if (!pos) {
        setLocation((prev) => ({ ...prev, isLive: false, error: undefined }))
        return false
      }

      let city = LOCATION.city
      let region = LOCATION.city
      let country = LOCATION.country
      try {
        const [geo] = await withTimeout(
          Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
          8000,
          'Geocode',
        )
        city = geo?.city || geo?.subregion || geo?.district || LOCATION.city
        region = geo?.district || geo?.subregion || geo?.city || city
        country = geo?.country || LOCATION.country
      } catch {
        // Keep coords with previous/default city labels if reverse geocode is slow
        city = LOCATION.city
        region = LOCATION.city
        country = LOCATION.country
      }

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
      // Never surface raw "6000ms timeout exceeded" to the user
      setLocation((prev) => ({
        ...prev,
        isLive: false,
        error: isTimeoutError(e) ? undefined : e instanceof Error ? e.message : 'Location unavailable',
      }))
      return false
    } finally {
      setLoading(false)
    }
  }, [applyLocation])

  // Wait for saved location, then try GPS in background (failures stay silent)
  useEffect(() => {
    if (!hydrated) return
    void refresh()
  }, [hydrated, refresh])

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

  const removeSavedLocation = useCallback(
    async (id: string) => {
      const deleted = savedLocations.find((item) => item.id === id)
      const next = await removeSavedLocationFromStorage(id)
      setSavedLocations(next)
      if (!deleted) return

      const currentSaved = buildSavedLocation({
        label: location.label,
        city: location.supportedCity?.name ?? location.city,
        region: location.supportedCity?.name ?? location.region,
        country: location.supportedCity?.country ?? location.country,
        lat: location.supportedCity?.lat ?? location.lat,
        lng: location.supportedCity?.lng ?? location.lng,
        supportedCityId: location.supportedCity?.id,
      })

      if (!isSameSavedLocation(deleted, currentSaved)) return

      if (next.length > 0) {
        const fallback = next[0]
        setLocation(
          toUserLocation({
            lat: fallback.lat,
            lng: fallback.lng,
            city: fallback.city,
            region: fallback.region,
            country: fallback.country,
            isLive: false,
          }),
        )
      } else {
        setLocation(defaultLocation)
      }
    },
    [savedLocations, location],
  )

  const searchAddress = useCallback(
    async (query: string): Promise<boolean> => {
      setLoading(true)
      try {
        const trimmed = query.trim()
        if (!trimmed) return false

        const digitsOnly = trimmed.replace(/\D/g, '')
        if (digitsOnly.length >= 3 && digitsOnly.length <= 6 && /^\d+$/.test(trimmed.replace(/\s/g, ''))) {
          const byPin = resolveCityByPincode(digitsOnly)
          if (byPin) {
            await applyLocation(
              toUserLocation({
                lat: byPin.lat,
                lng: byPin.lng,
                city: byPin.name,
                region: digitsOnly.length === 6 ? `PIN ${digitsOnly}` : byPin.name,
                country: byPin.country,
                isLive: false,
              }),
            )
            return true
          }
        }

        const needle = trimmed.toLowerCase()
        const catalogHit =
          getSupportedCities().find(
            (city) =>
              city.name.toLowerCase() === needle ||
              city.id.replace(/-/g, ' ') === needle ||
              city.aliases.some((alias) => alias === needle) ||
              (city.pinCodes || []).includes(digitsOnly),
          ) || resolveSupportedCity(trimmed, trimmed)

        if (catalogHit) {
          await applyLocation(
            toUserLocation({
              lat: catalogHit.lat,
              lng: catalogHit.lng,
              city: catalogHit.name,
              region: catalogHit.name,
              country: catalogHit.country,
              isLive: false,
            }),
          )
          return true
        }

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
      removeSavedLocation,
      searchAddress,
    }),
    [location, savedLocations, loading, refresh, selectCity, selectSavedLocation, removeSavedLocation, searchAddress],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  return useContext(LocationContext)
}
