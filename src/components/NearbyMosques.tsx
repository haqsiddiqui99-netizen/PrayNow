import { useEffect, useMemo, useState } from 'react'
import { MosquePrayerTimes } from './MosquePrayerTimes'
import { MosqueFacilitiesLine } from './MosqueFacilitiesLine'
import { MosqueNotifyToggle } from './MosqueNotifyToggle'
import { MosquePeekOverlay } from './MosquePeekOverlay'
import type { ArrivalStatus, Mosque } from '../types'
import { useMosques } from '../hooks/useMosques'
import { useLongPress } from '../hooks/useLongPress'
import { getCurrentPrayerForMosques } from '../utils/prayerSchedule'
import { MOSQUE_SORT_OPTIONS, sortMosques, type MosqueSortMode } from '../utils/mosqueSort'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  filterMosquesByRadius,
  formatNearbyMosqueHeading,
  HOME_NEARBY_PREVIEW_LIMIT,
  MOSQUE_RADIUS_OPTIONS,
  type MosqueRadiusKm,
} from '../constants/mosqueRadius'
import {
  TRAVEL_MODES,
  getArrivalInfoForMosque,
  getTravelMinutes,
  openGoogleMaps,
  type TravelMode,
} from '../utils/travelTime'
import './NearbyMosques.css'
import './MosqueFacilitiesLine.css'

function radiusChipLabel(r: MosqueRadiusKm): string {
  if (r >= CITY_RADIUS_KM) return 'City'
  if (r < 1) return '500 m'
  return `${r} km`
}

interface NearbyMosquesProps {
  onSelectMosque: (mosque: Mosque) => void
  onNeedLogin?: () => void
}

function MapsIcon() {
  return (
    <svg className="maps-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#EA4335"
      />
      <circle cx="12" cy="9" r="2.5" fill="white" />
    </svg>
  )
}

function travelModeShort(mode: TravelMode): string {
  if (mode === 'walking') return 'walk'
  if (mode === 'transit') return 'transit'
  return 'drive'
}

function LiveStatusButton({ status, title }: { status: ArrivalStatus; title: string }) {
  return (
    <span
      className={`live-status live-status--${status}`}
      title={title}
      aria-label={title}
    />
  )
}

interface NearbyMosqueCardProps {
  mosque: Mosque
  travelMode: TravelMode
  travelMinutes: number
  arrival: { status: ArrivalStatus; message: string }
  currentPrayer: ReturnType<typeof getCurrentPrayerForMosques>
  isPeekOpen: boolean
  onSelectMosque: (mosque: Mosque) => void
  onPeek: (mosque: Mosque) => void
  onNeedLogin?: () => void
}

