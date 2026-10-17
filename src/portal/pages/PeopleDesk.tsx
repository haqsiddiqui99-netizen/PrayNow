import { useEffect, useMemo, useState } from 'react'
import { desk, type AccountRow } from '../api'
import type { Mosque } from '../../types'

function roleLabel(role: string) {
  if (role === 'admin') return 'Owner'
  if (role === 'mosque_manager') return 'Mosque admin'
  return 'Member'
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PeopleDesk() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'mosque_manager' | 'admin'>('mosque_manager')
  const [mosqueIds, setMosqueIds] = useState<string[]>([])
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [nextPassword, setNextPassword] = useState('')

  const load = async () => {
    const [people, list] = await Promise.all([desk.users(), desk.mosques()])
    setRows(people)
    setMosques(list)
  }

  useEffect(() => {
    let live = true
    void load()
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load accounts')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.full_name, row.email, row.mobile || '', row.role].join(' ').toLowerCase().includes(q),
    )
  }, [query, rows])

  const create = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await desk.createUser({ fullName: name, mobile, password, email: email || undefined, role, mosqueIds })
      setName('')
      setMobile('')
      setEmail('')
      setPassword('')
      setMosqueIds([])
      setShowForm(false)
      await load()
      setNotice('Account created. They sign in on the phone with that mobile and password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">People</p>
          <h2>Accounts and sign-in</h2>
        </div>
        <button type="button" className="solid" onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Close' : 'New account'}
        </button>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok">{notice}</p> : null}

      {showForm ? (
        <form
          className="panel form-grid"
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
        >
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Mobile
            <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 15))} required inputMode="numeric" />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional for a mosque admin" />
          </label>
          <label>
            Password
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'mosque_manager' | 'admin')}>
              <option value="mosque_manager">Mosque admin</option>
              <option value="admin">Owner</option>
            </select>
          </label>
          <fieldset className="checks">
            <legend>Assign mosques</legend>
            {mosques.map((mosque) => (
              <label key={mosque.id} className="check">
                <input
                  type="checkbox"
                  checked={mosqueIds.includes(String(mosque.id))}
                  onChange={() =>
                    setMosqueIds((ids) =>
                      ids.includes(String(mosque.id)) ? ids.filter((id) => id !== String(mosque.id)) : [...ids, String(mosque.id)],
                    )
                  }
                />
                {mosque.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="solid" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </form>
      ) : null}

      <label className="search">
        Search
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, mobile, or email" />
      </label>

      {loading ? <p className="muted">Loading accounts…</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Sign-in</th>
              <th>Role</th>
              <th>Mosques</th>
              <th>Joined</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.full_name}</strong>
                </td>
                <td>
                  <div>{row.mobile || '—'}</div>
                  <div className="muted">{row.email}</div>
                  {resetFor === row.id ? (
                    <form
                      className="inline-reset"
                      onSubmit={(event) => {
                        event.preventDefault()
                        setError('')
                        void desk
                          .updateUser(row.id, { password: nextPassword })
                          .then(async () => {
                            setResetFor(null)
                            setNextPassword('')
                            setNotice(`New password saved for ${row.full_name}.`)
                          })
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not set the password'))
                      }}
                    >
                      <input
                        type="text"
                        value={nextPassword}
                        onChange={(e) => setNextPassword(e.target.value)}
                        placeholder="New password"
                        minLength={6}
                        required
                      />
                      <button type="submit" className="solid slim">Save</button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => {
                        setResetFor(row.id)
                        setNextPassword('')
                      }}
                    >
                      Set a new password
                    </button>
                  )}
                </td>
                <td>{roleLabel(row.role)}</td>
                <td>
                  <div>{row.assignments?.map((item) => item.mosque_name).join(', ') || '—'}</div>
                  {row.role === 'mosque_manager' ? (
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        const mosqueId = event.target.value
                        event.target.value = ''
                        if (!mosqueId) return
                        void desk
                          .assignMosque(mosqueId, row.id)
                          .then(() => load())
                          .then(() => setNotice('Mosque assigned.'))
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not assign'))
                      }}
                    >
                      <option value="">Assign a mosque…</option>
                      {mosques.map((mosque) => (
                        <option key={mosque.id} value={mosque.id}>
                          {mosque.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </td>
                <td>{when(row.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className={row.is_active ? 'chip on' : 'chip'}
                    onClick={() => {
                      void desk
                        .updateUser(row.id, { isActive: !row.is_active })
                        .then(() => load())
                        .then(() => setNotice(row.is_active ? 'Account turned off.' : 'Account turned on.'))
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not update access'))
                    }}
                  >
                    {row.is_active ? 'Can sign in' : 'Turned off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
