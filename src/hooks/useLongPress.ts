import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

interface LongPressOptions {
  delay?: number
  moveThreshold?: number
}

export function useLongPress(onLongPress: () => void, options: LongPressOptions = {}) {
  const { delay = 420, moveThreshold = 12 } = options
  const timerRef = useRef<number | null>(null)
  const startRef = useRef({ x: 0, y: 0 })
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (clientX: number, clientY: number) => {
      clear()
      firedRef.current = false
      startRef.current = { x: clientX, y: clientY }
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true
        onLongPress()
        if (navigator.vibrate) navigator.vibrate(12)
      }, delay)
    },
    [clear, delay, onLongPress],
  )

  const move = useCallback(
    (clientX: number, clientY: number) => {
      if (timerRef.current === null) return
      const dx = clientX - startRef.current.x
      const dy = clientY - startRef.current.y
      if (Math.hypot(dx, dy) > moveThreshold) clear()
    },
    [clear, moveThreshold],
  )

  const end = useCallback(() => {
    clear()
  }, [clear])

  const consumeClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false
      return true
    }
    return false
  }, [])

  const bind = useCallback(
    () => ({
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return
        start(e.clientX, e.clientY)
      },
      onPointerMove: (e: PointerEvent) => move(e.clientX, e.clientY),
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
    }),
    [end, move, start],
  )

  return { bind, consumeClick }
}
