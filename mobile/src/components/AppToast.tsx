import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT, getTabBarTotalHeight } from '@/src/constants/layout'

type ToastIcon = 'checkmark-circle' | 'notifications-off-outline' | 'information-circle-outline'
type Toast = { id: number; text: string; icon: ToastIcon }

const VISIBLE_MS = 2000
const RISE = TAB_BAR_HEIGHT / 2 + 14

let nextId = 1
const listeners = new Set<(toast: Toast) => void>()

/** Shows a short message that rises out of the middle of the tab bar and fades after ~2s. */
export function showToast(text: string, icon: ToastIcon = 'checkmark-circle') {
  const toast = { id: nextId++, text, icon }
  listeners.forEach((listener) => listener(toast))
}

export function AppToastHost() {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<Toast | null>(null)
  const progress = useSharedValue(0)
  const latest = useRef(0)

  useEffect(() => {
    const listener = (next: Toast) => {
      latest.current = next.id
      setToast(next)
      const clear = (id: number) => {
        if (latest.current === id) setToast(null)
      }
      progress.value = 0
      progress.value = withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.4)) }),
        withDelay(
          VISIBLE_MS - 520,
          withTiming(2, { duration: 260, easing: Easing.in(Easing.quad) }, (finished) => {
            if (finished) runOnJS(clear)(next.id)
          }),
        ),
      )
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [progress])

  const style = useAnimatedStyle(() => {
    const p = progress.value
    const entering = p <= 1
    return {
      opacity: entering ? p : 2 - p,
      transform: [
        { translateY: entering ? (1 - p) * RISE : (p - 1) * 10 },
        { scale: entering ? 0.92 + 0.08 * p : 1 - 0.04 * (p - 1) },
      ],
    }
  })

  if (!toast) return null

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { bottom: getTabBarTotalHeight(insets.bottom) + 10 }]}
      accessibilityLiveRegion="polite">
      <Animated.View style={[styles.toast, style]}>
        <Ionicons name={toast.icon} size={16} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={2}>
          {toast.text}
        </Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 420,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#0F1F2E',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flexShrink: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
})
