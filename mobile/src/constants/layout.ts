import { Platform } from 'react-native'

export const TAB_BAR_HEIGHT = 54

/**
 * Shared height for every header control (theme toggle, language, bell, avatar,
 * location pill) so they sit on one centerline and read as a single set.
 */
export const HEADER_CONTROL_HEIGHT = 32

export function tabBarBottomPadding(insetsBottom: number): number {
  if (insetsBottom > 0) return insetsBottom
  return Platform.OS === 'android' ? 48 : 8
}

export function getTabBarTotalHeight(insetsBottom: number): number {
  return TAB_BAR_HEIGHT + tabBarBottomPadding(insetsBottom)
}
