import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabBarIcon } from '@/src/components/TabBarIcon'
import { useLanguage } from '@/src/context/LanguageContext'
import { useTheme } from '@/src/context/ThemeContext'
const SIZE = 56
const EDGE = 16
/** Movement below this many points is a tap, not a drag. */
const DRAG_SLOP = 6
/** A touch held longer than this without moving is not treated as a tap. */
const TAP_MAX_MS = 500
const FLOAT_MS = 3200
const STORAGE_KEY = 'praynow.aiFab.position'

type Saved = { side: 'left' | 'right'; y: number }

/**
 * Floating shortcut to the AI guide. It can be dragged anywhere and settles on
 * the nearest side edge, staying between the status bar and the tab bar.
 * `bottom` is the space to keep free below it (the tab bar).
 */
export function AIChatFab({ bottom }: { bottom: number }) {
  const router = useRouter()
  const { t } = useLanguage()
  const { mode } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [keyboard, setKeyboard] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dark = mode === 'dark'
  const bounds = useMemo(
    () => ({
      left: EDGE,
      right: width - EDGE - SIZE,
      top: insets.top + 8,
      bottom: Math.max(insets.top + 8, height - bottom - SIZE),
    }),
    [width, height, bottom, insets.top],
  )
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds

  const pos = useRef(new Animated.ValueXY({ x: bounds.right, y: bounds.bottom })).current
  const current = useRef({ x: bounds.right, y: bounds.bottom })
  const saved = useRef<Saved | null>(null)

  useEffect(() => {
    const id = pos.addListener((value) => {
      current.current = value
    })
    return () => pos.removeListener(id)
  }, [pos])

  const placeAt = (spot: Saved, animate: boolean) => {
    const b = boundsRef.current
    const target = { x: spot.side === 'left' ? b.left : b.right, y: Math.min(b.bottom, Math.max(b.top, spot.y)) }
    if (animate) {
      Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 7, tension: 70 }).start()
    } else {
      pos.setValue(target)
    }
  }

  useEffect(() => {
    let alive = true
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!alive || !raw) return
      try {
        const spot = JSON.parse(raw) as Saved
        if ((spot.side === 'left' || spot.side === 'right') && Number.isFinite(spot.y)) {
          saved.current = spot
          placeAt(spot, false)
        }
      } catch {}
    })
    return () => {
      alive = false
    }
    // Restore once on mount; later bound changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the button on screen after rotation or when the tab bar height changes.
  useEffect(() => {
    placeAt(saved.current ?? { side: 'right', y: bounds.bottom }, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  const open = () => router.push('/ai')
  const openRef = useRef(open)
  openRef.current = open

  // One responder owns the whole touch, so a drag can never end as a tap.
  const touch = useRef({ startedAt: 0, dragging: false })
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          touch.current = { startedAt: Date.now(), dragging: false }
          pos.extractOffset()
          setPressed(true)
        },
        onPanResponderMove: (_e, g) => {
          if (!touch.current.dragging && Math.abs(g.dx) + Math.abs(g.dy) > DRAG_SLOP) {
            touch.current.dragging = true
            setPressed(false)
            setDragging(true)
          }
          if (touch.current.dragging) pos.setValue({ x: g.dx, y: g.dy })
        },
        onPanResponderRelease: () => {
          pos.flattenOffset()
          setPressed(false)
          if (!touch.current.dragging) {
            if (Date.now() - touch.current.startedAt < TAP_MAX_MS) openRef.current()
            return
          }
          setDragging(false)
          const b = boundsRef.current
          const { x, y } = current.current
          const spot: Saved = { side: x + SIZE / 2 < (b.left + b.right + SIZE) / 2 ? 'left' : 'right', y }
          const clamped = { ...spot, y: Math.min(b.bottom, Math.max(b.top, y)) }
          saved.current = clamped
          placeAt(clamped, true)
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
        },
        onPanResponderTerminate: () => {
          pos.flattenOffset()
          setPressed(false)
          setDragging(false)
          placeAt(saved.current ?? { side: 'right', y: boundsRef.current.bottom }, true)
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos],
  )

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // Gentle float and sway while idle; it holds still while dragged or when the user prefers less motion.
  const idle = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])
  useEffect(() => {
    if (reduceMotion || dragging || keyboard) {
      idle.stopAnimation()
      Animated.timing(idle, { toValue: 0, duration: 180, useNativeDriver: true }).start()
      return
    }
    const loop = Animated.loop(
      Animated.timing(idle, { toValue: 1, duration: FLOAT_MS, easing: Easing.linear, useNativeDriver: true }),
    )
    idle.setValue(0)
    loop.start()
    return () => loop.stop()
  }, [idle, reduceMotion, dragging, keyboard])

  // One full cycle: up, back, down, back; the sway runs at the same pace for a soft figure-eight.
  const steps = [0, 0.25, 0.5, 0.75, 1]
  const floatY = idle.interpolate({ inputRange: steps, outputRange: [0, -4, 0, 3, 0] })
  const sway = idle.interpolate({ inputRange: steps, outputRange: ['0deg', '3deg', '0deg', '-3deg', '0deg'] })
  return (
    <Animated.View
      {...responder.panHandlers}
      pointerEvents={keyboard ? 'none' : 'auto'}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('screens.aiTitle')}
      accessibilityHint={t('ai.fabHint')}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && open()}
      onAccessibilityTap={open}
      hitSlop={6}
      style={[styles.wrap, { opacity: keyboard ? 0 : 1, transform: pos.getTranslateTransform() }]}>
      <Animated.View
        style={[
          styles.fab,
          { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E', transform: [{ translateY: floatY }, { rotate: sway }] },
          pressed && styles.pressed,
          dragging && styles.lifted,
        ]}>
        <TabBarIcon name="ai" focused color={dark ? '#0F1F2E' : '#FFFFFF'} size={26} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 18px rgba(15,31,46,0.28)' }
      : { shadowColor: '#0F1F2E', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
  },
  pressed: { opacity: 0.85 },
  lifted: { opacity: 0.92 },
})
