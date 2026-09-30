import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles } from '@/src/context/ThemeContext'
import type { Mosque, TravelMode } from '@/src/types'
import { openGoogleMaps } from '@/src/utils/maps'

/**
 * Square, transparent pin derived from the original portrait tile by
 * `scripts/make-maps-pin.mjs`. The source art carried the "Maps" wordmark on an
 * opaque near-white background, which left gaps in the rounded tile and stayed
 * light under the dark palette.
 */
const googleMapsIcon = require('../../assets/images/google_maps_pin.png')

type Variant = 'compact' | 'chip' | 'button'

export function GoogleMapsButton({
  mosque,
  travelMode = 'driving',
  caption,
  style,
  light = false,
  variant = 'compact',
  label,
  onPressBeforeOpen,
  onPress,
}: {
  mosque?: Mosque
  travelMode?: TravelMode
  caption?: string
  style?: StyleProp<ViewStyle>
  light?: boolean
  variant?: Variant
  /** Overrides default open-maps behavior (e.g. open all nearby). */
  onPress?: () => void
  label?: string
  onPressBeforeOpen?: () => void
}) {
  const styles = useStyles()
  const { t } = useLanguage()

  const handlePress = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    onPressBeforeOpen?.()
    if (onPress) {
      onPress()
      return
    }
    if (mosque) void openGoogleMaps(mosque, travelMode)
  }

  if (variant === 'button') {
    return (
      <Pressable style={[styles.button, style]} onPress={() => handlePress()} hitSlop={8}>
        <Image source={googleMapsIcon} style={styles.buttonIcon} resizeMode="contain" />
        <Text style={styles.buttonLabel}>{label ?? t('mosque.openInMaps')}</Text>
      </Pressable>
    )
  }

  if (variant === 'chip') {
    return (
      <Pressable style={[styles.chip, style]} onPress={() => handlePress()} hitSlop={8}>
        <Image source={googleMapsIcon} style={styles.chipIcon} resizeMode="contain" />
        <Text style={styles.chipLabel}>{label ?? 'Google Maps'}</Text>
      </Pressable>
    )
  }

  return (
    <Pressable style={[styles.wrap, style]} onPress={(e) => handlePress(e)} hitSlop={8}>
      <View style={styles.iconShell}>
        <Image source={googleMapsIcon} style={styles.icon} resizeMode="contain" />
      </View>
      {caption ? <Text style={[styles.caption, light && styles.captionLight]}>{caption}</Text> : null}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  wrap: { alignItems: 'center', minWidth: 52 },
  iconShell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  icon: { width: 36, height: 36 },
  caption: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: 4,
  },
  captionLight: { color: colors.textSecondary },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  chipIcon: { width: 24, height: 24 },
  chipLabel: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  buttonIcon: { width: 28, height: 28 },
  buttonLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
}))
