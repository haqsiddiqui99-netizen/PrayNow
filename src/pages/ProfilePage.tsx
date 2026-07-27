import { useUserAuth } from '../context/UserAuthContext'
import './ProfilePage.css'

interface ProfilePageProps {
  onBack: () => void
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user } = useUserAuth()

  if (!user) {
    return (
      <div className="profile-page fade-in">
        <header className="page-header">
          <button type="button" className="back-btn" onClick={onBack}>←</button>
          <h1>Profile</h1>
        </header>
        <p className="profile-empty">Please sign in to view your profile.</p>
      </div>
    )
  }

  return (
    <div className="profile-page fade-in">
      <header className="page-header">
        <button type="button" className="back-btn" onClick={onBack}>←</button>
        <h1>Profile</h1>
      </header>

      <div className="profile-body">
        <div className="profile-card card">
          <div className="profile-avatar">
            {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <h2 className="profile-name">{user.name}</h2>
          <span className="profile-role">{user.role.replace('_', ' ')}</span>
        </div>

        <div className="profile-section card">
          <div className="profile-row">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user.email}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Account ID</span>
            <span className="profile-value profile-value--mono">{user.id.slice(0, 8)}…</span>
          </div>
        </div>
      </div>
    </div>
  )
}
