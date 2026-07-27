import { useState, type FormEvent } from 'react'
import { api, setAdminToken, setAdminUser } from '../../services/api'
import './AdminPages.css'

interface AdminLoginPageProps {
  onSuccess: () => void
  onBack: () => void
}

export function AdminLoginPage({ onSuccess, onBack }: AdminLoginPageProps) {
  const [email, setEmail] = useState('admin@praynow.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token, user } = await api.login(email, password)
      setAdminToken(token)
      setAdminUser(user)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button type="button" className="admin-back" onClick={onBack}>←</button>
        <h1>Admin Login</h1>
      </div>
      <form className="admin-card card" onSubmit={submit}>
        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" className="btn-accent admin-submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="admin-hint">Default: admin@praynow.com / Admin@12345 (after seed)</p>
      </form>
    </div>
  )
}
