import { Ionicons } from '@expo/vector-icons'
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { paperColors, radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { Mosque, TravelMode } from '@/src/types'
import { openGoogleMaps } from '@/src/utils/maps'

/**
 * Square, transparent pin derived from the original portrait tile by
 * `scripts/make-maps-pin.mjs`. The source art carried the "Maps" wordmark on an
 * opaque near-white background, which left gaps in the rounded tile and stayed
 * light under the dark palette.
 */
const googleMapsIcon = require('../../assets/images/google_maps_pin.png')

type Variant = 'compact' | 'chip' | 'button' | 'distance' | 'panel' | 'bar' | 'place'

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
  const { colors } = useTheme()
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

  if (variant === 'place') {
    return (
      <Pressable style={[styles.place, style]} onPress={(e) => handlePress(e)} hitSlop={4}>
        <Image source={googleMapsIcon} style={styles.placeIcon} resizeMode="contain" />
        <Text style={styles.placeDistance} numberOfLines={1}>
          {caption}
        </Text>
        <Text style={styles.placeAddress} numberOfLines={2}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    )
  }

  if (variant === 'bar') {
    return (
      <Pressable style={[styles.bar, style]} onPress={(e) => handlePress(e)} hitSlop={4}>
        <Image source={googleMapsIcon} style={styles.barIcon} resizeMode="contain" />
        <Text style={styles.barCaption} numberOfLines={1}>
          {caption}
        </Text>
      </Pressable>
    )
  }

  if (variant === 'panel') {
    return (
      <Pressable style={[styles.panel, style]} onPress={(e) => handlePress(e)} hitSlop={4}>
        <View style={styles.panelIconShell}>
          <Image source={googleMapsIcon} style={styles.panelIcon} resizeMode="contain" />
        </View>
        <Text style={styles.panelCaption} numberOfLines={1}>
          {caption}
        </Text>
      </Pressable>
    )
  }

  if (variant === 'distance') {
    return (
      <Pressable style={[styles.distance, style]} onPress={(e) => handlePress(e)} hitSlop={6}>
        <Image source={googleMapsIcon} style={styles.distanceIcon} resizeMode="contain" />
        <Text style={styles.distanceCaption} numberOfLines={1}>
          {caption}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
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

const useStyles = makeStyles(({ colors, shadows, mode }) => {
  const paper = paperColors(mode)
  return {
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
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
  },
  distanceIcon: { width: 22, height: 22 },
  distanceCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  panel: {
    width: 84,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  panelIconShell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
  },
  panelIcon: { width: 32, height: 32 },
  panelCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
  barIcon: { width: 22, height: 22 },
  barCaption: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface1,
  },
  placeIcon: { width: 28, height: 28 },
  placeDistance: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeAddress: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: paper.chip,
  },
  chipIcon: { width: 24, height: 24 },
  chipLabel: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.ink },
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
  }
})
