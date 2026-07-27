import { useEffect, useRef, useState } from 'react'
import { useUserAuth } from '../context/UserAuthContext'
import type { Screen } from '../types'
import './UserMenu.css'

interface UserMenuProps {
  onNavigate: (screen: Screen) => void
}

function userInitials(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, isAuthenticated, logout } = useUserAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleLogout = () => {
    logout()
    setOpen(false)
  }

  const go = (screen: Screen) => {
    setOpen(false)
    onNavigate(screen)
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className={`user-menu-trigger${open ? ' user-menu-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={isAuthenticated ? 'Account menu' : 'Sign in'}
        aria-expanded={open}
      >
        {isAuthenticated ? (
          <span className="user-menu-initials">
            {userInitials(user!.name, user!.email)}
          </span>
        ) : (
          <span className="user-menu-icon" aria-hidden="true">👤</span>
        )}
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          {isAuthenticated ? (
            <>
              <div className="user-menu-header">
                <div className="user-menu-avatar">
                  {userInitials(user!.name, user!.email)}
                </div>
                <div className="user-menu-details">
                  <span className="user-menu-name">{user!.name}</span>
                  <span className="user-menu-email">{user!.email}</span>
                  <span className="user-menu-role">{user!.role.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="user-menu-divider" />
              <button type="button" className="user-menu-item" role="menuitem" onClick={() => go('profile')}>
                <span className="user-menu-item-icon">👤</span>
                Profile
              </button>
              <button type="button" className="user-menu-item" role="menuitem" onClick={() => go('settings')}>
                <span className="user-menu-item-icon">⚙️</span>
                Settings
              </button>
              {(user!.role === 'admin' || user!.role === 'mosque_manager') && (
                <button type="button" className="user-menu-item" role="menuitem" onClick={() => go('admin')}>
                  <span className="user-menu-item-icon">🕌</span>
                  Admin Portal
                </button>
              )}
              <div className="user-menu-divider" />
              <button type="button" className="user-menu-item user-menu-item--danger" role="menuitem" onClick={handleLogout}>
                <span className="user-menu-item-icon">↪</span>
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="user-menu-guest">
                <span className="user-menu-guest-title">Welcome to PrayNow</span>
                <span className="user-menu-guest-sub">Sign in to save preferences</span>
              </div>
              <button type="button" className="user-menu-item user-menu-item--primary" role="menuitem" onClick={() => go('login')}>
                Sign in
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
