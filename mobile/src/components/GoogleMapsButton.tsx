import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, shadows } from '@/src/constants/theme'
import type { Mosque, TravelMode } from '@/src/types'
import { openGoogleMaps } from '@/src/utils/maps'

const googleMapsIcon = require('../../assets/images/google_map_icon.png')

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
        <Text style={styles.buttonLabel}>{label ?? 'Open in Google Maps'}</Text>
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
      <View style={[styles.iconShell, light && styles.iconShellLight]}>
        <Image source={googleMapsIcon} style={styles.icon} resizeMode="contain" />
      </View>
      {caption ? <Text style={[styles.caption, light && styles.captionLight]}>{caption}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', minWidth: 52 },
  iconShell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  iconShellLight: {
    backgroundColor: colors.surface2,
  },
  icon: { width: 28, height: 34 },
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  chipIcon: { width: 22, height: 26 },
  chipLabel: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  buttonIcon: { width: 26, height: 32 },
  buttonLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
})
