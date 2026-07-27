import { useCallback, useEffect, useState } from 'react'
import { api, type AppNotification } from '../services/api'
import { useUserAuth } from '../context/UserAuthContext'
import './NotificationsPage.css'

interface Props {
  onBack: () => void
  onNeedLogin: () => void
  onOpenMosque?: (mosqueId: string) => void
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function NotificationsPage({ onBack, onNeedLogin, onOpenMosque }: Props) {
  const { user, isAuthenticated } = useUserAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([])
      setUnreadCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await api.me.getNotifications()
      setItems(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated) {
    return (
      <div className="notif-page fade-in">
        <div className="notif-header">
          <button type="button" className="notif-back" onClick={onBack}>←</button>
          <h2>Messages</h2>
        </div>
        <div className="notif-empty">
          <p>Sign in to see mosque updates.</p>
          <button type="button" className="btn-accent" onClick={onNeedLogin}>Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="notif-page fade-in">
      <div className="notif-header">
        <button type="button" className="notif-back" onClick={onBack}>←</button>
        <h2>Messages</h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="notif-mark-all"
            onClick={() => {
              void api.me.markAllRead().then(load)
            }}
          >
            Mark all read
          </button>
        ) : <span />}
      </div>

      {error ? <p className="notif-error">{error}</p> : null}
      {loading ? <p className="notif-loading">Loading…</p> : null}

      <div className="notif-list">
        {!loading && items.length === 0 ? (
          <p className="notif-empty-text">
            No messages yet. Turn on the notify switch on a mosque to get timing updates and announcements.
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`notif-row card${!item.read ? ' notif-row--unread' : ''}`}
            onClick={() => {
              void api.me.markRead(item.id).then(load)
              if (item.mosqueId && onOpenMosque) onOpenMosque(item.mosqueId)
            }}
          >
            <div className="notif-row-top">
              <strong>{item.mosqueName || 'Mosque'}</strong>
              <span>{formatWhen(item.createdAt)}</span>
            </div>
            <div className="notif-title">{item.title}</div>
            {item.body ? <div className="notif-body">{item.body}</div> : null}
            <div className="notif-type">{item.type === 'announcement' ? 'Announcement' : 'Timings update'}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
