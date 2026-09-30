import {
  Image,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { APP_ICONS, type AppIconName } from '@/src/constants/appIcons'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

export type AppIconVariant = 'tab' | 'menu' | 'avatar' | 'header' | 'page'

type AppIconProps = {
  name: AppIconName
  size?: number
  variant?: AppIconVariant
  style?: StyleProp<ViewStyle | ImageStyle>
}

export function AppIcon({ name, size = 24, variant = 'tab', style }: AppIconProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const backgrounds = {
    tab: colors.surface2,
    menu: colors.surface2,
    avatar: colors.surface2,
    header: colors.surface2,
    page: colors.surface0,
  } as const
  const backgroundColor = backgrounds[variant]
  const inset = Math.max(2, Math.round(size * 0.06))
  const imageSize = size - inset * 2

  if (variant === 'tab') {
    return (
      <Image
        source={APP_ICONS[name]}
        style={[{ width: size, height: size }, style as StyleProp<ImageStyle>]}
        resizeMode="contain"
      />
    )
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          backgroundColor,
          borderRadius: Math.round(size * 0.22),
        },
        style,
      ]}>
      <Image source={APP_ICONS[name]} style={{ width: imageSize, height: imageSize }} resizeMode="contain" />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}))
