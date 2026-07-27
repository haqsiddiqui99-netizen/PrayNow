import type { ReactNode } from 'react'
import { ZAWAL } from '../data/mockData'
import type { Mosque, PrayerName } from '../types'
import { formatCompactTime, isFriday } from '../utils/prayerSchedule'
import './MosquePrayerTimes.css'

interface MosquePrayerTimesProps {
  mosque: Mosque
  prayerName: PrayerName
  displayName?: string
  inZawal?: boolean
}

function InlineTimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="prayer-time-inline">
      <span className="prayer-time-key">{label}</span>
      <span className="prayer-time-val">{formatCompactTime(value)}</span>
    </div>
  )
}

function TimeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="prayer-times-group">
      <div className="prayer-times-label">{title}</div>
      {children}
    </div>
  )
}

export function MosquePrayerTimes({
  mosque,
  prayerName,
  displayName,
  inZawal = false,
}: MosquePrayerTimesProps) {
  const slot = mosque.timings[prayerName]
  const isJumaFriday = prayerName === 'Dhuhr' && isFriday()
  const title = (displayName ?? prayerName).toUpperCase()
  const showZawal = prayerName === 'Dhuhr'

  const primaryLeftLabel = isJumaFriday ? 'Khutba' : 'Azan'
  const primaryLeftValue = isJumaFriday
    ? (mosque.jumaTimings.khutba || slot.azan)
    : slot.azan
  const primaryRightValue = isJumaFriday
    ? (mosque.jumaTimings.namaz || slot.jamat)
    : slot.jamat

  return (
    <div className="mosque-prayer-times">
      {showZawal && (
        <>
          <div className={`zawal-block${inZawal ? ' zawal-block--active' : ''}`}>
            <div className="prayer-times-label">Zawal</div>
            <div className="zawal-range">
              {formatCompactTime(ZAWAL.start)} — {formatCompactTime(ZAWAL.end)}
            </div>
            {inZawal && (
              <div className="zawal-warning">🔴 No prayer</div>
            )}
          </div>
          <div className="prayer-times-divider" />
        </>
      )}
      <TimeGroup title={title}>
        <div className="prayer-times-inline-row">
          <InlineTimeRow label={primaryLeftLabel} value={primaryLeftValue} />
          <span className="prayer-time-sep" aria-hidden="true">·</span>
          <InlineTimeRow label="Namaz" value={primaryRightValue} />
        </div>
      </TimeGroup>
    </div>
  )
}
