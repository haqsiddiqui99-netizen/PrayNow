import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import type { ColorValue } from 'react-native'
import { useTheme } from '@/src/context/ThemeContext'

export type TabBarIconName = 'home' | 'ai' | 'mosque' | 'azan' | 'more'

type TabBarIconProps = {
  name: TabBarIconName
  focused: boolean
  color?: ColorValue
  size?: number
}

export function TabBarIcon({ name, focused, color, size = 24 }: TabBarIconProps) {
  const { colors } = useTheme()
  const iconColor = color ?? colors.textSecondary

  switch (name) {
    case 'home':
      return <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={iconColor} />
    case 'ai':
      return (
        <Ionicons
          name={focused ? 'sparkles' : 'sparkles-outline'}
          size={size}
          color={iconColor}
        />
      )
    case 'mosque':
      return (
        <MaterialCommunityIcons
          name={focused ? 'mosque' : 'mosque-outline'}
          size={size}
          color={iconColor}
        />
      )
    case 'azan':
      return <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={iconColor} />
    case 'more':
      return <Ionicons name={focused ? 'menu' : 'menu-outline'} size={size} color={iconColor} />
    default:
      return null
  }
}
