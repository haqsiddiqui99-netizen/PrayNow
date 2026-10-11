import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/src/context/ThemeContext'

const STEP = 120

/** One horizontal line of chips, with a chevron at each end that slides the row. */
export function ScrollRevealRow({
  children,
  contentStyle,
  label = 'items',
}: {
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
  label?: string
}) {
  const { colors } = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)

  const maxScrollX = Math.max(0, contentWidth - viewportWidth)
  const overflow = contentWidth > viewportWidth + 4
  const showLeft = overflow && scrollX > 4
  const showRight = overflow && scrollX < maxScrollX - 4

  const refresh = useCallback((x: number, vp: number, cw: number) => {
    setScrollX(x)
    setViewportWidth(vp)
    setContentWidth(cw)
  }, [])

  const scrollToX = (nextX: number) => {
    const x = Math.max(0, Math.min(nextX, maxScrollX))
    scrollRef.current?.scrollTo({ x, animated: true })
    if (Platform.OS === 'web') {
      const node = scrollRef.current?.getScrollableNode?.() as HTMLElement | undefined
      node?.scrollTo({ left: x, behavior: 'smooth' })
    }
    setScrollX(x)
  }

  return (
    <View style={styles.line}>
      <Pressable
        style={styles.side}
        disabled={!showLeft}
        onPress={() => scrollToX(scrollX - STEP)}
        hitSlop={6}
        accessibilityLabel={`Show earlier ${label}`}>
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} style={{ opacity: showLeft ? 1 : 0.28 }} />
      </Pressable>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.row, contentStyle]}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => setScrollX(event.nativeEvent.contentOffset.x)}
        onLayout={(event: LayoutChangeEvent) => refresh(scrollX, event.nativeEvent.layout.width, contentWidth)}
        onContentSizeChange={(width) => refresh(scrollX, viewportWidth, width)}>
        {children}
      </ScrollView>
      <Pressable
        style={styles.side}
        disabled={!showRight}
        onPress={() => scrollToX(scrollX + STEP)}
        hitSlop={6}
        accessibilityLabel={`Show more ${label}`}>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ opacity: showRight ? 1 : 0.28 }} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  side: { width: 22, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scroll: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
})
