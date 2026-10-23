import { useState } from 'react'
import { clearPortalSession, getPortalUser, signIn, type PortalUser } from './api'
import { CityDesk } from './pages/CityDesk'
import { HalalDesk } from './pages/HalalDesk'
import { MosquesDesk } from './pages/MosquesDesk'
import { Overview } from './pages/Overview'
import { PeopleDesk } from './pages/PeopleDesk'
import { QueuesDesk } from './pages/QueuesDesk'

export type DeskPage = 'overview' | 'people' | 'mosques' | 'queues' | 'halal' | 'city'

const NAV: Array<{ id: DeskPage; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'Counts' },
  { id: 'people', label: 'People', hint: 'Accounts' },
  { id: 'mosques', label: 'Mosques', hint: 'Records and times' },
  { id: 'queues', label: 'Queues', hint: 'Requests and reports' },
  { id: 'halal', label: 'Halal', hint: 'Listings and featured spots' },
  { id: 'city', label: 'City times', hint: 'Home schedule' },
]

export function PortalApp() {
  const [user, setUser] = useState<PortalUser | null>(() => getPortalUser())
  const [page, setPage] = useState<DeskPage>('overview')

  if (!user) {
    return <SignIn onSuccess={setUser} />
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div>
            <p className="brand-kicker">PrayNow</p>
            <h1>Desk</h1>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? 'nav-btn on' : 'nav-btn'}
              onClick={() => setPage(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p className="who">{user.name}</p>
          <p className="who-mail">{user.email}</p>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              clearPortalSession()
              setUser(null)
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        {page === 'overview' ? <Overview go={setPage} /> : null}
        {page === 'people' ? <PeopleDesk /> : null}
        {page === 'mosques' ? <MosquesDesk /> : null}
        {page === 'queues' ? <QueuesDesk /> : null}
        {page === 'halal' ? <HalalDesk /> : null}
        {page === 'city' ? <CityDesk /> : null}
      </main>
    </div>
  )
}

function SignIn({ onSuccess }: { onSuccess: (user: PortalUser) => void }) {
  const [email, setEmail] = useState('admin@praynow.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="gate">
      <form
        className="gate-card"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void signIn(email, password)
            .then(onSuccess)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Sign-in failed'))
            .finally(() => setBusy(false))
        }}
      >
        <img className="gate-mark" src="/favicon.svg" alt="" />
        <p className="brand-kicker">PrayNow</p>
        <h1>Owner desk</h1>
        <p className="lede">
          Accounts, mosque records, prayer times, and the queues waiting on you. This site is separate from the prayer app.
        </p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="solid" disabled={busy}>
          {busy ? 'Signing in…' : 'Open the desk'}
        </button>
        <p className="fine">Owner email after seed: admin@praynow.com</p>
      </form>
    </div>
  )
}
