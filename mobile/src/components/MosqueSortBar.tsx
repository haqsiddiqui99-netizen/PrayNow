import { useCallback, useState, type ReactNode } from 'react'
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ScrollRevealRow } from '@/src/components/ScrollRevealRow'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { MOSQUE_SORT_OPTIONS, type MosqueSortMode } from '@/src/utils/mosqueSort'

export function MosqueSortBar({
  value,
  onChange,
  compact = false,
  fullWidth = false,
  hintBackgroundColor,
  modes,
  trailing,
  showIcons = true,
}: {
  value: MosqueSortMode
  onChange: (mode: MosqueSortMode) => void
  compact?: boolean
  /** One scrolling line of pills, with a chevron at each end. */
  fullWidth?: boolean
  hintBackgroundColor?: string
  /** Subset of sort chips to offer; omit for all of them. */
  modes?: ReadonlyArray<MosqueSortMode>
  trailing?: ReactNode
  /** Icon beside each label. Off when the labels need to stay on one line. */
  showIcons?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const resolvedHintBackgroundColor = hintBackgroundColor ?? colors.surface0
  const { t } = useLanguage()
  const options = modes
    ? MOSQUE_SORT_OPTIONS.filter((option) => modes.includes(option.id))
    : MOSQUE_SORT_OPTIONS
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)

  const overflow = contentWidth > viewportWidth + 6
  const showLeftHint = overflow && scrollX > 6
  const showRightHint = overflow && scrollX + viewportWidth < contentWidth - 6

  const refreshHints = useCallback(
    (x: number, vp: number, cw: number) => {
      setScrollX(x)
      setViewportWidth(vp)
      setContentWidth(cw)
    },
    [],
  )

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x
    setScrollX(x)
  }

  const onLayout = (event: LayoutChangeEvent) => {
    refreshHints(scrollX, event.nativeEvent.layout.width, contentWidth)
  }

  const onContentSizeChange = (width: number) => {
    refreshHints(scrollX, viewportWidth, width)
  }

  if (fullWidth) {
    return (
      <ScrollRevealRow label="sort options">
        {options.map(({ id, labelKey }) => {
          const active = value === id
          return (
            <Pressable
              key={id}
              style={[styles.chip, styles.chipFixed, active && styles.chipActive]}
              onPress={() => onChange(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.chipText, styles.chipTextFull, active && styles.chipTextActive]} numberOfLines={1}>
                {t(labelKey)}
              </Text>
            </Pressable>
          )
        })}
        {trailing}
      </ScrollRevealRow>
    )
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact && <Text style={styles.label}>{t('sort.label')}</Text>}
      <View style={[styles.scrollShell, compact && styles.scrollShellCompact]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={compact ? styles.scrollCompact : undefined}
          contentContainerStyle={[styles.row, compact && styles.rowCompact]}
          onScroll={onScroll}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}>
          {options.map(({ id, labelKey, icon }) => {
            const active = value === id
            return (
              <Pressable
                key={id}
                style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
                onPress={() => onChange(id)}>
                {showIcons ? (
                  <Ionicons
                    name={icon}
                    size={16}
                    color={active ? colors.selectedText : colors.textMuted}
                  />
                ) : null}
                <Text
                  style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            )
          })}
          {trailing}
        </ScrollView>

        {showLeftHint ? (
          <View style={[styles.edgeHint, styles.edgeHintLeft, styles.noPointerEvents]}>
            <View style={[styles.edgeFade, { backgroundColor: resolvedHintBackgroundColor }]} />
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          </View>
        ) : null}

        {showRightHint ? (
          <View style={[styles.edgeHint, styles.edgeHintRight, styles.noPointerEvents]}>
            <View style={[styles.edgeFade, { backgroundColor: resolvedHintBackgroundColor }]} />
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { marginTop: 12 },
  wrapCompact: { marginTop: 0, width: '100%', minWidth: 0 },
  scrollShell: {
    position: 'relative',
    minWidth: 0,
    overflow: 'hidden',
  },
  scrollShellCompact: {
    flex: 1,
    minWidth: 0,
  },
  scrollCompact: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  row: { paddingHorizontal: 16, gap: 8 },
  rowCompact: { paddingHorizontal: 0, gap: 6, paddingRight: 2 },
  chipFixed: { flexGrow: 0, flexShrink: 0, justifyContent: 'center' },
  chipTextFull: { fontSize: 13, textAlign: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.selectedBg,
    borderColor: colors.selectedBg,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextCompact: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.selectedText, fontWeight: '700' },
  edgeHint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  edgeHintLeft: {
    left: 0,
  },
  edgeHintRight: {
    right: 0,
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.94,
  },
  // `pointerEvents` as a prop is deprecated on web; `style.pointerEvents` replaces it.
  noPointerEvents: { pointerEvents: 'none' },
}))
