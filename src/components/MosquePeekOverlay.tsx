import { useEffect, useRef, useState } from 'react'
import type { Mosque } from '../types'
import { MosqueDetailContent } from './MosqueDetailContent'
import './MosquePeekOverlay.css'

interface MosquePeekOverlayProps {
  mosque: Mosque | null
  open: boolean
  onClose: () => void
  onViewFull?: (mosque: Mosque) => void
  onNeedLogin?: () => void
}

export function MosquePeekOverlay({ mosque, open, onClose, onViewFull, onNeedLogin }: MosquePeekOverlayProps) {
  const [dragY, setDragY] = useState(0)
  const [closing, setClosing] = useState(false)
  const startYRef = useRef(0)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (open) {
      setDragY(0)
      setClosing(false)
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
    return undefined
  }, [open])

  if (!open || !mosque) return null

  const dismiss = () => {
    setClosing(true)
    window.setTimeout(onClose, 220)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    draggingRef.current = true
    startYRef.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return
    const delta = e.touches[0].clientY - startYRef.current
    if (delta > 0) setDragY(delta)
  }

  const onTouchEnd = () => {
    draggingRef.current = false
    if (dragY > 90) dismiss()
    else setDragY(0)
  }

  return (
    <div
      className={`mosque-peek-backdrop${closing ? ' mosque-peek-backdrop--closing' : ''}`}
      onClick={dismiss}
      role="presentation"
    >
      <div
        className={`mosque-peek-sheet${closing ? ' mosque-peek-sheet--closing' : ''}`}
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${mosque.name} details`}
      >
        <div
          className="mosque-peek-handle-zone"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mosque-peek-handle" />
        </div>

        <div className="mosque-peek-hero">
          <div className="mosque-peek-hero-emoji">{mosque.photos[0]}</div>
          <div className="mosque-peek-hero-gradient" />
        </div>

        <div className="mosque-peek-body">
          <MosqueDetailContent mosque={mosque} compact onNeedLogin={onNeedLogin} />
        </div>

        <div className="mosque-peek-actions">
          {onViewFull && (
            <button
              type="button"
              className="btn-accent"
              onClick={() => {
                onViewFull(mosque)
                dismiss()
              }}
            >
              View full details
            </button>
          )}
          <button type="button" className="btn-outline" onClick={dismiss}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
