import { useCallback, useEffect, useMemo, useState } from 'react'
import { mosqueBelongsToCity } from '@/src/constants/cities'
import { DEFAULT_MOSQUE_TIMINGS } from '@/src/data/mockData'
import { fetchMosques } from '@/src/services/api'
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
  const [loaded, setLoaded] = useState<Mosque[]>([])
  const [loading, setLoading] = useState(true)
  const [fromApi, setFromApi] = useState(false)
  // A failed refresh keeps the last list from the server and never shows sample mosques.
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLoaded(enrichList(await fetchMosques()))
      setFromApi(true)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const allMosques = useMemo(
    () => applyUserDistances(loaded, location.lat, location.lng),
    [loaded, location.lat, location.lng],
  )

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
    failed: failed && loaded.length === 0,
    citySupported,
    supportedCity: location.supportedCity,
    detectedCity: location.city,
    reload: load,
  }
}
