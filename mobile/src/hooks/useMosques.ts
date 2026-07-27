import { useCallback, useEffect, useMemo, useState } from 'react'
import { mosqueBelongsToCity } from '@/src/constants/cities'
import { DEFAULT_MOSQUE_TIMINGS, LOCATION, MOCK_MOSQUES } from '@/src/data/mockData'
import { fetchMosques, isApiAvailable } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { applyUserDistances } from '@/src/utils/geo'
import type { UserLocation } from '@/src/hooks/useLocation'

function normalizeTimings(mosque: Mosque): Mosque {
  const timings = { ...DEFAULT_MOSQUE_TIMINGS }
  for (const prayer of Object.keys(timings) as Array<keyof typeof timings>) {
    const slot = mosque.timings?.[prayer]
    if (slot) {
      timings[prayer] = {
        start: slot.start || timings[prayer].start,
        azan: slot.azan || timings[prayer].azan,
        jamat: slot.jamat || timings[prayer].jamat,
        end: slot.end || timings[prayer].end,
      }
    }
  }
  return { ...mosque, timings, city: mosque.city || 'Delhi' }
}

function enrichList(list: Mosque[]): Mosque[] {
  return list.map(normalizeTimings)
}

export function useMosques(location: UserLocation) {
  const [allMosques, setAllMosques] = useState<Mosque[]>(() =>
    applyUserDistances(enrichList(MOCK_MOSQUES), location.lat, location.lng),
  )
  const [loading, setLoading] = useState(true)
  const [fromApi, setFromApi] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await fetchMosques()
      const located = applyUserDistances(enrichList(raw), location.lat, location.lng)
      setAllMosques(located)
      setFromApi(await isApiAvailable())
    } catch {
      setAllMosques(applyUserDistances(enrichList(MOCK_MOSQUES), location.lat, location.lng))
      setFromApi(false)
    } finally {
      setLoading(false)
    }
  }, [location.lat, location.lng])

  useEffect(() => {
    void load()
  }, [load])

  const citySupported = location.supportedCity !== null

  const mosques = useMemo(() => {
    if (!location.supportedCity) return []
    return allMosques.filter((m) => mosqueBelongsToCity(m.city, location.supportedCity!))
  }, [allMosques, location.supportedCity])

  return {
    mosques,
    allMosques,
    loading,
    fromApi,
    citySupported,
    supportedCity: location.supportedCity,
    detectedCity: location.city,
    reload: load,
  }
}
