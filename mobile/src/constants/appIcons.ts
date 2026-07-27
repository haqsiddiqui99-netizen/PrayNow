import type { ImageSourcePropType } from 'react-native'

export type AppIconName = 'home' | 'mosque' | 'azan' | 'ai' | 'more' | 'compass' | 'hadees'

export const APP_ICONS: Record<AppIconName, ImageSourcePropType> = {
  home: require('../../assets/Home_PP.png'),
  mosque: require('../../assets/Mosque_PP.png'),
  azan: require('../../assets/Azan_PP.png'),
  ai: require('../../assets/Ai_PP.png'),
  more: require('../../assets/More_PP.png'),
  compass: require('../../assets/Compass_PP.png'),
  hadees: require('../../assets/Hadees_PP.png'),
}
