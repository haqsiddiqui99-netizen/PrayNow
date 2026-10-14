import type { LanguageCode } from '@/src/i18n/translations'

/** Hindi uses Devanagari; Urdu uses Persian digits; Arabic uses Arabic-Indic. */
const DIGITS: Record<LanguageCode, string> = {
  en: '0123456789',
  hi: '०१२३४५६७८९',
  ur: '۰۱۲۳۴۵۶۷۸۹',
  ar: '٠١٢٣٤٥٦٧٨٩',
}

/** Rewrite Western digits in a display string. Stored values stay unchanged. */
export function localizeDigits(value: string | number, language: LanguageCode): string {
  const text = String(value)
  if (language === 'en') return text
  const map = DIGITS[language]
  return text.replace(/[0-9]/g, (digit) => map[digit.charCodeAt(0) - 48] ?? digit)
}
