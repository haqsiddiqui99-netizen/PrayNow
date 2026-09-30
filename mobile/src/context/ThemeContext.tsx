import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { fontFamilyForWeight } from '@/src/constants/fonts'
import { themes, type Theme, type ThemeMode } from '@/src/constants/theme'

const STORAGE_KEY = 'praynow.theme'

type ThemeContextValue = Theme & {
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active && isThemeMode(stored)) setModeState(stored)
    })
    return () => {
      active = false
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    void AsyncStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      void AsyncStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ ...themes[mode], setMode, toggleMode }),
    [mode, setMode, toggleMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle }

/**
 * Every `makeStyles` call funnels through here, which is what lets the whole
 * app render in Inter without every screen naming a `fontFamily` itself: any
 * entry that looks like text styling (it sets `fontWeight` or `fontSize`) and
 * doesn't already choose its own family gets the Inter weight matching its
 * `fontWeight`. Entries that already set `fontFamily` are left alone.
 */
function withAppFont<T extends NamedStyles<unknown>>(styles: T): T {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(styles)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const style = value as TextStyle
      if ((style.fontWeight != null || style.fontSize != null) && style.fontFamily == null) {
        next[key] = { ...style, fontFamily: fontFamilyForWeight(style.fontWeight) }
        continue
      }
    }
    next[key] = value
  }
  return next as T
}

/**
 * Builds a hook that returns theme-aware styles.
 *
 * Stylesheets used to be created once at module load, which baked the light
 * palette into every screen. Wrapping the same style object in `makeStyles` lets
 * it be rebuilt per palette instead, while the token references inside stay
 * untouched:
 *
 *     const useStyles = makeStyles(({ colors, shadows }) => ({
 *       card: { backgroundColor: colors.surface2, ...shadows.card },
 *     }))
 *
 * Results are cached per mode, so each stylesheet is only ever built twice.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<unknown>>(
  factory: (theme: Theme) => T & NamedStyles<unknown>,
): () => T {
  const cache = new Map<ThemeMode, T>()

  return function useStyles(): T {
    const { mode } = useTheme()
    const cached = cache.get(mode)
    if (cached) return cached

    // The self-referential constraint above is what gives callers literal style
    // inference; it does not survive into the implementation body.
    const built = withAppFont(factory(themes[mode]) as NamedStyles<unknown>)
    const created = StyleSheet.create(built) as T
    cache.set(mode, created)
    return created
  }
}
