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
import { CITY_RADIUS_KM } from '@/src/constants/mosqueRadius'
import { localizePlaceName } from '@/src/i18n/placeNames'
import {
  FACILITY_KEYS,
  isLanguageCode,
  translations,
  LANGUAGES,
  type LanguageCode,
  type TranslationKey,
} from '@/src/i18n/translations'

const STORAGE_KEY = 'praynow.language'

/** Spellings used elsewhere in the app that map onto a `prayer.*` key. */
const PRAYER_ALIASES: Record<string, string> = {
  zohr: 'dhuhr',
  zuhr: 'dhuhr',
  jumma: 'juma',
  jummah: 'juma',
  duha: 'chasht',
}

type TranslateVars = Record<string, string | number>

export type Translate = (key: TranslationKey, vars?: TranslateVars) => string

interface LanguageContextValue {
  language: LanguageCode
  isRTL: boolean
  setLanguage: (code: LanguageCode) => void
  t: Translate
  /** Localised prayer or nafl name; unknown names pass through unchanged. */
  prayerName: (name: string) => string
  /** Localised amenity label; unknown facilities pass through unchanged. */
  facilityName: (facility: string) => string
  /**
   * Mosque name, area or address rendered in the active script. These are
   * database values, so they are transliterated rather than looked up.
   */
  placeName: (text: string | null | undefined) => string
  /** Compact span such as "1h 38m" in the active language. */
  formatDuration: (totalMinutes: number) => string
  /** Live span down to the second, such as "1h 38m 04s". */
  formatCountdown: (totalSeconds: number) => string
  /** Distance with a localised unit, e.g. "3.5 km" / "3.5 किमी". */
  formatDistance: (km: number) => string
  /** Radius chip / scope label, where the city sentinel reads as "City". */
  formatRadius: (km: number) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en')

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active && isLanguageCode(stored)) setLanguageState(stored)
    })
    return () => {
      active = false
    }
  }, [])

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code)
    void AsyncStorage.setItem(STORAGE_KEY, code)
  }, [])

  const t = useCallback<Translate>(
    (key, vars) => interpolate(translations[language][key] ?? translations.en[key], vars),
    [language],
  )

  const prayerName = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase()
      const canonical = PRAYER_ALIASES[normalized] ?? normalized
      const key = `prayer.${canonical}` as TranslationKey
      return key in translations.en ? t(key) : name
    },
    [t],
  )

  const facilityName = useCallback(
    (facility: string) => {
      const key = FACILITY_KEYS[facility.trim().toLowerCase()]
      return key ? t(key) : facility
    },
    [t],
  )

  const placeName = useCallback(
    (text: string | null | undefined) => localizePlaceName(text, language),
    [language],
  )

  const formatDistance = useCallback(
    (km: number) => (km < 1 ? `${Math.round(km * 1000)} ${t('units.m')}` : `${km} ${t('units.km')}`),
    [t],
  )

  const formatRadius = useCallback(
    (km: number) => (km >= CITY_RADIUS_KM ? t('radius.city') : formatDistance(km)),
    [t, formatDistance],
  )

  const formatDuration = useCallback(
    (totalMinutes: number) => {
      if (totalMinutes <= 0) return t('duration.now')
      const hrs = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60
      if (hrs > 0 && mins > 0) return t('duration.hm', { hrs, mins })
      if (hrs > 0) return t('duration.h', { hrs })
      return t('duration.m', { mins })
    },
    [t],
  )

  const formatCountdown = useCallback(
    (totalSeconds: number) => {
      if (totalSeconds <= 0) return t('duration.now')
      const hrs = Math.floor(totalSeconds / 3600)
      const mins = Math.floor((totalSeconds % 3600) / 60)
      const secs = totalSeconds % 60
      // Seconds are padded so the value keeps a steady width as it ticks.
      const padded = String(secs).padStart(2, '0')
      if (hrs > 0) return t('duration.hms', { hrs, mins, secs: padded })
      if (mins > 0) return t('duration.ms', { mins, secs: padded })
      return t('duration.s', { secs })
    },
    [t],
  )

  const isRTL = LANGUAGES.find((lang) => lang.code === language)?.rtl ?? false

  const value = useMemo(
    () => ({
      language,
      isRTL,
      setLanguage,
      t,
      prayerName,
      facilityName,
      placeName,
      formatDuration,
      formatCountdown,
      formatDistance,
      formatRadius,
    }),
    [
      language,
      isRTL,
      setLanguage,
      t,
      prayerName,
      facilityName,
      placeName,
      formatDuration,
      formatCountdown,
      formatDistance,
      formatRadius,
    ],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
