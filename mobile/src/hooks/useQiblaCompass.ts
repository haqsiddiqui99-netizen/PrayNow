import * as Location from 'expo-location'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  calculateQiblaBearing,
  distanceToKaaba,
  formatTurnHint,
  smoothHeading,
  turnToQibla,
} from '@/src/utils/qibla'

export function useQiblaCompass(lat: number, lng: number) {
  const [heading, setHeading] = useState<number | null>(null)
  const [compassReady, setCompassReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const smoothedHeading = useRef<number | null>(null)

  const qiblaBearing = useMemo(() => calculateQiblaBearing(lat, lng), [lat, lng])
  const distanceKm = useMemo(() => distanceToKaaba(lat, lng), [lat, lng])

  const turnDegrees = heading != null ? turnToQibla(heading, qiblaBearing) : null
  const isAligned = turnDegrees != null && Math.abs(turnDegrees) <= 5
  const turnHint = turnDegrees != null ? formatTurnHint(turnDegrees) : 'Calibrating compass…'

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null
    let cancelled = false

    async function start() {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync()
        if (!servicesEnabled) {
          setError('Turn on location services to use the live Qibla compass.')
          return
        }

        let permission = await Location.getForegroundPermissionsAsync()
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync()
        }
        if (permission.status !== 'granted') {
          setError('Location permission is required for Qibla direction.')
          return
        }

        subscription = await Location.watchHeadingAsync((data) => {
          if (cancelled) return

          const raw = data.trueHeading >= 0 ? data.trueHeading : data.magHeading
          if (raw < 0) return

          const next =
            smoothedHeading.current == null
              ? raw
              : smoothHeading(smoothedHeading.current, raw)
          smoothedHeading.current = next
          setHeading(next)
          setCompassReady(true)
          setError(null)
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Compass unavailable on this device.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [])

  return {
    heading,
    qiblaBearing,
    distanceKm,
    turnDegrees,
    isAligned,
    turnHint,
    compassReady,
    error,
  }
}
