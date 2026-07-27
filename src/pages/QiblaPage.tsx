import { useEffect, useMemo, useRef, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import {
  calculateQiblaBearing,
  distanceToKaaba,
  formatBearingLabel,
  formatDistanceKm,
  formatTurnHint,
  smoothHeading,
  turnToQibla,
} from '../utils/qibla'
import './QiblaPage.css'

interface QiblaPageProps {
  onBack: () => void
}

const DEFAULT_LAT = 28.6139
const DEFAULT_LNG = 77.209

function readDeviceHeading(event: DeviceOrientationEvent): number | null {
  if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
    return event.webkitCompassHeading
  }
  if (event.absolute && typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
    return (360 - event.alpha) % 360
  }
  return null
}

export function QiblaPage({ onBack }: QiblaPageProps) {
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [locationLabel, setLocationLabel] = useState('Detecting location…')
  const [heading, setHeading] = useState<number | null>(null)
  const [compassReady, setCompassReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const smoothedHeading = useRef<number | null>(null)

  const qiblaBearing = useMemo(() => calculateQiblaBearing(lat, lng), [lat, lng])
  const distanceKm = useMemo(() => distanceToKaaba(lat, lng), [lat, lng])
  const turnDegrees = heading != null ? turnToQibla(heading, qiblaBearing) : null
  const isAligned = turnDegrees != null && Math.abs(turnDegrees) <= 5
  const turnHint = turnDegrees != null ? formatTurnHint(turnDegrees) : 'Calibrating compass…'
  const dialRotation = heading != null ? -heading : 0

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel('Delhi, India (default)')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLocationLabel(`${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`)
      },
      () => {
        setLocationLabel('Delhi, India (default)')
        setError('Location unavailable — using default coordinates.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => {
    const handler = (event: DeviceOrientationEvent) => {
      const raw = readDeviceHeading(event)
      if (raw == null) return
      const next =
        smoothedHeading.current == null ? raw : smoothHeading(smoothedHeading.current, raw)
      smoothedHeading.current = next
      setHeading(next)
      setCompassReady(true)
    }

    async function start() {
      const request =
        typeof DeviceOrientationEvent !== 'undefined' &&
        'requestPermission' in DeviceOrientationEvent &&
        typeof (DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
        }).requestPermission === 'function'
          ? (DeviceOrientationEvent as typeof DeviceOrientationEvent & {
              requestPermission: () => Promise<'granted' | 'denied' | 'default'>
            }).requestPermission
          : null

      if (request) {
        try {
          const result = await request()
          if (result !== 'granted') {
            setError('Compass permission denied. Enable motion access in browser settings.')
            return
          }
        } catch {
          setError('Could not access device compass.')
          return
        }
      }

      window.addEventListener('deviceorientation', handler, true)
    }

    void start()
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [])

  return (
    <div className="qibla-page fade-in">
      <PageHeader title="Qibla Direction" onBack={onBack} />

      <div className="qibla-body">
        <p className="qibla-intro">Hold your device flat and turn until the Kaaba marker aligns with the top notch.</p>

        <div className={`compass-container${isAligned ? ' compass-aligned' : ''}`}>
          <div className="compass-top-notch" />
          <div className="compass-ring" style={{ transform: `rotate(${dialRotation}deg)` }}>
            <span className="compass-n">N</span>
            <span className="compass-e">E</span>
            <span className="compass-s">S</span>
            <span className="compass-w">W</span>
            <div className="compass-center-dot" />
            <div className="compass-qibla-arm" style={{ transform: `rotate(${qiblaBearing}deg)` }}>
              <div className="compass-qibla-marker">
                <div className="needle-top">🕋</div>
                <div className="needle-line" />
              </div>
            </div>
          </div>
          {!compassReady && !error && <p className="compass-loading">Starting compass…</p>}
        </div>

        <p className={`qibla-turn-hint${isAligned ? ' aligned' : ''}`}>{turnHint}</p>

        <div className="qibla-info card">
          <div className="qibla-stat">
            <span className="qibla-stat-label">Qibla Bearing</span>
            <span className="qibla-stat-value">{formatBearingLabel(qiblaBearing)}</span>
          </div>
          <div className="qibla-stat">
            <span className="qibla-stat-label">Distance to Kaaba</span>
            <span className="qibla-stat-value">{formatDistanceKm(distanceKm)}</span>
          </div>
          <div className="qibla-stat">
            <span className="qibla-stat-label">Your Location</span>
            <span className="qibla-stat-value">{locationLabel}</span>
          </div>
          {heading != null && (
            <div className="qibla-stat">
              <span className="qibla-stat-label">Device Heading</span>
              <span className="qibla-stat-value">{formatBearingLabel(heading)}</span>
            </div>
          )}
        </div>

        {error ? <p className="qibla-note qibla-error">{error}</p> : null}
        <p className="qibla-note">Uses your GPS location and device compass for live Qibla direction toward the Kaaba in Mecca.</p>
      </div>
    </div>
  )
}
