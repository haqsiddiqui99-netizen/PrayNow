import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useUserAuth } from '../context/UserAuthContext'
import './MosqueNotifyToggle.css'

interface Props {
  mosqueId: string
  onNeedLogin?: () => void
}

export function MosqueNotifyToggle({ mosqueId, onNeedLogin }: Props) {
  const { user, isAuthenticated } = useUserAuth()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setOn(false)
      return
    }
    try {
      const { mosqueIds } = await api.me.getSubscriptions()
      setOn(mosqueIds.map(String).includes(String(mosqueId)))
    } catch {
      setOn(false)
    }
  }, [user, mosqueId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isAuthenticated || !user) {
      onNeedLogin?.()
      return
    }
    if (busy) return
    setBusy(true)
    const next = !on
    setOn(next)
    try {
      if (next) await api.me.subscribe(mosqueId)
      else await api.me.unsubscribe(mosqueId)
    } catch {
      setOn(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`notify-toggle${on ? ' notify-toggle--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Notifications on' : 'Notifications off'}
      disabled={busy}
      onClick={(e) => void toggle(e)}
    >
      <span className="notify-toggle-knob" />
    </button>
  )
}
