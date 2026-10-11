import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree'
import { Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader'
import { Poppins_500Medium } from '@expo-google-fonts/poppins'
import * as Font from 'expo-font'

/** Font family names must match @expo/vector-icons createIconSet registrations. */
const ICON_FONTS = {
  ionicons: require('../../assets/fonts/Ionicons.ttf'),
  'material-community': require('../../assets/fonts/MaterialCommunityIcons.ttf'),
} as const

/** Weights matched to the ones `withAppFont` in ThemeContext.tsx maps to. */
const TEXT_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} as const

/** Standalone accent font used for the home card's current-prayer name only. */
const ACCENT_FONTS = {
  Poppins_500Medium,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} as const

const ALL_FONTS = { ...ICON_FONTS, ...TEXT_FONTS, ...ACCENT_FONTS }
const FONT_KEYS = Object.keys(ALL_FONTS)

let appFontsPromise: Promise<void> | null = null

/**
 * Loads every font the app draws with — vector icons plus the Inter weights
 * `makeStyles` assigns automatically — before the first screen paints.
 */
export function loadAppFonts(): Promise<void> {
  if (FONT_KEYS.every((key) => Font.isLoaded(key))) {
    return Promise.resolve()
  }
  if (!appFontsPromise) {
    appFontsPromise = Font.loadAsync(ALL_FONTS).catch((error) => {
      appFontsPromise = null
      throw error
    })
  }
  return appFontsPromise
}
