import { Ionicons } from '@expo/vector-icons'
import { useLanguage } from '@/src/context/LanguageContext'
import { GradientFill } from '@/src/components/GradientFill'
import { memo, useCallback, useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

export type AzanState = 'before' | 'live' | 'after'

export type LiveAzanButtonProps = {
  state: AzanState
  isPlaying: boolean
  onPress: () => void
  /** live listeners (live state) */
  listeners?: number
  /** minutes until azan (before state) */
  minutesToAzan?: number
  /** e.g. "12:15 PM" */
  azanTime?: string
  /** prayer shown on the ended-state subtitle */
  prayerLabel?: string
  /** Replaces the default title. Public cards leave this unset. */
  actionTitle?: string
  /** Replaces the soft-state subtitle. */
  actionDetail?: string
  /** Replaces the knob icon. */
  actionIcon?: keyof typeof Ionicons.glyphMap
}

const C = {
  live: '#FF4D3D',
  amber: '#FFB020',
  pink: '#FF5CAA',
  aqua: '#35C6E8',
  ink: '#0F1F2E',
  muted: '#5A6676',
  accent: '#1F7A68',
  gold: '#9A5B00',
  line: 'rgba(15,31,46,0.08)',
  mint: '#7DF0C6',
}

const WAVE_HEIGHTS = [8, 14, 22, 12, 18, 26, 10, 16, 7]

/** 1549 -> "1,549", 123456 -> "1,23,456" (Indian grouping, works on Hermes) */
const formatIN = (n: number): string => {
  const s = Math.round(n).toString()
  if (s.length <= 3) return s
  const last = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${rest},${last}`
}

const formatElapsed = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const WaveBar = memo(function WaveBar({
  base,
  index,
  active,
  reduce,
}: {
  base: number
  index: number
  active: boolean
  reduce: boolean
}) {
  const h = useSharedValue(base)

  useEffect(() => {
    if (active && !reduce) {
      const d = 450 + ((index * 83) % 350)
      h.value = withDelay(
        (index * 57) % 400,
        withRepeat(
          withSequence(
            withTiming(26, { duration: d, easing: Easing.inOut(Easing.quad) }),
            withTiming(5, { duration: d, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      )
    } else {
      cancelAnimation(h)
      h.value = withTiming(base, { duration: 200 })
    }
  }, [active, reduce, base, index, h])

  const style = useAnimatedStyle(() => ({ height: h.value }))
  return <Animated.View style={[styles.bar, style]} />
})

export const LiveAzanButton = memo(function LiveAzanButton({
  state,
  isPlaying,
  onPress,
  listeners = 0,
  minutesToAzan = 0,
  azanTime = '12:15 PM',
  prayerLabel = 'Dhuhr',
  actionTitle,
  actionDetail,
  actionIcon,
}: LiveAzanButtonProps) {
  const reduce = useReducedMotion() === true
  const isLive = state === 'live'
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [elapsed, setElapsed] = useState(0)

  const spin = useSharedValue(0)
  const sheenX = useSharedValue(-120)
  const pulse = useSharedValue(1)
  const ring = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(spin)
    spin.value = 0
    if (isLive && !reduce) {
      spin.value = withRepeat(
        withTiming(360, { duration: isPlaying ? 1600 : 3200, easing: Easing.linear }),
        -1,
        false,
      )
    }
  }, [isLive, isPlaying, reduce, spin])

  useEffect(() => {
    cancelAnimation(sheenX)
    sheenX.value = -120
    if (isLive && !reduce && box.w > 0) {
      sheenX.value = withRepeat(
        withSequence(
          withTiming(-120, { duration: 0 }),
          withDelay(2200, withTiming(box.w + 120, { duration: 1400, easing: Easing.inOut(Easing.quad) })),
        ),
        -1,
        false,
      )
    }
  }, [isLive, reduce, box.w, sheenX])

  useEffect(() => {
    cancelAnimation(pulse)
    cancelAnimation(ring)
    pulse.value = 1
    ring.value = 0
    if (!isLive || reduce) return
    if (isPlaying) {
      ring.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false)
    } else {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    }
  }, [isLive, isPlaying, reduce, pulse, ring])

  useEffect(() => {
    if (!isPlaying) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isPlaying])

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheenX.value }, { skewX: '-20deg' }],
  }))
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - ring.value),
    transform: [{ scale: 1 + 0.5 * ring.value }],
  }))

  const { t, digits, formatDuration } = useLanguage()
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }))
  }, [])

  const handlePress = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.()
      onPress()
    },
    [onPress],
  )

  const title =
    actionTitle ??
    (state === 'before'
      ? t('live.notify')
      : state === 'after'
        ? t('live.replay')
        : isPlaying
          ? t('live.listening')
          : t('live.listen'))
  const label =
    actionTitle ??
    (state === 'before'
      ? t('live.remindStart')
      : state === 'after'
        ? t('live.replay')
        : isPlaying
          ? t('live.pause')
          : t('live.listenA11y'))

  const knobIcon: keyof typeof Ionicons.glyphMap =
    actionIcon ??
    (isPlaying ? 'pause' : state === 'before' ? 'notifications' : state === 'after' ? 'refresh' : 'play')

  const progress = Math.min(1, Math.max(0, 1 - minutesToAzan / 60))
  const diag = Math.ceil(Math.hypot(box.w, box.h)) + 4

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isPlaying }}
      style={({ pressed }) => [
        styles.shadowWrap,
        isLive && styles.liveGlow,
        pressed && { transform: [{ scale: 0.982 }] },
      ]}>
      <View style={[styles.pill, isLive ? styles.pillLive : styles.pillSoft]} onLayout={onLayout}>
        {isLive && box.w > 0 && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: diag,
                  height: diag,
                  left: (box.w - diag) / 2,
                  top: (box.h - diag) / 2,
                },
                spinStyle,
              ]}>
              <GradientFill colors={[C.live, C.amber, C.pink, C.aqua, C.live]} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]}>
              <GradientFill colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} />
            </Animated.View>
          </>
        )}

        <View style={styles.row}>
          <View style={styles.knobSlot}>
            {isLive && isPlaying && <Animated.View style={[styles.knobRing, ringStyle]} />}
            <Animated.View
              style={[
                styles.knob,
                isLive ? styles.knobLive : state === 'after' ? styles.knobAfter : styles.knobBefore,
                isLive && knobStyle,
              ]}>
              <Ionicons
                name={knobIcon}
                size={isLive ? 24 : 22}
                color={isLive ? '#0C1D3B' : state === 'after' ? C.gold : C.accent}
                style={knobIcon === 'play' ? { marginLeft: 2 } : undefined}
              />
            </Animated.View>
          </View>

          <View style={styles.textCol}>
            <Text numberOfLines={1} style={[styles.title, isLive ? styles.titleLive : styles.titleSoft]}>
              {title}
            </Text>

            {isLive ? (
              <View style={styles.chip}>
                <Ionicons name="headset" size={14} color={C.mint} />
                {isPlaying && <Text style={styles.chipElapsed}>{digits(formatElapsed(elapsed))} ·</Text>}
                <Text style={styles.chipCount}>{digits(formatIN(listeners))}</Text>
                <Text style={styles.chipLabel}>{t('live.chip')}</Text>
              </View>
            ) : (
              <Text numberOfLines={1} style={styles.sub}>
                {actionDetail ??
                  (state === 'before'
                    ? `${t('home.inDuration', { duration: formatDuration(minutesToAzan) })} · ${digits(azanTime)}`
                    : `${prayerLabel} · ${digits(azanTime)}`)}
              </Text>
            )}
          </View>

          {isLive && (
            <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {WAVE_HEIGHTS.map((h, i) => (
                <WaveBar key={i} base={h} index={i} active={isPlaying} reduce={reduce} />
              ))}
            </View>
          )}
        </View>

        {state === 'before' && (
          <View style={styles.progTrack}>
            <View style={[styles.progFill, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 999,
    shadowColor: C.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  liveGlow: {
    shadowColor: C.live,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  pill: {
    minHeight: 68,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pillLive: { backgroundColor: '#14305A' },
  pillSoft: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    gap: 12,
  },

  knobSlot: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  knob: { alignItems: 'center', justifyContent: 'center' },
  knobLive: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  knobBefore: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(31,122,104,0.12)' },
  knobAfter: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(154,91,0,0.12)' },
  knobRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  textCol: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  titleLive: {
    fontSize: 17,
    color: '#FFFFFF',
    textShadowColor: 'rgba(60,10,20,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  titleSoft: { color: C.ink },
  sub: { fontSize: 12.5, fontWeight: '500', color: C.muted },

  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(9,20,44,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chipElapsed: { color: '#FFD79A', fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chipCount: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chipLabel: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' },

  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26 },
  bar: { width: 3.5, borderRadius: 2, backgroundColor: '#FF9A3D' },

  sheen: { position: 'absolute', top: 0, bottom: 0, width: 60 },

  progTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(15,31,46,0.08)',
    overflow: 'hidden',
  },
  progFill: { height: '100%', borderRadius: 2, backgroundColor: '#FFA23A' },
})
