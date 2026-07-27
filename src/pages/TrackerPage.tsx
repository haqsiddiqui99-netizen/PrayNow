import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PRAYER_TIMES } from '../data/mockData'
import type { PrayerName } from '../types'
import './TrackerPage.css'

const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

interface TrackerPageProps {
  onBack: () => void
}

export function TrackerPage({ onBack }: TrackerPageProps) {
  const [completed, setCompleted] = useState<Set<PrayerName>>(new Set(['Fajr']))

  const toggle = (name: PrayerName) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const count = completed.size
  const percentage = Math.round((count / 5) * 100)

  return (
    <div className="tracker-page fade-in">
      <PageHeader title="Prayer Tracker" onBack={onBack} />

      <div className="tracker-body">
      <div className="tracker-progress card">
        <div className="progress-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-1)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke="var(--primary)" strokeWidth="10"
              strokeDasharray={`${percentage * 3.27} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="progress-text">
            <span className="progress-count">{count}/5</span>
            <span className="progress-label">Today</span>
          </div>
        </div>
        <div className="progress-message">
          {count === 5 ? '🎉 All prayers completed! MashaAllah' : `${5 - count} prayer${5 - count !== 1 ? 's' : ''} remaining`}
        </div>
      </div>

      <div className="tracker-list">
        {PRAYER_NAMES.map((name) => {
          const time = PRAYER_TIMES.find((p) => p.name === name)?.start ?? ''
          const isDone = completed.has(name)
          return (
            <button
              key={name}
              className={`tracker-item card ${isDone ? 'done' : ''}`}
              onClick={() => toggle(name)}
            >
              <div className="tracker-check">{isDone ? '✅' : '⬜'}</div>
              <div className="tracker-info">
                <span className="tracker-name">{name}</span>
                <span className="tracker-time">{time}</span>
              </div>
              {isDone && <span className="tracker-done-label">Completed</span>}
            </button>
          )
        })}
      </div>

      <div className="tracker-streak card">
        <span>🔥</span>
        <div>
          <div className="streak-count">7 day streak</div>
          <div className="streak-label">Keep it up!</div>
        </div>
      </div>
      </div>
    </div>
  )
}
