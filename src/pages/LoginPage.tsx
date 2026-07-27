import { useState, type FormEvent } from 'react'
import { useUserAuth } from '../context/UserAuthContext'
import './LoginPage.css'

interface LoginPageProps {
  onSuccess: () => void
  onBack: () => void
}

export function LoginPage({ onSuccess, onBack }: LoginPageProps) {
  const { login } = useUserAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page fade-in">
      <div className="login-hero">
        <button type="button" className="login-back" onClick={onBack} aria-label="Go back">←</button>
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">🕌</span>
          <h1>PrayNow</h1>
          <p>Sign in to your account</p>
        </div>
      </div>

      <form className="login-form card" onSubmit={submit}>
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn-primary login-submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="login-hint">
          Demo: admin@praynow.com / Admin@12345
        </p>
      </form>
    </div>
  )
}
