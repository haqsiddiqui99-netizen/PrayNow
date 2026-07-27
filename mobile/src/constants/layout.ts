import { Platform } from 'react-native'

export const TAB_BAR_HEIGHT = 50

export function tabBarBottomPadding(insetsBottom: number): number {
  if (insetsBottom > 0) return insetsBottom
  return Platform.OS === 'android' ? 48 : 8
}

export function getTabBarTotalHeight(insetsBottom: number): number {
  return TAB_BAR_HEIGHT + tabBarBottomPadding(insetsBottom)
}
