import { useEffect, useRef, useState, type FormEvent } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
    gm_authFailure?: () => void
  }
}

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()
const INDIA_CENTRE = { lat: 22.9, lng: 79.0 }

let loading: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY || '')}&v=weekly`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        loading = null
        reject(new Error('Could not reach Google Maps.'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

type Props = {
  lat: number
  lng: number
  /** Address text, used to centre the preview before a pin exists. */
  hint: string
  onPick: (lat: number, lng: number) => void
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6

/**
 * Google map for setting where the mosque is. With a browser key (VITE_GOOGLE_MAPS_API_KEY) it is
 * interactive: click the map or drag the pin. Without one it shows a Google preview of the saved pin.
 */
export function MapPicker({ lat, lng, hint, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
  const [mode, setMode] = useState<'loading' | 'google' | 'preview'>(KEY ? 'loading' : 'preview')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!KEY) return
    let dead = false
    window.gm_authFailure = () => {
      if (dead) return
      setMode('preview')
      setNote('Google refused the map key. Turn on "Maps JavaScript API" for it and allow this address.')
    }
    loadGoogleMaps()
      .then(() => {
        if (dead || !box.current) return
        const maps = window.google.maps
        const start = hasPin ? { lat, lng } : INDIA_CENTRE
        const map = new maps.Map(box.current, {
          center: start,
          zoom: hasPin ? 17 : 5,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          gestureHandling: 'cooperative',
        })
        const marker = new maps.Marker({ position: start, map: hasPin ? map : null, draggable: true })
        const set = (point: { lat: () => number; lng: () => number } | null | undefined) => {
          if (!point) return
          pickRef.current(round6(point.lat()), round6(point.lng()))
          if (map.getZoom() < 15) map.setZoom(16)
        }
        map.addListener('click', (event: any) => set(event.latLng))
        marker.addListener('dragend', (event: any) => set(event.latLng))
        mapRef.current = map
        markerRef.current = marker
        setMode('google')
      })
      .catch((err: unknown) => {
        if (dead) return
        setMode('preview')
        setNote(err instanceof Error ? err.message : 'Google Maps did not load.')
      })
    return () => {
      dead = true
    }
    // The map is built once; later pin changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (mode !== 'google' || !map || !marker) return
    if (!hasPin) {
      marker.setMap(null)
      return
    }
    const position = { lat, lng }
    marker.setPosition(position)
    marker.setMap(map)
    const bounds = map.getBounds()
    if (!bounds || !bounds.contains(position)) map.panTo(position)
  }, [mode, hasPin, lat, lng])

  const search = (event: FormEvent) => {
    event.preventDefault()
    const text = query.trim() || hint.trim()
    if (!text || mode !== 'google') return
    setSearching(true)
    setNote('')
    new window.google.maps.Geocoder().geocode({ address: text, region: 'in' }, (results: any[] | null, status: string) => {
      setSearching(false)
      if (status !== 'OK' || !results?.length) {
        setNote(
          status === 'ZERO_RESULTS'
            ? 'Google found nothing for that. Try the area and city.'
            : `Search did not work (${status}). Click the map instead.`,
        )
        return
      }
      const point = results[0].geometry.location
      pickRef.current(round6(point.lat()), round6(point.lng()))
      mapRef.current?.setZoom(17)
    })
  }

  const previewQuery = hasPin ? `${lat},${lng}` : hint.trim() || 'India'
  const previewSrc = `https://www.google.com/maps?q=${encodeURIComponent(previewQuery)}&z=${hasPin ? 17 : 11}&output=embed`

  return (
    <div className="map-picker">
      {KEY && mode !== 'preview' ? (
        <form className="map-search" onSubmit={search}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={hint ? `Search on Google, or leave empty for: ${hint}` : 'Search an address or place'}
            aria-label="Search the map"
          />
          <button type="submit" className="ghost slim dark" disabled={searching || mode !== 'google'}>
            {searching ? 'Searching...' : 'Find'}
          </button>
        </form>
      ) : null}

      <div className="map-box">
        {KEY ? <div ref={box} className="map-canvas" style={{ display: mode === 'preview' ? 'none' : 'block' }} /> : null}
        {mode === 'loading' ? <p className="map-wait">Loading Google Maps...</p> : null}
        {mode === 'preview' ? (
          <iframe title="Mosque location on Google Maps" src={previewSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        ) : null}
      </div>

      {mode === 'preview' ? (
        <p className="map-note">
          {note ||
            'This is a Google preview of the saved pin. To click or drag the pin here, add VITE_GOOGLE_MAPS_API_KEY to the project .env and restart the desk. Until then paste a Google Maps link or coordinates below.'}
        </p>
      ) : note ? (
        <p className="map-note issue">{note}</p>
      ) : (
        <p className="map-note">Click the map or drag the pin to set the mosque. The numbers on the right follow it.</p>
      )}
    </div>
  )
}
