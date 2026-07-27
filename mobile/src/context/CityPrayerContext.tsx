import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_CITY_PRAYER_CONFIG,
  getCityPrayerConfig,
  mapApiCitySettings,
  setCityPrayerConfig,
  type CityPrayerConfig,
} from '@/src/config/cityPrayerConfig'
import { setRuntimeSupportedCities, type SupportedCity } from '@/src/constants/cities'
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
      setRuntimeSupportedCities(
        cities.map(
          (city): SupportedCity => ({
            id: city.id,
            name: city.name,
            country: city.country,
            lat: Number(city.lat) || mapped.lat,
            lng: Number(city.lng) || mapped.lng,
            aliases: [
              ...(city.aliases || []),
              city.id.replace(/-/g, ' '),
              city.name.toLowerCase(),
            ],
          }),
        ),
      )
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