function NearbyMosqueCard({
  mosque,
  travelMode,
  travelMinutes,
  arrival,
  currentPrayer,
  isPeekOpen,
  onSelectMosque,
  onPeek,
  onNeedLogin,
}: NearbyMosqueCardProps) {
  const [pressing, setPressing] = useState(false)
  const { bind, consumeClick } = useLongPress(() => onPeek(mosque))
  const pressHandlers = bind()

  return (
    <div
      className={`nearby-card card${pressing ? ' nearby-card--pressing' : ''}${isPeekOpen ? ' nearby-card--peek-origin' : ''}`}
      onPointerDown={(e) => {
        pressHandlers.onPointerDown(e)
        setPressing(true)
      }}
      onPointerMove={pressHandlers.onPointerMove}
      onPointerUp={() => {
        pressHandlers.onPointerUp()
        setPressing(false)
      }}
      onPointerLeave={() => {
        pressHandlers.onPointerLeave()
        setPressing(false)
      }}
      onPointerCancel={() => {
        pressHandlers.onPointerCancel()
        setPressing(false)
      }}
      onContextMenu={pressHandlers.onContextMenu}
    >
      <div className="nearby-card-main">
        <div
          className="nearby-card-body"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (consumeClick()) return
            onSelectMosque(mosque)
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSelectMosque(mosque)}
        >
          <div className="mosque-name-row">
            <LiveStatusButton status={arrival.status} title={arrival.message} />
            <div className="mosque-name">{mosque.name}</div>
          </div>
          <div className="mosque-address-line">{mosque.address}</div>
          <MosqueFacilitiesLine facilities={mosque.facilities} max={3} />
          <div className="mosque-meta-line">
            {mosque.distance} km · {mosque.area}
          </div>
        </div>

        <div className="nearby-notify-col">
          <MosqueNotifyToggle mosqueId={mosque.id} onNeedLogin={onNeedLogin} />
        </div>

        {currentPrayer ? (
          <MosquePrayerTimes
            mosque={mosque}
            prayerName={currentPrayer.name}
            displayName={currentPrayer.displayName}
            inZawal={currentPrayer.inZawal}
          />
        ) : (
          <div className="mosque-prayer-times mosque-prayer-times--empty">
            <span className="prayer-times-empty">No active prayer</span>
          </div>
        )}

        <div className="maps-column">
          <button
            type="button"
            className="maps-icon-btn"
            aria-label={`Open ${mosque.name} in Google Maps`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openGoogleMaps(mosque, travelMode)}
          >
            <MapsIcon />
          </button>
          <span className="maps-time">
            {travelMinutes} min {travelModeShort(travelMode)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function NearbyMosques({ onSelectMosque, onNeedLogin }: NearbyMosquesProps) {
  const [travelMode, setTravelMode] = useState<TravelMode>('driving')
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [tick, setTick] = useState(0)
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const { mosques: mosqueList, loading } = useMosques()

  const nearbyAll = useMemo(() => {
    return filterMosquesByRadius(sortMosques(mosqueList, sortMode), radiusKm)
  }, [mosqueList, sortMode, radiusKm, tick])

  const sortedMosques = useMemo(() => nearbyAll.slice(0, HOME_NEARBY_PREVIEW_LIMIT), [nearbyAll])

  const nearbyHeading = formatNearbyMosqueHeading({
    count: nearbyAll.length,
    radiusKm,
    loading,
  })

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const currentPrayer = getCurrentPrayerForMosques()

  return (
    <div className="nearby-mosques">
      <div className="nearby-header">
        <div className="nearby-header-text">
          <h3 className="nearby-title">{nearbyHeading}</h3>
        </div>
      </div>

      <div className="chip-group chip-group--compact nearby-radius-bar">
        {MOSQUE_RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip chip--compact${radiusKm === r ? ' active' : ''}`}
            onClick={() => setRadiusKm(r)}
          >
            {radiusChipLabel(r)}
          </button>
        ))}
      </div>

      <div className="travel-mode-bar">
        {TRAVEL_MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            className={`travel-mode-btn ${travelMode === mode ? 'active' : ''}`}
            onClick={() => setTravelMode(mode)}
            aria-label={label}
          >
            <span>{icon}</span>
            <span className="travel-mode-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="mosque-sort-bar" role="group" aria-label="Sort mosques">
        {MOSQUE_SORT_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`mosque-sort-chip${sortMode === id ? ' active' : ''}`}
            onClick={() => setSortMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="arrival-legend" aria-label="Arrival status legend">
        <span className="arrival-legend-item"><span className="live-status live-status--early" /> Early</span>
        <span className="arrival-legend-item"><span className="live-status live-status--on-time" /> On time</span>
        <span className="arrival-legend-item"><span className="live-status live-status--late" /> Late</span>
      </div>

      <div className="nearby-list">
        {!loading && nearbyAll.length === 0 ? (
          <p className="nearby-empty">No mosques within {radiusKm} km. Try a larger radius.</p>
        ) : null}
        {sortedMosques.map((mosque) => {
          const travelMinutes = getTravelMinutes(mosque, travelMode)
          const arrival = currentPrayer
            ? getArrivalInfoForMosque(mosque, travelMinutes, currentPrayer.name)
            : { status: 'late' as ArrivalStatus, message: 'No active prayer', bufferMinutes: -1 }

          return (
            <NearbyMosqueCard
              key={mosque.id}
              mosque={mosque}
              travelMode={travelMode}
              travelMinutes={travelMinutes}
              arrival={arrival}
              currentPrayer={currentPrayer}
              isPeekOpen={peekMosque?.id === mosque.id}
              onSelectMosque={onSelectMosque}
              onPeek={setPeekMosque}
              onNeedLogin={onNeedLogin}
            />
          )
        })}
      </div>

      <MosquePeekOverlay
        mosque={peekMosque}
        open={peekMosque !== null}
        onClose={() => setPeekMosque(null)}
        onViewFull={onSelectMosque}
        onNeedLogin={onNeedLogin}
      />

      <span hidden aria-hidden="true">{tick}</span>
    </div>
  )
}
