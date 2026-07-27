import { useCallback, useRef } from 'react'
import { Vibration } from 'react-native'

const DEFAULT_DELAY_MS = 420

export function useLongPress(onLongPress: () => void, delayMs = DEFAULT_DELAY_MS) {
  const firedRef = useRef(false)

  const handleLongPress = useCallback(() => {
    firedRef.current = true
    Vibration.vibrate(12)
    onLongPress()
  }, [onLongPress])

  const consumePress = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false
      return true
    }
    return false
  }, [])

  return { delayLongPress: delayMs, onLongPress: handleLongPress, consumePress }
}
