import { useCallback, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { formatCapacity } from '@/src/utils/mosqueSort'
import { HOME_AMENITY_CATALOG, hasFacility, renderFacilityIcon } from '@/src/utils/facilities'

const SCROLL_STEP = 120

function FacilityChip({ facility, enabled = true }: { facility: string; enabled?: boolean }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { facilityName } = useLanguage()
  const iconColor = enabled ? colors.primary : colors.textMuted
  return (
    <View style={[styles.chip, !enabled && styles.chipDisabled]}>
      {renderFacilityIcon(facility, 12, iconColor)}
      <Text style={[styles.chipText, !enabled && styles.chipTextDisabled]} numberOfLines={1}>
        {facilityName(facility)}
      </Text>
    </View>
  )
}

function CapacityChip({ capacity }: { capacity: number }) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View style={styles.chip}>
      <Ionicons name="people-outline" size={12} color={colors.primary} />
      <Text style={styles.chipText} numberOfLines={1}>
        {formatCapacity(capacity)}
      </Text>
    </View>
  )
}

export function FacilitiesLine({
  facilities,
  capacity,
  hintBackgroundColor,
  multiline = false,
  bare = false,
}: {
  facilities: string[]
  capacity?: number
  hintBackgroundColor?: string
  /** Wrap chips across as many lines as needed instead of one scrollable line. */
  multiline?: boolean
  /** Drop the top divider/margin — for embedding right under another block. */
  bare?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)

  const hintBg = hintBackgroundColor ?? colors.surface2

  const hasCapacity = capacity != null && capacity > 0
  const hasContent = facilities.length > 0 || hasCapacity

  const overflow = contentWidth > viewportWidth + 4
  const maxScrollX = Math.max(0, contentWidth - viewportWidth)
  const showLeftHint = overflow && scrollX > 4
  const showRightHint = overflow && scrollX < maxScrollX - 4

  const refreshMetrics = useCallback((x: number, vp: number, cw: number) => {
    setScrollX(x)
    setViewportWidth(vp)
    setContentWidth(cw)
  }, [])

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(event.nativeEvent.contentOffset.x)
  }

  const onShellLayout = (event: LayoutChangeEvent) => {
    refreshMetrics(scrollX, event.nativeEvent.layout.width, contentWidth)
  }

  const onContentSizeChange = (width: number) => {
    refreshMetrics(scrollX, viewportWidth, width)
  }

  const scrollToX = (nextX: number) => {
    scrollRef.current?.scrollTo({ x: nextX, animated: true })
    if (Platform.OS === 'web') {
      const node = scrollRef.current?.getScrollableNode?.() as HTMLElement | undefined
      node?.scrollTo({ left: nextX, behavior: 'smooth' })
    }
    setScrollX(nextX)
  }

  const scrollBy = (delta: number) => {
    scrollToX(Math.max(0, Math.min(scrollX + delta, maxScrollX)))
  }

  if (!hasContent) return null

  if (multiline) {
    // Always show every amenity type, greyed out when this mosque doesn't have
    // it, rather than only listing whichever ones happen to be present.
    return (
      <View style={[styles.wrap, bare && styles.wrapBare]}>
        <View style={styles.wrapRow}>
          {hasCapacity ? <CapacityChip capacity={capacity!} /> : null}
          {HOME_AMENITY_CATALOG.map((amenity) => (
            <FacilityChip
              key={amenity.key}
              facility={amenity.canonical}
              enabled={hasFacility(facilities, amenity.aliases)}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.scrollShell} onLayout={onShellLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.scroll}
          contentContainerStyle={styles.row}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}>
          {hasCapacity ? <CapacityChip capacity={capacity!} /> : null}
          {facilities.map((f) => (
            <FacilityChip key={f} facility={f} />
          ))}
        </ScrollView>

        {showLeftHint ? (
          <Pressable
            style={[styles.edgeHint, styles.edgeHintLeft]}
            onPress={(e) => {
              e.stopPropagation?.()
              scrollBy(-SCROLL_STEP)
            }}
            hitSlop={8}
            accessibilityLabel="Scroll facilities left">
            <View style={[styles.edgeFade, { backgroundColor: hintBg }, styles.noPointerEvents]} />
            <Ionicons name="chevron-back" size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {showRightHint ? (
          <Pressable
            style={[styles.edgeHint, styles.edgeHintRight]}
            onPress={(e) => {
              e.stopPropagation?.()
              scrollBy(SCROLL_STEP)
            }}
            hitSlop={8}
            accessibilityLabel="Scroll facilities right">
            <View style={[styles.edgeFade, { backgroundColor: hintBg }, styles.noPointerEvents]} />
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // No divider/margin — the caller is embedding this right under its own text,
  // not separating it from a block above.
  wrapBare: {
    marginTop: 6,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  scrollShell: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  scroll: {
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
        } as object)
      : null),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.primary,
  },
  chipDisabled: { backgroundColor: colors.surface1, opacity: 0.5 },
  chipTextDisabled: { color: colors.textMuted },
  edgeHint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  edgeHintLeft: { left: 0 },
  edgeHintRight: { right: 0 },
  edgeFade: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.94,
  },
  noPointerEvents: { pointerEvents: 'none' },
}))
