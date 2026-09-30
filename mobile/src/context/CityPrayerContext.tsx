import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_CITY_PRAYER_CONFIG,
  getCityPrayerConfig,
  mapApiCitySettings,
  setCityPrayerConfig,
  type CityPrayerConfig,
} from '@/src/config/cityPrayerConfig'
import {
  SUPPORTED_CITIES,
  setRuntimeSupportedCities,
  type SupportedCity,
} from '@/src/constants/cities'
import { fetchCitySettings, fetchSupportedCities, isApiAvailable } from '@/src/services/api'

type CityPrayerContextValue = {
  config: CityPrayerConfig
  loading: boolean
  fromApi: boolean
  reload: () => Promise<void>
}

const CityPrayerContext = createContext<CityPrayerContextValue>({
  config: DEFAULT_CITY_PRAYER_CONFIG,
  loading: true,
  fromApi: false,
  reload: async () => {},
})

export function CityPrayerProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CityPrayerConfig>(getCityPrayerConfig())
  const [loading, setLoading] = useState(true)
  const [fromApi, setFromApi] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [data, cities] = await Promise.all([fetchCitySettings(), fetchSupportedCities()])
      const mapped = mapApiCitySettings(data)
      setCityPrayerConfig(mapped)
      setConfig(mapped)
      const fromApi = cities.map((city): SupportedCity => {
        const staticHit = SUPPORTED_CITIES.find((c) => c.id === city.id || c.name === city.name)
        return {
          id: city.id,
          name: city.name,
          country: city.country,
          lat: Number(city.lat) || staticHit?.lat || mapped.lat,
          lng: Number(city.lng) || staticHit?.lng || mapped.lng,
          aliases: [
            ...(city.aliases || []),
            city.id.replace(/-/g, ' '),
            city.name.toLowerCase(),
          ],
          pinCodes: city.pinCodes?.length ? city.pinCodes : staticHit?.pinCodes || [],
          pinPrefixes: city.pinPrefixes?.length ? city.pinPrefixes : staticHit?.pinPrefixes || [],
        }
      })
      // Keep static Tier-1 cities even if API omits some (e.g. no mosques yet).
      const byId = new Map<string, SupportedCity>()
      for (const c of fromApi) byId.set(c.id, c)
      for (const c of SUPPORTED_CITIES) {
        if (!byId.has(c.id)) byId.set(c.id, c)
      }
      setRuntimeSupportedCities([...byId.values()])
      setFromApi(await isApiAvailable())
    } catch {
      setCityPrayerConfig(DEFAULT_CITY_PRAYER_CONFIG)
      setConfig(DEFAULT_CITY_PRAYER_CONFIG)
      setRuntimeSupportedCities([])
      setFromApi(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo(
    () => ({ config, loading, fromApi, reload }),
    [config, loading, fromApi, reload],
  )

  return <CityPrayerContext.Provider value={value}>{children}</CityPrayerContext.Provider>
}

export function useCityPrayer() {
  return useContext(CityPrayerContext)
}
