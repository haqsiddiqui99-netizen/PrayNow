import { useEffect, useState } from 'react'
import { desk } from '../api'
import type { DeskPage } from '../PortalApp'

export function Overview({ go }: { go: (page: DeskPage) => void }) {
  const [counts, setCounts] = useState({ people: 0, mosques: 0, requests: 0, corrections: 0, halal: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    void Promise.all([
      desk.users(),
      desk.mosques(),
      desk.requests('pending'),
      desk.corrections('pending'),
      desk.halalRequests('new'),
    ])
      .then(([people, mosques, requests, corrections, halal]) => {
        if (!live) return
        setCounts({
          people: people.length,
          mosques: mosques.length,
          requests: requests.requests.length,
          corrections: corrections.corrections.length,
          halal: halal.requests.length,
        })
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load the desk')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const cards: Array<{ id: DeskPage; label: string; value: number; note: string }> = [
    { id: 'people', label: 'Accounts', value: counts.people, note: 'Owners, mosque admins, and members' },
    { id: 'mosques', label: 'Mosques', value: counts.mosques, note: 'Records already in the app' },
    { id: 'queues', label: 'Add-mosque requests', value: counts.requests, note: 'Waiting for approve or reject' },
    { id: 'queues', label: 'Correction reports', value: counts.corrections, note: 'Times or details marked wrong' },
    { id: 'halal', label: 'Halal business requests', value: counts.halal, note: 'Shops asking to be listed or featured' },
  ]

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">Today</p>
          <h2>What is on the books</h2>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="stats">
        {cards.map((card) => (
          <button key={card.label} type="button" className="stat" onClick={() => go(card.id)}>
            <span className="stat-value">{loading ? '—' : card.value}</span>
            <span className="stat-label">{card.label}</span>
            <span className="stat-note">{card.note}</span>
          </button>
        ))}
      </div>
      <div className="note-card">
        <h3>What this desk does not count</h3>
        <p>
          Store downloads live in Play Console after release. The app does not record how many times someone signed in, so there is no login tally here. Each account shows when it was created, the mobile used to sign in, and whether it can still sign in.
        </p>
      </div>
    </section>
  )
}
