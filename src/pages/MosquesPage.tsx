import { useMemo, useState } from 'react'
import { MosquePeekOverlay } from '../components/MosquePeekOverlay'
import { MosqueFacilitiesLine } from '../components/MosqueFacilitiesLine'
import { MosqueNotifyToggle } from '../components/MosqueNotifyToggle'
import { useLongPress } from '../hooks/useLongPress'
import { useMosques } from '../hooks/useMosques'
import type { Mosque } from '../types'
import { MOSQUE_SORT_OPTIONS, sortMosques, type MosqueSortMode } from '../utils/mosqueSort'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  MOSQUE_RADIUS_OPTIONS,
  type MosqueRadiusKm,
} from '../constants/mosqueRadius'

function radiusChipLabel(r: MosqueRadiusKm): string {
  if (r >= CITY_RADIUS_KM) return 'City'
  if (r < 1) return '500 m'
  return `${r} km`
}
import './MosquesPage.css'
import '../components/MosqueFacilitiesLine.css'

interface MosquesPageProps {
  onSelectMosque: (mosque: Mosque) => void
  onNeedLogin?: () => void
}

const RADIUS_OPTIONS = MOSQUE_RADIUS_OPTIONS

interface MosqueListCardProps {
  mosque: Mosque
  isPeekOpen: boolean
  onSelect: (mosque: Mosque) => void
  onPeek: (mosque: Mosque) => void
  onNeedLogin?: () => void
}

function MosqueListCard({ mosque, isPeekOpen, onSelect, onPeek, onNeedLogin }: MosqueListCardProps) {
  const [pressing, setPressing] = useState(false)
  const { bind, consumeClick } = useLongPress(() => onPeek(mosque))
  const pressHandlers = bind()

  return (
    <div
      className={`mosque-list-card card${pressing ? ' mosque-list-card--pressing' : ''}${isPeekOpen ? ' mosque-list-card--peek-origin' : ''}`}
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
      <span
        className={`live-status live-status--${mosque.arrivalStatus}`}
        title={mosque.arrivalMessage}
        aria-label={mosque.arrivalMessage}
      />
      <div
        className="mosque-list-info"
        role="button"
        tabIndex={0}
        onClick={() => {
          if (consumeClick()) return
          onSelect(mosque)
        }}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(mosque)}
      >
        <div className="mosque-name">{mosque.name}</div>
        <div className="mosque-address-line">{mosque.address}</div>
        <MosqueFacilitiesLine facilities={mosque.facilities} max={3} />
        <div className="mosque-meta">
          {mosque.distance} km · {mosque.area} · {mosque.travelMinutes} min
        </div>
      </div>
      <MosqueNotifyToggle mosqueId={mosque.id} onNeedLogin={onNeedLogin} />
    </div>
  )
}

export function MosquesPage({ onSelectMosque, onNeedLogin }: MosquesPageProps) {
  const [search, setSearch] = useState('')
  const [radius, setRadius] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const { mosques: mosqueList } = useMosques()

  const filtered = useMemo(() => {
    const matches = mosqueList.filter((m) => {
      const matchesSearch =
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.area.toLowerCase().includes(search.toLowerCase())
      const matchesRadius = m.distance <= radius
      return matchesSearch && matchesRadius
    })
    return sortMosques(matches, sortMode)
  }, [search, radius, sortMode, mosqueList])

  return (
    <div className="mosques-page fade-in">
      <div className="mosques-toolbar">
        <input
          type="text"
          placeholder="Search mosques..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input search-input--compact"
        />
        <div className="mosques-toolbar-row">
          <div className="chip-group chip-group--compact">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                className={`chip chip--compact ${radius === r ? 'active' : ''}`}
                onClick={() => setRadius(r)}
              >
                {radiusChipLabel(r)}
              </button>
            ))}
          </div>
          <span className="results-count">{filtered.length} found</span>
        </div>
        <div className="mosques-sort-bar" role="group" aria-label="Sort mosques">
          {MOSQUE_SORT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`chip chip--compact${sortMode === id ? ' active' : ''}`}
              onClick={() => setSortMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mosques-list">
        {filtered.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <span>🕌</span>
            <p>No mosques for this radius. Try a larger range.</p>
          </div>
        ) : (
          filtered.map((mosque) => (
            <MosqueListCard
              key={mosque.id}
              mosque={mosque}
              isPeekOpen={peekMosque?.id === mosque.id}
              onSelect={onSelectMosque}
              onPeek={setPeekMosque}
              onNeedLogin={onNeedLogin}
            />
          ))
        )}
      </div>

      <MosquePeekOverlay
        mosque={peekMosque}
        open={peekMosque !== null}
        onClose={() => setPeekMosque(null)}
        onViewFull={onSelectMosque}
        onNeedLogin={onNeedLogin}
      />
    </div>
  )
}
