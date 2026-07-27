import { useEffect, useState } from 'react'
import { useUserLocation } from '../context/UserLocationContext'
import { MOSQUES } from '../data/mockData'
import type { Mosque } from '../types'
import { api, isApiAvailable } from '../services/api'
import { applyUserDistances } from '../utils/geo'
import { DEFAULT_MOSQUE_TIMINGS } from '../data/mockData'

export function useMosques() {
  const { lat, lng, loading: locationLoading } = useUserLocation()
  const [mosques, setMosques] = useState<Mosque[]>(MOSQUES)
  const [loading, setLoading] = useState(true)
  const [fromApi, setFromApi] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!(await isApiAvailable())) throw new Error('offline')
        const data = await api.getMosques()
        if (!cancelled) {
          setMosques(enrichMosques(data, lat, lng))
          setFromApi(true)
        }
      } catch {
        if (!cancelled) {
          setMosques(enrichMosques(MOSQUES, lat, lng))
          setFromApi(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [lat, lng])

  return {
    mosques,
    loading: loading || locationLoading,
    fromApi,
    refresh: async () => {
      const data = await api.getMosques()
      setMosques(enrichMosques(data, lat, lng))
      setFromApi(true)
    },
  }
}

function enrichMosques(list: Mosque[], userLat: number, userLng: number): Mosque[] {
  const located = applyUserDistances(list, userLat, userLng)

  return located.map((m) => {
    const mock = MOSQUES.find((x) => x.id === m.id || x.name === m.name)
    const base = {
      ...m,
      imamDetails: m.imamDetails ?? { name: m.imam || '', mobile: '', photo: '' },
      moazzinDetails: m.moazzinDetails ?? { name: '', mobile: '', photo: '' },
      jumaTimings: m.jumaTimings ?? {
        azan: '12:15 PM',
        khutba: '12:15 PM',
        namaz: '12:30 PM',
        sessions: [{ azan: '12:15 PM', khutba: '12:15 PM', namaz: '12:30 PM' }],
      },
      timings: normalizeTimings(m.timings),
      rating: mock?.rating ?? m.rating,
      reviewCount: mock?.reviewCount ?? m.reviewCount,
      arrivalStatus: mock?.arrivalStatus ?? m.arrivalStatus,
      arrivalMessage: mock?.arrivalMessage ?? m.arrivalMessage,
      reviews: mock?.reviews ?? m.reviews,
      photos: mock?.photos ?? m.photos,
    }
    return base
  })
}

function normalizeTimings(timings: Mosque['timings']): Mosque['timings'] {
  const result = { ...DEFAULT_MOSQUE_TIMINGS }
  for (const prayer of Object.keys(result) as Array<keyof Mosque['timings']>) {
    const slot = timings[prayer]
    if (slot) {
      result[prayer] = {
        start: slot.start || slot.azan || result[prayer].start,
        azan: slot.azan || result[prayer].azan,
        jamat: slot.jamat || result[prayer].jamat,
        end: slot.end || result[prayer].end,
      }
    }
  }
  return result
}
