import { useEffect, useState } from 'react'
import type { Mosque } from '../../types'
import { api, type UserRow } from '../../services/api'

interface AdminUsersPanelProps {
  mosques: Mosque[]
  onMessage: (msg: string) => void
}

export function AdminUsersPanel({ mosques, onMessage }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mosqueIds, setMosqueIds] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.admin.getUsers()
      setUsers(data)
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const toggleMosque = (id: string) => {
    setMosqueIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const createUser = async () => {
    if (!email || !password || !fullName) return
    setSaving(true)
    onMessage('')
    try {
      await api.admin.createUser({
        email,
        password,
        fullName,
        role: 'mosque_manager',
        mosqueIds,
      })
      setEmail('')
      setPassword('')
      setFullName('')
      setMosqueIds([])
      setShowForm(false)
      await load()
      onMessage('Mosque manager created')
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const assign = async (userId: string, mosqueId: string) => {
    try {
      await api.admin.assignMosque(mosqueId, userId)
      await load()
      onMessage('Mosque assigned')
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Assign failed')
    }
  }

  return (
    <div className="admin-users">
      <button type="button" className="btn-accent admin-add-btn" onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Cancel' : '+ Add Mosque Manager'}
      </button>

      {showForm && (
        <div className="admin-form card">
          <h2>New Mosque Manager</h2>
          <label className="admin-field"><span>Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="admin-field"><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="admin-field"><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="admin-section-title">Assign mosques</div>
          <div className="admin-checklist">
            {mosques.map((m) => (
              <label key={m.id} className="admin-check-item">
                <input
                  type="checkbox"
                  checked={mosqueIds.includes(m.id)}
                  onChange={() => toggleMosque(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
          <button type="button" className="btn-accent" onClick={() => void createUser()} disabled={saving}>
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="admin-loading">Loading users…</p>
      ) : (
        <div className="admin-list">
          {users.map((u) => (
            <div key={u.id} className="admin-user-card card">
              <strong>{u.full_name}</strong>
              <span>{u.email} · {u.role}</span>
              {u.assignments?.length > 0 && (
                <span className="admin-assignments">
                  Mosques: {u.assignments.map((a) => a.mosque_name).join(', ')}
                </span>
              )}
              {u.role === 'mosque_manager' && (
                <label className="admin-field admin-assign-row">
                  <span>Assign mosque</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const mosqueId = e.target.value
                      if (mosqueId) void assign(u.id, mosqueId)
                      e.target.value = ''
                    }}
                  >
                    <option value="">Select…</option>
                    {mosques.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
