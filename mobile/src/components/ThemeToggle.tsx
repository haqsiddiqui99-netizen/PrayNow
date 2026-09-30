import { Ionicons } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import { HEADER_CONTROL_HEIGHT } from '@/src/constants/layout'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLanguage } from '@/src/context/LanguageContext'

/**
 * Two-segment light/dark switch, shown in the account menu. Both options stay
 * visible so the control reads as a choice rather than an unlabelled icon button.
 */
export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme()
  const { t } = useLanguage()
  const styles = useStyles()
  const isDark = mode === 'dark'

  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('theme.button')}>
      <Pressable
        style={[styles.segment, !isDark && styles.segmentActive]}
        onPress={() => setMode('light')}
        hitSlop={6}
        accessibilityRole="radio"
        accessibilityState={{ selected: !isDark }}
        accessibilityLabel={t('theme.light')}>
        <Ionicons
          name="sunny"
          size={13}
          color={isDark ? colors.textMuted : colors.primary}
        />
      </Pressable>
      <Pressable
        style={[styles.segment, isDark && styles.segmentActive]}
        onPress={() => setMode('dark')}
        hitSlop={6}
        accessibilityRole="radio"
        accessibilityState={{ selected: isDark }}
        accessibilityLabel={t('theme.dark')}>
        <Ionicons name="moon" size={12} color={isDark ? colors.primary : colors.textMuted} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: HEADER_CONTROL_HEIGHT,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    width: 26,
    height: HEADER_CONTROL_HEIGHT - 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
}))
