import { Platform, StyleSheet, type ViewStyle } from 'react-native'

export type ThemeMode = 'light' | 'dark'

/**
 * Every colour the app draws with. Both palettes implement the same keys so a
 * screen cannot reference a token that only exists in one mode.
 */
export type ThemeColors = {
  primary: string
  primaryLight: string
  primaryDark: string
  primarySoft: string
  accent: string
  /** Tint behind `accent` text, e.g. the home card's countdown pill. */
  accentSoft: string
  success: string
  successBg: string
  warning: string
  warningBg: string
  surface0: string
  surface1: string
  surface2: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  border: string
  heroGradientEnd: string
  /** Bottom tab bar — active tab reads in brand blue on a soft pill */
  tabActive: string
  tabInactive: string
  /** Screen headers — charcoal slate, softer than primary blue */
  headerBg: string
  /** List/filter UI synced with header (mosques page) */
  pageAccent: string
  pageAccentSoft: string
  /** Borders drawn over `pageAccentSoft` fills, e.g. the prayer timing grid. */
  gridBorder: string
  /** Border on the header's location pill. */
  pillBorder: string
  /**
   * Fill and label for a chosen chip, segment or toggle. Slate rather than brand
   * blue, and lightened in the dark palette because `headerBg` sits too close to
   * the card colour there to register as selected.
   */
  selectedBg: string
  selectedText: string
  /** Opaque tab bar fill, so scrolling content never shows through it. */
  tabBarBg: string
  tabBarBorder: string
  /** Translucent veil over a surface, used by loading and empty overlays. */
  surfaceScrim: string
  /** Readable text and hairline on `warningBg` / `successBg` notice panels. */
  warningText: string
  warningBorder: string
  successText: string
  /** Tint passed to expo-blur so frosted surfaces match the palette. */
  blurTint: 'light' | 'dark'
}

const lightColors: ThemeColors = {
  primary: '#0d47a1',
  primaryLight: '#1565c0',
  primaryDark: '#0a3d8f',
  primarySoft: '#e3f2fd',
  accent: '#c62828',
  accentSoft: '#fbe0e0',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#ea580c',
  warningBg: '#fff7ed',
  surface0: '#f8fafc',
  surface1: '#f1f5f9',
  surface2: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  heroGradientEnd: '#1976d2',
  tabActive: '#0d47a1',
  tabInactive: '#64748b',
  headerBg: '#1e293b',
  pageAccent: '#334155',
  pageAccentSoft: '#f1f5f9',
  gridBorder: 'rgba(51,65,85,0.12)',
  pillBorder: '#cfe3fb',
  selectedBg: '#1e293b',
  selectedText: '#ffffff',
  tabBarBg: '#ffffff',
  tabBarBorder: '#dbe2ec',
  surfaceScrim: 'rgba(255, 255, 255, 0.82)',
  warningText: '#92400e',
  warningBorder: '#fde68a',
  successText: '#15803d',
  blurTint: 'light',
}

/**
 * Dark palette. Brand blue is lightened because #0d47a1 fails contrast on a dark
 * background, and the surface ramp is inverted so `surface2` stays the "raised
 * card" layer that every screen already treats it as.
 */
const darkColors: ThemeColors = {
  primary: '#7aa8ff',
  primaryLight: '#9dc0ff',
  primaryDark: '#5b8ceb',
  primarySoft: '#1c2c48',
  accent: '#f87171',
  accentSoft: '#3b2022',
  success: '#4ade80',
  successBg: '#14321f',
  warning: '#fb923c',
  warningBg: '#3a2412',
  surface0: '#0b1120',
  surface1: '#151d2e',
  surface2: '#1a2436',
  textPrimary: '#e9eef8',
  textSecondary: '#a3b0c6',
  textMuted: '#6f7f99',
  border: '#2a3549',
  heroGradientEnd: '#3b6fc4',
  tabActive: '#9dc0ff',
  tabInactive: '#7f8da3',
  headerBg: '#111a2b',
  pageAccent: '#c2ccdd',
  pageAccentSoft: '#1f2937',
  gridBorder: 'rgba(226,232,240,0.14)',
  pillBorder: '#2f465e',
  selectedBg: '#46597a',
  selectedText: '#ffffff',
  tabBarBg: '#111a2b',
  tabBarBorder: '#2a3549',
  surfaceScrim: 'rgba(11, 17, 32, 0.82)',
  warningText: '#fdba74',
  warningBorder: 'rgba(251,146,60,0.42)',
  successText: '#6ee7a0',
  blurTint: 'dark',
}

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
}

function webOrNativeShadow(webBox: string, native: ViewStyle): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: webBox }
  }
  return native
}

export type ThemeShadows = {
  card: ViewStyle
  soft: ViewStyle
}

/**
 * Drop shadows read as haze on a dark background, so the dark theme leans on
 * surface contrast and keeps only a faint lift.
 */
function buildShadows(mode: ThemeMode): ThemeShadows {
  const tint = mode === 'dark' ? '#000000' : '#0f172a'
  const cardOpacity = mode === 'dark' ? 0.4 : 0.08
  const softOpacity = mode === 'dark' ? 0.3 : 0.05

  return {
    card: webOrNativeShadow(
      mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(15, 23, 42, 0.08)',
      {
        shadowColor: tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: cardOpacity,
        shadowRadius: 12,
        elevation: 3,
      },
    ),
    soft: webOrNativeShadow(
      mode === 'dark' ? '0 2px 6px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(15, 23, 42, 0.05)',
      {
        shadowColor: tint,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: softOpacity,
        shadowRadius: 6,
        elevation: 2,
      },
    ),
  }
}

export const shadowsByMode: Record<ThemeMode, ThemeShadows> = {
  light: buildShadows('light'),
  dark: buildShadows('dark'),
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const

/** Shared prayer timing text — matches Zawal / START / END on home card */
export function timingTextStyle(colors: ThemeColors) {
  return {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  }
}

export type Theme = {
  mode: ThemeMode
  colors: ThemeColors
  shadows: ThemeShadows
}

export const themes: Record<ThemeMode, Theme> = {
  light: { mode: 'light', colors: lightColors, shadows: shadowsByMode.light },
  dark: { mode: 'dark', colors: darkColors, shadows: shadowsByMode.dark },
}
