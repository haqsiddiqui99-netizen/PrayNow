import { useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors } from '@/src/constants/theme'
import {
  CITY_RADIUS_KM,
  MOSQUE_RADIUS_STOPS,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'

function indexFromX(x: number, width: number, count: number) {
  if (width <= 0 || count <= 1) return 0
  const slot = width / count
  const idx = Math.round(x / slot - 0.5)
  return Math.max(0, Math.min(count - 1, idx))
}

export function MosqueRadiusChips({
  value,
  onChange,
  compact = false,
}: {
  value: number
  onChange: (radiusKm: MosqueRadiusKm) => void
  compact?: boolean
}) {
  const count = MOSQUE_RADIUS_STOPS.length
  const selectedIndex = Math.max(
    0,
    MOSQUE_RADIUS_STOPS.findIndex((s) => s.value === value),
  )
  const halfSlotPct = 100 / (2 * count)
  const fillPct = count <= 1 ? 0 : (selectedIndex / (count - 1)) * 100

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
        accessibilityLabel="Distance filter"
        accessibilityValue={{
          text: MOSQUE_RADIUS_STOPS[selectedIndex]?.label ?? '',
        }}>
        {/* Rail: track + ticks + thumb share one vertical center */}
        <View style={styles.rail}>
          <View style={[styles.track, { left: `${halfSlotPct}%`, right: `${halfSlotPct}%` }]}>
            <View style={[styles.trackFill, { width: `${fillPct}%` }]} />
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.thumbWrap,
              { left: `${((selectedIndex + 0.5) / count) * 100}%` },
            ]}>
            <View style={[styles.thumb, dragging && styles.thumbDragging]} />
          </View>

          <View style={styles.ticksRow} pointerEvents="none">
            {MOSQUE_RADIUS_STOPS.map((stop, i) => (
              <View key={`tick-${String(stop.value)}`} style={styles.tickCol}>
                <View style={[styles.tick, i === selectedIndex && styles.tickHidden]} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.labels} pointerEvents="box-none">
          {MOSQUE_RADIUS_STOPS.map((stop, i) => {
            const selected = i === selectedIndex
            const isCity = stop.value === CITY_RADIUS_KM
            return (
              <Pressable
                key={String(stop.value)}
                style={styles.labelCol}
                onPress={() => {
                  lastIndexRef.current = i
                  onChange(stop.value)
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  isCity
                    ? 'All mosques in the city'
                    : stop.value === 0
                      ? 'Zero distance'
                      : `Within ${stop.label}`
                }>
                <Text style={[styles.km, selected && styles.kmSelected]} numberOfLines={2}>
                  {stop.label}
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

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  wrapCompact: {
    flex: 1,
    minWidth: 0,
  },
  scale: {
    width: '100%',
  },
  rail: {
    height: RAIL_H,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    top: (RAIL_H - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  thumbDragging: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  ticksRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tickHidden: {
    opacity: 0,
  },
  labels: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 4,
  },
  labelCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  km: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 1,
  },
  kmSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
})
