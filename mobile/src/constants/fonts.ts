/**
 * Inter, applied app-wide through `makeStyles` (see ThemeContext.tsx) rather
 * than by touching every style file. Weight buckets mirror the ones actually
 * used across the app's `fontWeight` values, so nothing falls back to a
 * synthetic (fake) bold.
 */
export const FONT_FAMILY_BY_WEIGHT: Record<string, string> = {
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
}

export const DEFAULT_FONT_FAMILY = FONT_FAMILY_BY_WEIGHT['400']

/** Resolves the loaded Inter family for a style's `fontWeight`, defaulting to Regular. */
export function fontFamilyForWeight(fontWeight?: string | number): string {
  if (fontWeight == null) return DEFAULT_FONT_FAMILY
  return FONT_FAMILY_BY_WEIGHT[String(fontWeight)] ?? DEFAULT_FONT_FAMILY
}
