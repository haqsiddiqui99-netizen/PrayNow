import { useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles } from '@/src/context/ThemeContext'
import {
  CITY_RADIUS_KM,
  MOSQUE_RADIUS_STOPS,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'

function RadiusChipRow({
  value,
  onChange,
  compact = false,
  fullWidth = false,
}: {
  value: number
  onChange: (radiusKm: MosqueRadiusKm) => void
  compact?: boolean
  fullWidth?: boolean
}) {
  const styles = useStyles()
  const { t, formatRadius } = useLanguage()
  const stopLabel = (stopValue: number) => formatRadius(stopValue)
  const stopA11y = (stopValue: number) =>
    stopValue >= CITY_RADIUS_KM
      ? t('radius.allCityA11y')
      : t('radius.withinA11y', { radius: formatRadius(stopValue) })

  if (fullWidth) {
    return (
      <View style={styles.chipFullRow}>
        {MOSQUE_RADIUS_STOPS.map((stop) => {
          const selected = value === stop.value
          return (
            <Pressable
              key={String(stop.value)}
              style={[
                styles.chip,
                styles.chipFull,
                compact && styles.chipCompact,
                selected && styles.chipActive,
              ]}
              onPress={() => onChange(stop.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={stopA11y(stop.value)}>
              <Text
                style={[
                  styles.chipText,
                  compact && styles.chipTextCompact,
                  selected && styles.chipTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {stopLabel(stop.value)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View style={styles.chipScrollWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={[styles.chipRow, compact && styles.chipRowCompact]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled>
        {MOSQUE_RADIUS_STOPS.map((stop) => {
          const selected = value === stop.value
          return (
            <Pressable
              key={String(stop.value)}
              style={[styles.chip, compact && styles.chipCompact, selected && styles.chipActive]}
              onPress={() => onChange(stop.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={stopA11y(stop.value)}>
              <Text
                style={[styles.chipText, compact && styles.chipTextCompact, selected && styles.chipTextActive]}>
                {stopLabel(stop.value)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function indexFromX(x: number, width: number, count: number) {
  if (width <= 0 || count <= 1) return 0
  // Stops sit on the edges (0 … width), not at column centers.
  const t = Math.max(0, Math.min(1, x / width))
  return Math.round(t * (count - 1))
}

function stopPct(index: number, count: number) {
  if (count <= 1) return 50
  return (index / (count - 1)) * 100
}

export function MosqueRadiusChips({
  value,
  onChange,
  compact = false,
  variant = 'chips',
  fullWidth = false,
}: {
  value: number
  onChange: (radiusKm: MosqueRadiusKm) => void
  compact?: boolean
  variant?: 'chips' | 'slider'
  fullWidth?: boolean
}) {
  if (variant === 'chips') {
    return <RadiusChipRow value={value} onChange={onChange} compact={compact} fullWidth={fullWidth} />
  }

  return <RadiusSlider value={value} onChange={onChange} compact={compact} />
}

function RadiusSlider({
  value,
  onChange,
  compact = false,
}: {
  value: number
  onChange: (radiusKm: MosqueRadiusKm) => void
  compact?: boolean
}) {
  const styles = useStyles()
  const { t, formatRadius } = useLanguage()
  const count = MOSQUE_RADIUS_STOPS.length
  const matchedIndex = MOSQUE_RADIUS_STOPS.findIndex((s) => s.value === value)
  // Unknown/legacy values (e.g. old 10 km default) snap to the nearest stop
  const selectedIndex =
    matchedIndex >= 0
      ? matchedIndex
      : MOSQUE_RADIUS_STOPS.reduce((best, stop, idx) => {
          const bestDist = Math.abs(MOSQUE_RADIUS_STOPS[best].value - value)
          const dist = Math.abs(stop.value - value)
          return dist < bestDist ? idx : best
        }, 0)
  const fillPct = stopPct(selectedIndex, count)

  const widthRef = useRef(0)
  const pageXRef = useRef(0)
  const scaleRef = useRef<View>(null)
  const lastIndexRef = useRef(selectedIndex)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [dragging, setDragging] = useState(false)

  const applyFromPageX = (pageX: number) => {
    const localX = pageX - pageXRef.current
    const idx = indexFromX(localX, widthRef.current, count)
    if (idx === lastIndexRef.current) return
    lastIndexRef.current = idx
    onChangeRef.current(MOSQUE_RADIUS_STOPS[idx].value)
  }

  const refreshPageX = () => {
    scaleRef.current?.measureInWindow((x) => {
      pageXRef.current = x
    })
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4,
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          setDragging(true)
          refreshPageX()
          lastIndexRef.current = -1
          applyFromPageX(e.nativeEvent.pageX)
        },
        onPanResponderMove: (e) => {
          applyFromPageX(e.nativeEvent.pageX)
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [count],
  )

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
    refreshPageX()
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View
        ref={scaleRef}
        style={styles.scale}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={t('radius.filterA11y')}
        accessibilityValue={{
          text: formatRadius(MOSQUE_RADIUS_STOPS[selectedIndex]?.value ?? 0),
        }}>
        {/* Rail spans the full content width (header left ↔ header right). */}
        <View style={styles.rail}>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${fillPct}%` }]} />
          </View>

          <View style={[styles.thumbWrap, { left: `${fillPct}%` }, styles.noPointerEvents]}>
            <View style={[styles.thumb, dragging && styles.thumbDragging]} />
          </View>

          {MOSQUE_RADIUS_STOPS.map((stop, i) => (
            <View
              key={`tick-${String(stop.value)}`}
              style={[styles.tickAnchor, { left: `${stopPct(i, count)}%` }, styles.noPointerEvents]}>
              <View style={[styles.tick, i === selectedIndex && styles.tickHidden]} />
            </View>
          ))}
        </View>

        <View style={[styles.labels, styles.boxNonePointerEvents]}>
          {MOSQUE_RADIUS_STOPS.map((stop, i) => {
            const selected = i === selectedIndex
            const isCity = stop.value === CITY_RADIUS_KM
            const isFirst = i === 0
            const isLast = i === count - 1
            return (
              <Pressable
                key={String(stop.value)}
                style={[
                  styles.labelCol,
                  isFirst && styles.labelFirst,
                  isLast && styles.labelLast,
                  !isFirst && !isLast && { left: `${stopPct(i, count)}%` },
                ]}
                onPress={() => {
                  lastIndexRef.current = i
                  onChange(stop.value)
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  isCity
                    ? t('radius.allCityA11y')
                    : t('radius.withinA11y', { radius: formatRadius(stop.value) })
                }>
                <Text
                  style={[
                    styles.km,
                    selected && styles.kmSelected,
                    isFirst && styles.kmFirst,
                    isLast && styles.kmLast,
                  ]}
                  numberOfLines={2}>
                  {formatRadius(stop.value)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const RAIL_H = 24
const TRACK_H = 3
const TICK = 8
const LABEL_W = 70

const useStyles = makeStyles(({ colors }) => ({
  wrap: {
    width: '100%',
    overflow: 'visible',
  },
  wrapCompact: {
    flex: 1,
    minWidth: 0,
  },
  scale: {
    width: '100%',
    overflow: 'visible',
  },
  rail: {
    height: RAIL_H,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (RAIL_H - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.selectedBg,
  },
  thumbWrap: {
    position: 'absolute',
    top: 0,
    marginLeft: -RAIL_H / 2,
    width: RAIL_H,
    height: RAIL_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.selectedBg,
    borderWidth: 3,
    borderColor: '#fff',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 5px rgba(30, 41, 59, 0.35)' }
      : {
          shadowColor: colors.headerBg,
          shadowOpacity: 0.35,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }),
  },
  thumbDragging: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  tickAnchor: {
    position: 'absolute',
    top: (RAIL_H - TICK) / 2,
    marginLeft: -TICK / 2,
    width: TICK,
    height: TICK,
    zIndex: 1,
  },
  tick: {
    width: TICK,
    height: TICK,
    borderRadius: TICK / 2,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tickHidden: {
    opacity: 0,
  },
  labels: {
    position: 'relative',
    width: '100%',
    marginTop: 4,
    minHeight: 28,
  },
  labelCol: {
    position: 'absolute',
    top: 0,
    width: LABEL_W,
    marginLeft: -LABEL_W / 2,
    alignItems: 'center',
  },
  labelFirst: {
    left: 0,
    marginLeft: 0,
    alignItems: 'flex-start',
  },
  labelLast: {
    right: 0,
    marginLeft: 0,
    alignItems: 'flex-end',
  },
  km: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  kmFirst: { textAlign: 'left' },
  kmLast: { textAlign: 'right' },
  kmSelected: {
    color: colors.pageAccent,
    fontWeight: '800',
  },
  chipFullRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    width: '100%',
  },
  chipFull: {
    flex: 1,
    minWidth: 0,
  },
  chipScrollWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  chipScroll: {
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 2,
    paddingRight: 4,
  },
  chipRowCompact: {
    gap: 4,
  },
  chip: {
    minWidth: 56,
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: {
    minWidth: 0,
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipActive: {
    backgroundColor: colors.selectedBg,
    borderColor: colors.selectedBg,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chipTextCompact: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextActive: {
    color: colors.selectedText,
    fontWeight: '700',
  },
  // `pointerEvents` as a prop is deprecated on web; `style.pointerEvents` replaces it.
  noPointerEvents: { pointerEvents: 'none' },
  boxNonePointerEvents: { pointerEvents: 'box-none' },
}))
