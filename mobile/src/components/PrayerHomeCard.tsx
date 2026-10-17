/**
 * Home-screen prayer card: sky hero (per prayer, live weather, real moon phase, mosque skyline,
 * countdown), prayer strip, reminder row, Sun & Fasting arcs and the "More timings" accordion.
 * Everything is drawn with plain Views so no extra native module is needed.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutAnimation,
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { GradientFill } from '@/src/components/GradientFill';
import { Cloud, FastLine, MoonDisc, MoonOrb, Skyline, SunArc, SunOrb, moonShape, type MoonShape } from '@/src/components/SkyArt';
import type { CityPrayerConfig } from '@/src/config/cityPrayerConfig';
import type { PrayerName } from '@/src/types';
import { parseTime } from '@/src/utils/prayerSchedule';
import { ramadanDayOf } from '@/src/utils/hijriCalendar';
import {
  DEFAULT_SEHRI_LEAD,
  loadReminderKeys,
  loadSehriLead,
  saveSehriLead,
  setReminder,
  syncReminders,
  type ReminderItem,
  type ReminderMessage,
} from '@/src/services/prayerReminders';
import { useLanguage } from '@/src/context/LanguageContext';
import type { TranslationKey } from '@/src/i18n/translations';
import { makeStyles, useTheme } from '@/src/context/ThemeContext';

/* ========================================================================== */
/*  Live sky conditions: weather (Open-Meteo) + moon phase                    */
/* ========================================================================== */
export type WeatherKey = 'clear' | 'cloudy' | 'rain' | 'haze';

/** WMO weather code (+ cloud cover %, + US AQI) -> one of the four skies */
export function weatherFromCode(code: number, cloudCover?: number | null, aqi?: number | null): WeatherKey {
  if (aqi != null && aqi >= 200 && code <= 3) return 'haze';
  if (code === 45 || code === 48) return 'haze';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloudy';
  if (code === 2 || code === 3) return 'cloudy';
  if (cloudCover != null && cloudCover >= 70) return 'cloudy';
  return 'clear';
}

type RawWeather = { weather: WeatherKey; tempC: number; aqi: number | null; isDay: boolean };

async function getJSON<T>(url: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<RawWeather> {
  const q = `latitude=${lat}&longitude=${lon}`;
  const [w, a] = await Promise.allSettled([
    getJSON<any>(
      `https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,weather_code,cloud_cover,is_day&timezone=auto`,
    ),
    getJSON<any>(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=us_aqi`),
  ]);
  if (w.status !== 'fulfilled') throw new Error('weather unavailable');
  const c = w.value.current;
  const aqi = a.status === 'fulfilled' ? (a.value?.current?.us_aqi ?? null) : null;
  return {
    weather: weatherFromCode(c.weather_code, c.cloud_cover, aqi),
    tempC: Math.round(c.temperature_2m),
    aqi,
    isDay: c.is_day === 1,
  };
}

/** 0 = new moon, 0.25 = first quarter, 0.5 = full moon, 0.75 = last quarter */
export function moonPhase(date: Date = new Date()): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const p = ((jd - 2451550.09766) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

export function moonName(p: number): string {
  if (p < 0.03 || p >= 0.97) return 'New moon';
  if (p < 0.22) return 'Waxing crescent';
  if (p < 0.28) return 'First quarter';
  if (p < 0.47) return 'Waxing gibbous';
  if (p < 0.53) return 'Full moon';
  if (p < 0.72) return 'Waning gibbous';
  if (p < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

export const moonIllumination = (p: number): number => (1 - Math.cos(2 * Math.PI * p)) / 2;

export type Storage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

export type SkyConditions = {
  weather: WeatherKey;
  tempC: number | null;
  aqi: number | null;
  moon: { phase: number; name: string; illumination: number; shape: MoonShape };
  status: 'loading' | 'live' | 'cached' | 'error';
};

type Options = {
  lat: number;
  lon: number;
  refreshMs?: number;
  storage?: Storage;
};

const CACHE_KEY = 'praynow.sky.v1';
const CACHE_MAX_AGE = 3 * 60 * 60 * 1000;

export function useSkyConditions({ lat, lon, refreshMs = 15 * 60 * 1000, storage }: Options): SkyConditions {
  const [wx, setWx] = useState<{ weather: WeatherKey; tempC: number | null; aqi: number | null; status: SkyConditions['status'] }>({
    weather: 'clear',
    tempC: null,
    aqi: null,
    status: 'loading',
  });
  const [now, setNow] = useState(() => new Date());
  const last = useRef(0);

  const refresh = useCallback(async () => {
    last.current = Date.now();
    try {
      const r = await fetchWeather(lat, lon);
      setWx({ weather: r.weather, tempC: r.tempC, aqi: r.aqi, status: 'live' });
      storage?.setItem(CACHE_KEY, JSON.stringify({ ...r, at: Date.now() })).catch(() => {});
    } catch {
      setWx((cur) => (cur.status === 'loading' ? { ...cur, status: 'error' } : cur));
    }
  }, [lat, lon, storage]);

  useEffect(() => {
    let alive = true;
    storage
      ?.getItem(CACHE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const c = JSON.parse(raw);
        if (Date.now() - c.at < CACHE_MAX_AGE) {
          setWx((cur) => (cur.status === 'loading' ? { weather: c.weather, tempC: c.tempC, aqi: c.aqi ?? null, status: 'cached' } : cur));
        }
      })
      .catch(() => {});
    refresh();
    const id = setInterval(refresh, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refresh, refreshMs, storage]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(new Date());
        if (Date.now() - last.current > 5 * 60 * 1000) refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const phase = moonPhase(now);
  return {
    ...wx,
    moon: { phase, name: moonName(phase), illumination: moonIllumination(phase), shape: moonShape(phase) },
  };
}

/* ========================================================================== */
/*  Tokens                                                                     */
/* ========================================================================== */
type Palette = {
  card: string
  ink: string
  muted: string
  faint: string
  line: string
  tile: string
  dark: string
  sel: string
  onDark: string
  onPillSoft: string
  onAccent: string
  accent: string
  accentSoft: string
  amber: string
  amberSoft: string
  warmInk: string
  curIcon: string
  sun: [string, string, string]
  sunrise: string
  sehri: string
}

const LIGHT: Palette = {
  card: '#FFFFFF',
  ink: '#0F1F2E',
  muted: '#5F6B7A',
  faint: '#9AA5B3',
  line: '#E7EBF1',
  tile: '#F5F7FA',
  dark: '#14232F',
  sel: '#FFFFFF',
  onDark: '#FFFFFF',
  onPillSoft: 'rgba(255,255,255,0.72)',
  onAccent: '#FFFFFF',
  accent: '#1F7A68',
  accentSoft: 'rgba(31,122,104,0.12)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.14)',
  warmInk: '#B34100',
  curIcon: '#FFB020',
  sun: ['#FFF7EB', '#FFFFFF', '#F2F4FF'],
  sunrise: '#E58A1F',
  sehri: '#5B65C9',
}

const DARK: Palette = {
  card: '#101820',
  ink: '#F4F1EA',
  muted: '#9AA8B6',
  faint: '#66788A',
  line: 'rgba(244,241,234,0.10)',
  tile: '#182632',
  dark: '#F4EFE4',
  sel: '#243444',
  onDark: '#1C160E',
  onPillSoft: 'rgba(28,22,14,0.62)',
  onAccent: '#06241C',
  accent: '#7ED9C4',
  accentSoft: 'rgba(126,217,196,0.16)',
  amber: '#F5B83D',
  amberSoft: 'rgba(245,184,61,0.16)',
  warmInk: '#F0B15A',
  curIcon: '#C9842A',
  sun: ['#2C2418', '#15202A', '#171428'],
  sunrise: '#F0B15A',
  sehri: '#B7BEF5',
}

function useColors() {
  const { mode } = useTheme()
  return mode === 'dark' ? DARK : LIGHT
}
const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
  displayLight: 'Newsreader_500Medium',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/* ========================================================================== */
/*  Types + mapping from the city prayer config                                */
/* ========================================================================== */
export type SkyKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type PrayerWindow = {
  key: SkyKey;
  name: string;
  start: number; // minutes from midnight
  end: number; // minutes from midnight (Isha may be > 1440 = next day)
  icon: IconName;
};

export type ExtraWindow = {
  name: string;
  note: string;
  start: number;
  end: number;
  kind: 'optional' | 'avoid';
  icon: IconName;
};

export type PrayerDay = {
  hijri: string;
  prayers: PrayerWindow[];
  sun: { sunrise: number; sunset: number; sehri: number; iftar: number };
  extras: ExtraWindow[];
};

const PRAYER_META: Record<PrayerName, { key: SkyKey; icon: IconName }> = {
  Fajr: { key: 'fajr', icon: 'weather-sunset-up' },
  Dhuhr: { key: 'dhuhr', icon: 'white-balance-sunny' },
  Asr: { key: 'asr', icon: 'weather-partly-cloudy' },
  Maghrib: { key: 'maghrib', icon: 'weather-sunset-down' },
  Isha: { key: 'isha', icon: 'weather-night' },
};

function windowOf(start: string, end: string) {
  const s = parseTime(start);
  let e = parseTime(end);
  if (e <= s) e += 1440;
  return { start: s, end: e };
}

/**
 * The night runs from Maghrib to the next Fajr. Split in half it gives midnight; split in thirds, the last
 * third starts at two thirds of the way through. Minutes may pass 1440 (they roll into the next day).
 * Example: Maghrib 6:13 PM and Fajr 5:22 AM give midnight 11:48 PM and the last third from 1:39 AM.
 */
export function nightWindow(prayers: PrayerWindow[]) {
  const maghrib = prayers.find((p) => p.key === 'maghrib');
  const fajr = prayers.find((p) => p.key === 'fajr');
  const isha = prayers.find((p) => p.key === 'isha');
  if (!maghrib || !fajr) return null;
  const nextFajr = fajr.start + 1440;
  // Isha ends at tomorrow's Fajr when the calendar has that day; otherwise today's Fajr stands in.
  const end = isha && Math.abs(isha.end - nextFajr) <= 15 ? isha.end : nextFajr;
  const length = end - maghrib.start;
  if (length <= 0) return null;
  return {
    start: maghrib.start,
    end,
    midnight: Math.round(maghrib.start + length / 2),
    lastThird: Math.round(maghrib.start + (length * 2) / 3),
  };
}

export function prayerDayFromConfig(config: CityPrayerConfig, hijri: string): PrayerDay {
  const prayers = config.prayerSchedule.map((p) => ({
    ...PRAYER_META[p.name],
    name: p.name,
    ...windowOf(p.start, p.end),
  }));
  const maghrib = prayers.find((p) => p.key === 'maghrib')?.start ?? parseTime(config.sunrise) + 12 * 60;
  const night = nightWindow(prayers);
  const tahajjud: ExtraWindow[] = night
    ? [
        { name: 'Tahajjud', note: 'Midnight starts', kind: 'optional', icon: 'star-four-points-outline', start: night.midnight, end: night.end },
        { name: 'Last third of night', note: 'Best time for Tahajjud', kind: 'optional', icon: 'star-shooting-outline', start: night.lastThird, end: night.end },
      ]
    : [
        { name: 'Tahajjud', note: 'Night prayer', kind: 'optional', icon: 'star-four-points-outline', ...windowOf(config.nightTimings.tahajjud.start, config.nightTimings.tahajjud.end) },
      ];
  return {
    hijri,
    prayers,
    sun: {
      sunrise: parseTime(config.sunrise),
      sunset: maghrib,
      sehri: parseTime(config.nightTimings.sehri.end),
      iftar: maghrib,
    },
    extras: [
      ...tahajjud,
      { name: 'Tulu Aftab', note: 'Sun is rising', kind: 'avoid', icon: 'weather-sunset-up', ...windowOf(config.tuluAftab.start, config.tuluAftab.end) },
      { name: 'Ishraq', note: 'After sunrise', kind: 'optional', icon: 'white-balance-sunny', ...windowOf(config.ishraq.start, config.ishraq.end) },
      { name: 'Chasht', note: 'Forenoon prayer', kind: 'optional', icon: 'weather-partly-cloudy', ...windowOf(config.chasht.start, config.chasht.end) },
      { name: 'Zawal', note: 'Sun at its peak', kind: 'avoid', icon: 'clock-outline', ...windowOf(config.zawal.start, config.zawal.end) },
    ],
  };
}

/* ========================================================================== */
/*  Formatting + time helpers                                                  */
/* ========================================================================== */
const mer = (min: number) => (Math.floor(min / 60) % 24 < 12 ? 'AM' : 'PM');
const hm = (min: number) =>
  `${(((Math.floor(min / 60) % 24) + 11) % 12) + 1}:${String(min % 60).padStart(2, '0')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const mmss = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  const h = Math.floor(v / 3600);
  const mi = Math.floor((v % 3600) / 60);
  const x = v % 60;
  return h ? `${h}:${pad(mi)}:${pad(x)}` : `${pad(mi)}:${pad(x)}`;
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const MOON_KEYS: Record<string, TranslationKey> = {
  'New moon': 'moon.new',
  'Waxing crescent': 'moon.waxingCrescent',
  'First quarter': 'moon.firstQuarter',
  'Waxing gibbous': 'moon.waxingGibbous',
  'Full moon': 'moon.full',
  'Waning gibbous': 'moon.waningGibbous',
  'Last quarter': 'moon.lastQuarter',
  'Waning crescent': 'moon.waningCrescent',
};

const EXTRA_NOTES: Record<string, TranslationKey> = {
  Tahajjud: 'extra.nightPrayer',
  'Tulu Aftab': 'extra.sunRising',
  Ishraq: 'extra.afterSunrise',
  Chasht: 'extra.forenoon',
  Zawal: 'extra.sunPeak',
};

/** Notes written into the schedule itself (the night split), looked up by their English text. */
const NOTE_KEYS: Record<string, TranslationKey> = {
  'Midnight starts': 'extra.midnightStarts',
  'Best time for Tahajjud': 'extra.lastThirdNote',
};

function useClock() {
  const { t, prayerName, formatDuration, language, digits } = useLanguage();
  return useMemo(() => {
    const am = t('time.am');
    const pm = t('time.pm');
    const merL = (min: number) => (Math.floor(min / 60) % 24 < 12 ? am : pm);
    const hmL = (min: number) => digits(hm(min));
    const mmssL = (s: number) => digits(mmss(s));
    const t12L = (min: number) => `${hmL(min)} ${merL(min)}`;
    const rangeL = (a: number, b: number) =>
      mer(a) === mer(b) ? `${hmL(a)} – ${hmL(b)} ${merL(b)}` : `${t12L(a)} – ${t12L(b)}`;
    const nameOf = (name: string) =>
      name === 'Tulu Aftab' ? t('timings.tuluAftab') : name === 'Last third of night' ? t('extra.lastThird') : prayerName(name);
    const noteOf = (name: string, fallback: string) => {
      const key = NOTE_KEYS[fallback] ?? EXTRA_NOTES[name];
      return key ? t(key) : fallback;
    };
    const moonOf = (name: string) => {
      const key = MOON_KEYS[name];
      return key ? t(key) : name;
    };
    const locale = language === 'hi' ? 'hi-IN' : language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar' : 'en-US';
    return { t, formatDuration, locale, mer: merL, t12: t12L, range: rangeL, nameOf, noteOf, moonOf, hm: hmL, mmss: mmssL, digits };
  }, [t, prayerName, formatDuration, language, digits]);
}


/** seconds since local midnight, ticking every second (or a fixed value for testing) */
function useNowSeconds(override?: number): number {
  const read = () => {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };
  const [sec, setSec] = useState(override ?? read());
  useEffect(() => {
    if (override != null) {
      setSec(override);
      return;
    }
    const id = setInterval(() => setSec(read()), 1000);
    return () => clearInterval(id);
  }, [override]);
  return sec;
}

/** which prayer is current; `t` is the clock in seconds, +24h when we are in Isha after midnight */
function locate(prayers: PrayerWindow[], sec: number) {
  const minute = sec / 60;
  if (minute < prayers[0].start) return { cur: prayers.length - 1, t: sec + 86400 };
  let cur = 0;
  prayers.forEach((p, i) => {
    if (minute >= p.start) cur = i;
  });
  return { cur, t: sec };
}

/* ========================================================================== */
/*  Sky + weather configuration                                                */
/* ========================================================================== */
type SkyCfg = {
  grad: [string, string, string];
  ink: string;
  ink2: string;
  sil: string;
  sun1: string;
  sun2: string;
  sunO: number;
  moonO: number;
  stars: number;
  sx: number;
  sy: number;
  glass: string;
  glassLine: string;
  track: string;
};

const SKY: Record<SkyKey, SkyCfg> = {
  fajr: { grad: ['#D9E6FA', '#EBDDF0', '#FCD8C2'], ink: '#1F2D4D', ink2: 'rgba(31,45,77,0.72)', sil: '#6679A3', sun1: '#FFEFC9', sun2: '#FF9E66', sunO: 0.95, moonO: 0, stars: 0, sx: 0.2, sy: 212, glass: 'rgba(255,255,255,0.55)', glassLine: 'rgba(255,255,255,0.8)', track: 'rgba(31,45,77,0.14)' },
  dhuhr: { grad: ['#C6E4FB', '#E4F2FD', '#FFF4D2'], ink: '#17324A', ink2: 'rgba(23,50,74,0.72)', sil: '#5B87AE', sun1: '#FFFBD6', sun2: '#FFD54A', sunO: 1, moonO: 0, stars: 0, sx: 0.52, sy: 46, glass: 'rgba(255,255,255,0.6)', glassLine: 'rgba(255,255,255,0.85)', track: 'rgba(23,50,74,0.14)' },
  asr: { grad: ['#FBEBC4', '#F8D6A5', '#F3BFA0'], ink: '#3A2415', ink2: 'rgba(58,36,21,0.72)', sil: '#A0714F', sun1: '#FFEAB3', sun2: '#FFA94D', sunO: 1, moonO: 0, stars: 0, sx: 0.74, sy: 98, glass: 'rgba(255,255,255,0.55)', glassLine: 'rgba(255,255,255,0.8)', track: 'rgba(58,36,21,0.14)' },
  maghrib: { grad: ['#FFE6D2', '#FBC9B4', '#E7B2C8'], ink: '#2B2142', ink2: 'rgba(43,33,66,0.72)', sil: '#6C5A96', sun1: '#FFE3A8', sun2: '#FF9358', sunO: 1, moonO: 0, stars: 0, sx: 0.3, sy: 206, glass: 'rgba(255,255,255,0.5)', glassLine: 'rgba(255,255,255,0.75)', track: 'rgba(43,33,66,0.14)' },
  isha: { grad: ['#232F5A', '#36438A', '#5A62A3'], ink: '#F4F6FF', ink2: 'rgba(244,246,255,0.74)', sil: '#161E40', sun1: '#FFFFFF', sun2: '#FFFFFF', sunO: 0, moonO: 1, stars: 0.95, sx: 0.5, sy: 300, glass: 'rgba(255,255,255,0.13)', glassLine: 'rgba(255,255,255,0.24)', track: 'rgba(244,246,255,0.2)' },
};
const SKY_KEYS = Object.keys(SKY) as SkyKey[];

type WxCfg = { name: string; icon: IconName; vis: number; star: number; veil: string; veilO: number; cloud: string; clouds: boolean; rain: boolean };
function weatherCfg(w: WeatherKey, night: boolean): WxCfg {
  switch (w) {
    case 'cloudy':
      return { name: 'Cloudy', icon: 'weather-cloudy', vis: 0.55, star: 0.35, veil: night ? 'rgb(30,36,80)' : 'rgb(120,132,155)', veilO: night ? 0.28 : 0.3, cloud: night ? 'rgba(140,152,210,0.55)' : 'rgba(255,255,255,0.92)', clouds: true, rain: false };
    case 'rain':
      return { name: 'Rain', icon: 'weather-pouring', vis: 0.15, star: 0, veil: night ? 'rgb(12,16,44)' : 'rgb(55,66,92)', veilO: night ? 0.45 : 0.5, cloud: night ? 'rgba(68,78,128,0.85)' : 'rgba(108,120,146,0.9)', clouds: true, rain: true };
    case 'haze':
      return { name: 'Haze', icon: 'weather-hazy', vis: 0.55, star: 0.15, veil: night ? 'rgb(150,120,140)' : 'rgb(214,190,160)', veilO: night ? 0.35 : 0.5, cloud: 'transparent', clouds: false, rain: false };
    default:
      return { name: 'Clear', icon: night ? 'star-four-points-outline' : 'white-balance-sunny', vis: 1, star: 1, veil: 'transparent', veilO: 0, cloud: 'transparent', clouds: false, rain: false };
  }
}

/* ========================================================================== */
/*  Sky pieces                                                                 */
/* ========================================================================== */
const TIMING = { duration: 900, easing: Easing.out(Easing.quad) };

const SkyLayer = memo(function SkyLayer({ colors, active }: { colors: [string, string, string]; active: boolean }) {
  const o = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    o.value = withTiming(active ? 1 : 0, TIMING);
  }, [active, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st]} pointerEvents="none">
      <GradientFill colors={colors} vertical />
    </Animated.View>
  );
});

const Star = memo(function Star({ x, y, opacity }: { x: number; y: number; opacity: number }) {
  const styles = useStyles();
  const o = useSharedValue(opacity);
  useEffect(() => {
    o.value = withTiming(opacity, TIMING);
  }, [opacity, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[styles.star, { left: `${x}%`, top: y }, st]} />;
});
const STARS = [
  [12, 34], [27, 82], [40, 26], [60, 74], [90, 104], [70, 22], [84, 52],
] as const;

const Drop = memo(function Drop({ left, delay, duration, height }: { left: number; delay: number; duration: number; height: number }) {
  const styles = useStyles();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [delay, duration, p]);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: -20 + p.value * (height + 50) }, { translateX: -p.value * 40 }, { rotate: '8deg' }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.drop, { left: `${left}%` }, st]} />;
});

const Rain = memo(function Rain({ active, height }: { active: boolean; height: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    o.value = withTiming(active ? 1 : 0, { duration: 600 });
  }, [active, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  const drops = useMemo(
    () => Array.from({ length: 26 }, () => ({ left: Math.random() * 118 - 8, delay: Math.random() * 900, duration: 650 + Math.random() * 400 })),
    [],
  );
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st]}>
      {active && drops.map((d, i) => <Drop key={i} {...d} height={height} />)}
    </Animated.View>
  );
});

/* ========================================================================== */
/*  Hero                                                                       */
/* ========================================================================== */
const HERO_H = 226;

type HeroProps = {
  sky: SkyKey;
  weather: WeatherKey;
  tempC: number | null;
  weatherLoading: boolean;
  moon: { name: string; illumination: number; shape: MoonShape };
  hijri: string;
  clockText: string;
  label: string;
  title: string;
  windowText: string;
  cd: { kind: 'now' | 'later' | 'done'; text: string; sub: string; progress: number };
};

const Hero = memo(function Hero(p: HeroProps) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const [w, setW] = useState(0);
  const cfg = SKY[p.sky];
  const night = p.sky === 'isha';
  const wx = weatherCfg(p.weather, night);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const veilO = useSharedValue(wx.veilO);
  useEffect(() => {
    veilO.value = withTiming(wx.veilO, { duration: 800 });
  }, [wx.veilO, veilO]);
  const veilSt = useAnimatedStyle(() => ({ opacity: veilO.value }));
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = withTiming(p.cd.kind === 'done' ? 1 : p.cd.progress, { duration: 900 });
  }, [p.cd.kind, p.cd.progress, bar]);
  const barSt = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const illum = p.moon.illumination;
  const showMoonChip = night;

  return (
    <View style={styles.hero} onLayout={onLayout}>
      {SKY_KEYS.map((k) => (
        <SkyLayer key={k} colors={SKY[k].grad} active={k === p.sky} />
      ))}
      {STARS.map(([x, y], i) => (
        <Star key={i} x={x} y={y} opacity={cfg.stars * wx.star} />
      ))}
      {w > 0 && (
        <>
          <SunOrb cx={cfg.sx * w} cy={cfg.sy} opacity={cfg.sunO * wx.vis} c1={cfg.sun1} c2={cfg.sun2} />
          <MoonOrb cx={0.58 * w} shape={p.moon.shape} illumination={illum} opacity={cfg.moonO * wx.vis} />
        </>
      )}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wx.veil }, veilSt]} />
      {w > 0 && wx.clouds && (
        <>
          <Cloud top={44} scale={1.2} duration={50000} startFrac={0.1} width={w} color={wx.cloud} />
          <Cloud top={98} scale={0.9} duration={66000} startFrac={0.5} width={w} color={wx.cloud} />
          <Cloud top={26} scale={1.4} duration={84000} startFrac={0.8} width={w} color={wx.cloud} />
        </>
      )}

      <Skyline color={cfg.sil} />
      <Rain active={wx.rain} height={HERO_H} />

      <View style={styles.hc} pointerEvents="box-none">
        <View style={styles.hcTop}>
          <View style={[styles.glass, { backgroundColor: cfg.glass, borderColor: cfg.glassLine }]}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={13} color={cfg.ink} />
            <Text style={[styles.glassText, { color: cfg.ink }]} numberOfLines={1}>{p.hijri}</Text>
          </View>
          <Text style={[styles.clock, { color: cfg.ink2 }]} numberOfLines={1}>{p.clockText}</Text>
        </View>

        <View style={styles.hcMain}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.nowLabel, { color: cfg.ink2 }]}>{p.label}</Text>
            <Text style={[styles.name, { color: cfg.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {p.title}
            </Text>
            <Text style={[styles.win, { color: cfg.ink2 }]}>{p.windowText}</Text>
          </View>

          <View style={[styles.cd, { backgroundColor: cfg.glass, borderColor: cfg.glassLine }]} accessibilityRole="timer">
            {p.cd.kind === 'done' ? (
              <MaterialCommunityIcons name="check" size={24} color={colors.accent} />
            ) : (
              <Text style={[styles.cdBig, { color: cfg.ink }, p.cd.text.length > 5 && { fontSize: 18 }]}>{p.cd.text}</Text>
            )}
            <Text style={[styles.cdLab, { color: cfg.ink2 }]}>{p.cd.sub}</Text>
            <View style={[styles.cdTrack, { backgroundColor: cfg.track }]}>
              <Animated.View style={[styles.cdFill, { backgroundColor: p.cd.kind === 'done' ? colors.accent : '#FF7A3D' }, barSt]} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.foot} pointerEvents="none">
        <View style={[styles.glass, styles.chipSm, { backgroundColor: cfg.glass, borderColor: cfg.glassLine }]}>
          <MaterialCommunityIcons name={p.weatherLoading ? 'weather-cloudy' : wx.icon} size={14} color={cfg.ink} />
          <Text style={[styles.glassTextSm, { color: cfg.ink }]}>
            {p.weatherLoading || p.tempC == null ? clock.t('home.checkingWeather') : clock.digits(`${p.tempC}° ${clock.t(`weather.${p.weather}` as TranslationKey)}`)}
          </Text>
        </View>
        {showMoonChip && (
          <View style={[styles.glass, styles.chipSm, { backgroundColor: cfg.glass, borderColor: cfg.glassLine }]}>
            <MoonDisc shape={p.moon.shape} size={12} tiny />
            <Text style={[styles.glassTextSm, { color: cfg.ink }]}>
              {clock.moonOf(p.moon.name)}
              {illum > 0.03 && illum < 0.97 ? clock.digits(` · ${Math.round(illum * 100)}%`) : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

/* ========================================================================== */
/*  Prayer strip                                                               */
/* ========================================================================== */
const Strip = memo(function Strip({
  prayers,
  cur,
  doneBefore,
  sel,
  reminders,
  onSelect,
}: {
  prayers: PrayerWindow[];
  cur: number;
  /** Indexes below this are finished. Equals `cur` except in the Chasht gap, when Fajr is passed and no prayer is current. */
  doneBefore: number;
  sel: number;
  reminders: ReadonlySet<string>;
  onSelect: (i: number) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  return (
    <View style={styles.strip} accessibilityRole="tablist">
      {prayers.map((p, i) => {
        const isCur = i === cur;
        const done = i < doneBefore;
        const isSel = i === sel;
        const mark = done ? 'check' : reminders.has(p.key) ? 'bell' : null;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${clock.nameOf(p.name)} ${clock.t12(p.start)}`}
            style={[styles.pc, isCur && styles.pcCur, isSel && !isCur && styles.pcSel]}
          >
            {mark && (
              <MaterialCommunityIcons name={mark} size={10} color={isCur ? colors.curIcon : colors.accent} style={styles.pcMark} />
            )}
            <MaterialCommunityIcons name={p.icon} size={19} color={isCur ? colors.curIcon : isSel ? colors.ink : colors.muted} />
            <Text style={[styles.pcName, isCur && { color: colors.onPillSoft }]}>{clock.nameOf(p.name)}</Text>
            <Text style={[styles.pcTime, done && { color: colors.muted, fontFamily: F.bold }, isCur && { color: colors.onDark }]}>
              {clock.hm(p.start)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/* ========================================================================== */
/*  Sun & Fasting                                                              */
/* ========================================================================== */
function SfSide({ icon, label, time, end, tint }: { icon: IconName; label: string; time: number; end?: boolean; tint: string }) {
  const styles = useStyles();
  const clock = useClock();
  return (
    <View style={[styles.sfSide, end && { alignItems: 'flex-end' }]}>
      <View style={styles.sfLabelRow}>
        {!end && <MaterialCommunityIcons name={icon} size={14} color={tint} />}
        <Text style={styles.sfLabel}>{label}</Text>
        {end && <MaterialCommunityIcons name={icon} size={14} color={tint} />}
      </View>
      <Text style={styles.sfTime}>{clock.hm(time)}</Text>
    </View>
  );
}

const SunFasting = memo(function SunFasting({ sun, nowMin }: { sun: PrayerDay['sun']; nowMin: number }) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const prog = (a: number, b: number) => clamp01((nowMin - a) / (b - a));
  return (
    <View style={styles.sf}>
      <GradientFill colors={colors.sun} vertical />
      <View style={styles.sfRow}>
        <SfSide icon="weather-sunset-up" label={clock.t('timings.sunrise')} time={sun.sunrise} tint={colors.sunrise} />
        <View style={styles.sfMid}>
          <SunArc progress={prog(sun.sunrise, sun.sunset)} line={colors.line} faint={colors.faint} />
          <Text style={styles.sfMidText}>{clock.t('home.daylight', { duration: clock.formatDuration(sun.sunset - sun.sunrise) })}</Text>
        </View>
        <SfSide icon="weather-sunset-down" label={clock.t('timings.sunset')} time={sun.sunset} end tint={colors.sunrise} />
      </View>
      <View style={[styles.sfRow, styles.sfRowBorder]}>
        <SfSide icon="weather-night" label={clock.t('timings.sehri')} time={sun.sehri} tint={colors.sehri} />
        <View style={styles.sfMid}>
          <FastLine progress={prog(sun.sehri, sun.iftar)} faint={colors.faint} />
          <Text style={styles.sfMidText}>{clock.t('home.fast', { duration: clock.formatDuration(sun.iftar - sun.sehri) })}</Text>
        </View>
        <SfSide icon="coffee-outline" label={clock.t('timings.eftari')} time={sun.iftar} end tint={colors.sehri} />
      </View>
    </View>
  );
});

/* ========================================================================== */
/*  Ramadan                                                                    */
/* ========================================================================== */
/** Shows the Ramadan strip outside Ramadan for testing. Set to false before release. */
const SEHRI_LEADS = [60, 30, 15, 5];
const MAX_SEHRI_LEAD = 180;

const SehriLeadSheet = memo(function SehriLeadSheet({
  visible,
  lead,
  on,
  onClose,
  onSave,
  onTurnOff,
}: {
  visible: boolean;
  lead: number;
  on: boolean;
  onClose: () => void;
  onSave: (minutes: number) => void;
  onTurnOff: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const [pick, setPick] = useState<number | 'custom'>(lead);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPick(SEHRI_LEADS.includes(lead) ? lead : 'custom');
    setCustom(SEHRI_LEADS.includes(lead) ? '' : String(lead));
  }, [visible, lead]);

  const customMinutes = Math.round(Number(custom.replace(/[^0-9]/g, '')));
  const valid = pick !== 'custom' || (customMinutes >= 1 && customMinutes <= MAX_SEHRI_LEAD);
  const save = () => {
    if (!valid) return;
    onSave(pick === 'custom' ? customMinutes : pick);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.slBackdrop} onStartShouldSetResponder={() => true}>
        <Pressable style={styles.slDismiss} onPress={onClose} />
        <View style={styles.slSheet}>
          <View style={styles.slHead}>
            <MaterialCommunityIcons name="weather-night" size={18} color={colors.sehri} />
            <Text style={styles.slTitle}>{clock.t('ramadan.sehriAsk')}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.slClose}>
              <MaterialCommunityIcons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.slChips}>
            {[...SEHRI_LEADS, 'custom' as const].map((option) => {
              const selected = pick === option;
              return (
                <Pressable
                  key={String(option)}
                  onPress={() => setPick(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.slChip, selected && styles.slChipOn]}>
                  <Text style={[styles.slChipText, selected && styles.slChipTextOn]} numberOfLines={1}>
                    {option === 'custom' ? clock.t('ramadan.custom') : clock.formatDuration(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {pick === 'custom' ? (
            <View style={styles.slCustom}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="45"
                placeholderTextColor={colors.faint}
                style={styles.slInput}
                autoFocus
                onSubmitEditing={save}
              />
              <Text style={styles.slInputHint}>{clock.t('ramadan.customHint', { max: MAX_SEHRI_LEAD })}</Text>
            </View>
          ) : null}
          <View style={styles.slActions}>
            {on ? (
              <Pressable onPress={onTurnOff} style={[styles.slBtn, styles.slBtnGhost]} accessibilityRole="button">
                <Text style={styles.slBtnGhostText}>{clock.t('ramadan.turnOff')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={save}
              disabled={!valid}
              style={[styles.slBtn, styles.slBtnMain, !valid && { opacity: 0.4 }]}
              accessibilityRole="button">
              <Text style={styles.slBtnMainText}>{clock.t('reminder.save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const RamadanStrip = memo(function RamadanStrip({
  sun,
  nowMin,
  day,
  reminders,
  sehriLead,
  onSehri,
  onToggle,
}: {
  sun: PrayerDay['sun'];
  nowMin: number;
  day: number;
  reminders: Set<string>;
  sehriLead: number;
  onSehri: () => void;
  onToggle: (which: 'sehri' | 'iftar') => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const toSehri = sun.sehri - nowMin;
  const toIftar = sun.iftar - nowMin;
  const fasting = toSehri <= 0 && toIftar > 0;
  const left = fasting ? toIftar : toSehri > 0 ? toSehri : sun.sehri + 1440 - nowMin;
  return (
    <View style={styles.ram}>
      <View style={styles.ramHead}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={16} color={colors.sehri} />
        <Text style={styles.ramTitle}>{clock.t('ramadan.day', { day })}</Text>
        <Text style={styles.ramCount} numberOfLines={1}>
          {clock.t(fasting ? 'ramadan.iftarIn' : 'ramadan.sehriIn', { duration: clock.formatDuration(left) })}
        </Text>
      </View>
      <View style={styles.ramBells}>
        {(['sehri', 'iftar'] as const).map((which) => {
          const on = reminders.has(`ramadan:${which}`);
          return (
            <Pressable
              key={which}
              onPress={() => (which === 'sehri' ? onSehri() : onToggle(which))}
              accessibilityRole={which === 'sehri' ? 'button' : 'switch'}
              accessibilityState={{ checked: on }}
              style={[styles.remBtn, styles.ramBtn, on && styles.remBtnOn]}>
              <MaterialCommunityIcons name={on ? 'bell-ring' : 'bell-outline'} size={15} color={on ? colors.onAccent : colors.muted} />
              <Text style={[styles.remBtnText, on && { color: colors.onAccent }]} numberOfLines={1}>
                {which === 'iftar'
                  ? clock.t('ramadan.iftarAlert')
                  : on
                    ? clock.t('ramadan.sehriAlert', { when: clock.formatDuration(sehriLead) })
                    : clock.t('ramadan.sehriOff')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/* ========================================================================== */
/*  More timings                                                               */
/* ========================================================================== */
export const extraKey = (w: ExtraWindow) => `extra:${w.name.toLowerCase().replace(/\s+/g, '-')}`;

const MoreTimings = memo(function MoreTimings({
  extras,
  nowMin,
  reminders,
  onToggle,
}: {
  extras: ExtraWindow[];
  nowMin: number;
  reminders: ReadonlySet<string>;
  onToggle: (w: ExtraWindow) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setOpen((v) => !v);
  }, []);
  return (
    <View style={styles.acc}>
      <Pressable onPress={toggle} style={styles.accHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View>
          <Text style={styles.accTitle}>{clock.t('home.moreTimings')}</Text>
          <Text style={styles.accSub}>{clock.t('home.optionalAvoid')}</Text>
        </View>
        <View style={styles.chev}>
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </View>
      </Pressable>
      {open && (
        <View style={styles.dl}>
          {extras.map((w, i) => {
            const avoid = w.kind === 'avoid';
            const now = (nowMin >= w.start && nowMin < w.end) || (nowMin + 1440 >= w.start && nowMin + 1440 < w.end);
            return (
              <View key={w.name} style={[styles.it, i > 0 && styles.itDivider]}>
                <View style={[styles.itIcon, avoid && { backgroundColor: colors.amberSoft }]}>
                  <MaterialCommunityIcons name={w.icon} size={15} color={avoid ? colors.warmInk : colors.accent} />
                </View>
                <View style={styles.itBody}>
                  <View style={styles.itNameRow}>
                    <Text style={styles.itName} numberOfLines={1}>
                      {clock.nameOf(w.name)}
                    </Text>
                    {avoid && <Text style={styles.avoidTag}>{clock.t('home.avoid')}</Text>}
                    {now && (
                      <Text style={[styles.nowChip, avoid && { backgroundColor: colors.amber, color: '#2A1A00' }]}>{clock.t('home.now')}</Text>
                    )}
                  </View>
                  <Text style={styles.itNote} numberOfLines={1}>
                    {clock.noteOf(w.name, w.note)}
                  </Text>
                </View>
                <Text style={[styles.itTime, avoid && { color: colors.warmInk }]} numberOfLines={1}>
                  {clock.range(w.start, w.end)}
                </Text>
                <Pressable
                  onPress={() => onToggle(w)}
                  hitSlop={6}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminders.has(extraKey(w)) }}
                  accessibilityLabel={clock.t(reminders.has(extraKey(w)) ? 'home.remindOffA11y' : 'home.remindOnA11y', { name: clock.nameOf(w.name) })}
                  style={[styles.itBell, reminders.has(extraKey(w)) && styles.itBellOn]}>
                  <MaterialCommunityIcons
                    name={reminders.has(extraKey(w)) ? 'bell-ring' : 'bell-outline'}
                    size={14}
                    color={reminders.has(extraKey(w)) ? colors.onAccent : colors.muted}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

/* ========================================================================== */
/*  Main card                                                                  */
/* ========================================================================== */
export type PrayerHomeCardProps = {
  data: PrayerDay;
  lat: number;
  lon: number;
  storage?: Storage;
  initialReminders?: SkyKey[];
  onToggleReminder?: (prayer: SkyKey, on: boolean) => void;
  onToast?: (message: string) => void;
  nowOverride?: number; // seconds since midnight (for testing)
};

export function PrayerHomeCard({
  data,
  lat,
  lon,
  storage,
  initialReminders = [],
  onToggleReminder,
  onToast,
  nowOverride,
}: PrayerHomeCardProps) {
  const styles = useStyles();
  const colors = useColors();
  const clock = useClock();
  const sec = useNowSeconds(nowOverride);
  const nowMin = Math.floor(sec / 60);
  const conditions = useSkyConditions({ lat, lon, storage });
  const { cur, t: nowSec } = locate(data.prayers, sec);
  const fajrWindow = data.prayers.find((prayer) => prayer.key === 'fajr');
  const dhuhrIndex = data.prayers.findIndex((prayer) => prayer.key === 'dhuhr');
  const dhuhrWindow = dhuhrIndex >= 0 ? data.prayers[dhuhrIndex] : undefined;
  const chasht = data.extras.find((extra) => extra.name === 'Chasht');
  // Fajr's window is over and Dhuhr has not begun: Chasht takes the card.
  const chashtNow = Boolean(
    chasht && fajrWindow && dhuhrWindow && nowMin >= fajrWindow.end && nowMin < dhuhrWindow.start,
  );

  const [sel, setSel] = useState<number | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(() => new Set(initialReminders));
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sehriLead, setSehriLead] = useState(DEFAULT_SEHRI_LEAD);
  const [sehriSheet, setSehriSheet] = useState(false);
  useEffect(() => {
    void loadSehriLead().then(setSehriLead);
  }, []);
  const ramadanDay = useMemo(() => {
    return ramadanDayOf(new Date());
    // Re-check as the clock moves so the strip appears on 1 Ramadan without a restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMin]);
  const reminderItems = useMemo<ReminderItem[]>(
    () => [
      ...data.prayers.map((w) => ({ key: w.key, name: w.name, start: w.start, end: w.end, kind: 'prayer' as const })),
      ...data.extras.map((w) => ({ key: extraKey(w), name: w.name, start: w.start, end: w.end, kind: w.kind })),
      ...(ramadanDay
        ? [
            { key: 'ramadan:sehri', name: clock.t('timings.sehri'), start: data.sun.sehri - sehriLead, end: data.sun.sehri, kind: 'sehri' as const },
            { key: 'ramadan:iftar', name: clock.t('timings.eftari'), start: data.sun.iftar, end: data.sun.iftar, kind: 'iftar' as const },
          ]
        : []),
    ],
    [data, ramadanDay, clock, sehriLead],
  );
  useEffect(() => {
    let alive = true;
    void loadReminderKeys().then((keys) => {
      if (alive && keys.length) setReminders((prev) => new Set([...prev, ...keys]));
    });
    return () => {
      alive = false;
    };
  }, []);
  const reminderMessage = useCallback<ReminderMessage>(
    (item) => {
      const name = clock.nameOf(item.name);
      if (item.kind === 'sehri') {
        return { title: clock.t('ramadan.sehriTitle', { time: clock.t12(item.end) }), body: clock.t('ramadan.sehriBody', { when: clock.formatDuration(Math.round(item.end - item.start)) }) };
      }
      if (item.kind === 'iftar') {
        return { title: clock.t('ramadan.iftarTitle'), body: clock.t('ramadan.iftarBody', { time: clock.t12(item.start) }) };
      }
      if (item.kind === 'avoid') {
        return { title: clock.t('reminder.avoidTitle', { name }), body: clock.t('reminder.avoidBody', { time: clock.t12(item.end) }) };
      }
      if (item.kind === 'optional') {
        return { title: clock.t('reminder.prayerTitle', { name }), body: clock.t('reminder.optionalBody', { name, time: clock.t12(item.end) }) };
      }
      return { title: clock.t('reminder.prayerTitle', { name }), body: clock.t('reminder.prayerBody', { name, time: clock.t12(item.start) }) };
    },
    [clock],
  );
  useEffect(() => {
    void syncReminders(reminderItems, reminderMessage);
  }, [reminderItems, reminderMessage]);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);
  const showNotice = useCallback(
    (text: string) => {
      setNotice(text);
      onToast?.(text);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(''), 3200);
    },
    [onToast],
  );
  const applyItem = useCallback(
    async (item: ReminderItem, on: boolean) => {
      setReminders((prev) => {
        const next = new Set(prev);
        if (on) next.add(item.key);
        else next.delete(item.key);
        return next;
      });
      const result = await setReminder(item, on, reminderMessage);
      if (result === 'denied') {
        setReminders((prev) => {
          const next = new Set(prev);
          next.delete(item.key);
          return next;
        });
        showNotice(clock.t('home.allowNotifications'));
        return;
      }
      if (!on) showNotice(clock.t('home.reminderOff', { name: clock.nameOf(item.name) }));
      else if (result === 'unsupported') showNotice(clock.t('home.reminderPhone', { name: clock.nameOf(item.name) }));
      else showNotice(clock.t('home.reminderDaily', { name: clock.nameOf(item.name), time: clock.t12(item.start) }));
    },
    [showNotice, clock, reminderMessage],
  );
  const toggleItem = useCallback(
    (item: ReminderItem) => applyItem(item, !reminders.has(item.key)),
    [applyItem, reminders],
  );
  const toggleRamadan = useCallback(
    (which: 'sehri' | 'iftar') => {
      const item = reminderItems.find((entry) => entry.key === `ramadan:${which}`);
      if (item) void toggleItem(item);
    },
    [reminderItems, toggleItem],
  );
  const sehriItem = reminderItems.find((entry) => entry.key === 'ramadan:sehri');
  const saveSehri = useCallback(
    (minutes: number) => {
      setSehriSheet(false);
      setSehriLead(minutes);
      void saveSehriLead(minutes);
      if (sehriItem) void applyItem({ ...sehriItem, start: sehriItem.end - minutes }, true);
    },
    [sehriItem, applyItem],
  );
  const turnOffSehri = useCallback(() => {
    setSehriSheet(false);
    if (sehriItem) void applyItem(sehriItem, false);
  }, [sehriItem, applyItem]);
  const toggleExtra = useCallback(
    (w: ExtraWindow) => {
      const item = reminderItems.find((entry) => entry.key === extraKey(w));
      if (item) void toggleItem(item);
    },
    [reminderItems, toggleItem],
  );
  const prevCur = useRef(cur);
  useEffect(() => {
    if (prevCur.current !== cur) {
      prevCur.current = cur;
      setSel(null);
    }
  }, [cur]);
  const selected = sel ?? cur;
  const p = data.prayers[selected];
  const showChasht = chashtNow && sel === null && chasht != null && dhuhrWindow != null;

  const cd = useMemo(() => {
    if (showChasht && chasht && dhuhrWindow) {
      const endMin = nowMin < chasht.end ? chasht.end : dhuhrWindow.start;
      const span = Math.max(60, (chasht.end - chasht.start) * 60);
      return {
        kind: 'now' as const,
        text: clock.mmss(endMin * 60 - nowSec),
        sub: clock.t('home.left'),
        progress: clamp01((nowSec - chasht.start * 60) / span),
      };
    }
    if (selected === cur) {
      const left = p.end * 60 - nowSec;
      return { kind: 'now' as const, text: clock.mmss(left), sub: clock.t('home.left'), progress: clamp01((nowSec - p.start * 60) / ((p.end - p.start) * 60)) };
    }
    if (selected < cur) return { kind: 'done' as const, text: '', sub: clock.t('home.completed'), progress: 1 };
    const secs = p.start * 60 - nowSec;
    return { kind: 'later' as const, text: clock.formatDuration(Math.max(1, Math.ceil(secs / 60))), sub: clock.t('home.toStart'), progress: 0 };
  }, [showChasht, chasht, dhuhrWindow, nowMin, selected, cur, p, nowSec, clock]);

  const label = selected === cur ? clock.t('home.now') : selected < cur ? clock.t('home.earlierToday') : clock.t('home.laterToday');
  const clockText = (() => {
    const d = new Date();
    const wd = d.toLocaleDateString(clock.locale, { weekday: 'short' });
    const mo = d.toLocaleDateString(clock.locale, { month: 'short' });
    return clock.digits(`${wd}, ${mo} ${d.getDate()} · ${hm(nowMin)} ${clock.mer(nowMin)}`);
  })();

  const target = selected === cur ? (cur + 1) % data.prayers.length : selected;
  const tp = data.prayers[target];
  let untilSec = tp.start * 60 - nowSec;
  if (untilSec <= 0) untilSec += 86400;
  const remOn = reminders.has(tp.key);

  const toggleReminder = useCallback(() => {
    onToggleReminder?.(tp.key, !reminders.has(tp.key));
    void toggleItem({ key: tp.key, name: tp.name, start: tp.start, end: tp.end, kind: 'prayer' });
  }, [reminders, tp, onToggleReminder, toggleItem]);

  return (
    <View style={styles.card}>
      <Hero
        sky={showChasht ? 'dhuhr' : p.key}
        weather={conditions.weather}
        tempC={conditions.tempC}
        weatherLoading={conditions.status === 'loading'}
        moon={conditions.moon}
        hijri={data.hijri}
        clockText={clockText}
        label={label}
        title={showChasht ? clock.nameOf('Chasht') : clock.nameOf(p.name)}
        windowText={showChasht && chasht ? clock.range(chasht.start, chasht.end) : clock.range(p.start, p.end)}
        cd={cd}
      />

      <Strip
        prayers={data.prayers}
        cur={chashtNow ? -1 : cur}
        doneBefore={chashtNow ? dhuhrIndex : cur}
        sel={showChasht ? -1 : selected}
        reminders={reminders}
        onSelect={setSel}
      />

      <View style={styles.rem}>
        {selected < cur ? (
          <Text style={styles.remText} numberOfLines={1}>
            <Text style={styles.remBold}>{clock.nameOf(p.name)}</Text> {clock.t('home.completed')} · {clock.t12(p.start)}
          </Text>
        ) : (
          <>
            <Text style={styles.remText} numberOfLines={1}>
              {selected === cur ? `${clock.t('home.next')} · ` : ''}
              <Text style={styles.remBold}>{clock.nameOf(tp.name)}</Text> {clock.t12(tp.start)} · {clock.t('home.inDuration', { duration: clock.formatDuration(Math.max(1, Math.ceil(untilSec / 60))) })}
            </Text>
            <Pressable
              onPress={toggleReminder}
              accessibilityRole="switch"
              accessibilityState={{ checked: remOn }}
              accessibilityLabel={clock.t(remOn ? 'home.remindOffA11y' : 'home.remindOnA11y', { name: clock.nameOf(tp.name) })}
              style={[styles.remBtn, remOn && styles.remBtnOn]}
            >
              <MaterialCommunityIcons name={remOn ? 'bell-ring' : 'bell-outline'} size={15} color={remOn ? colors.onAccent : colors.muted} />
              <Text style={[styles.remBtnText, remOn && { color: colors.onAccent }]}>{remOn ? clock.t('home.on') : clock.t('home.remind')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {ramadanDay ? (
        <>
          <RamadanStrip
            sun={data.sun}
            nowMin={nowMin}
            day={ramadanDay}
            reminders={reminders}
            sehriLead={sehriLead}
            onSehri={() => setSehriSheet(true)}
            onToggle={toggleRamadan}
          />
          <SehriLeadSheet
            visible={sehriSheet}
            lead={sehriLead}
            on={reminders.has('ramadan:sehri')}
            onClose={() => setSehriSheet(false)}
            onSave={saveSehri}
            onTurnOff={turnOffSehri}
          />
        </>
      ) : null}
      <SunFasting sun={data.sun} nowMin={nowMin} />
      {notice ? (
        <View style={styles.notice}>
          <MaterialCommunityIcons name="bell-check-outline" size={14} color={colors.accent} />
          <Text style={styles.noticeText} numberOfLines={2}>
            {notice}
          </Text>
        </View>
      ) : null}
      <MoreTimings extras={data.extras} nowMin={nowMin} reminders={reminders} onToggle={toggleExtra} />
    </View>
  );
}

/* ========================================================================== */
/*  Styles                                                                     */
/* ========================================================================== */
const glassBase = { borderWidth: 1, borderRadius: 999 } as const;

const useStyles = makeStyles(({ mode }) => {
  const C = mode === 'dark' ? DARK : LIGHT
  return {
  card: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    overflow: 'hidden',
    paddingBottom: 2,
  },

  hero: { height: HERO_H, marginHorizontal: 8, marginTop: 8, borderRadius: 22, overflow: 'hidden' },
  orb: { position: 'absolute', left: 0, top: 0, width: 170, height: 170 },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff' },
  skyline: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  drop: { position: 'absolute', top: 0, width: 1.6, height: 16, borderRadius: 2, backgroundColor: 'rgba(235,242,255,0.8)' },
  hc: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingTop: 12, paddingHorizontal: 14 },
  hcTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  glass: { ...glassBase, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingLeft: 8, paddingRight: 10 },
  chipSm: { paddingVertical: 4, paddingLeft: 7, paddingRight: 9, gap: 5 },
  glassText: { fontFamily: F.bold, fontSize: 12 },
  glassTextSm: { fontFamily: F.bold, fontSize: 12 },
  clock: { fontFamily: F.semi, fontSize: 12, fontVariant: ['tabular-nums'], flexShrink: 1, marginLeft: 8, textAlign: 'right' },
  hcMain: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  nowLabel: { fontFamily: F.semi, fontSize: 12.5 },
  name: { fontFamily: F.displayLight, fontSize: 40, lineHeight: 44, letterSpacing: -1, marginTop: 1 },
  win: { fontFamily: F.semi, fontSize: 13.5, marginTop: 5, fontVariant: ['tabular-nums'] },
  cd: { width: 104, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  cdBig: { fontFamily: F.heavy, fontSize: 24, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  cdLab: { fontFamily: F.semi, fontSize: 12, marginTop: 4 },
  cdTrack: { height: 4, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  cdFill: { height: '100%', borderRadius: 4 },
  foot: { position: 'absolute', left: 10, bottom: 9, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  strip: { flexDirection: 'row', gap: 3, marginHorizontal: 8, marginTop: 8, padding: 4, borderRadius: 22, backgroundColor: C.tile },
  pc: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 9, borderRadius: 18 },
  pcCur: {
    backgroundColor: C.dark,
    shadowColor: mode === 'dark' ? '#F4EFE4' : '#0F1F2E',
    shadowOpacity: mode === 'dark' ? 0.22 : 0.45,
    shadowRadius: mode === 'dark' ? 12 : 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pcSel: { backgroundColor: C.sel, shadowColor: '#0F1F2E', shadowOpacity: 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  pcMark: { position: 'absolute', top: 5, right: 6 },
  pcName: { fontFamily: F.semi, fontSize: 12, color: C.muted, marginTop: 5 },
  pcTime: { fontFamily: F.heavy, fontSize: 15, color: C.ink, marginTop: 1, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },

  rem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 14, marginTop: 8, minHeight: 34 },
  remText: { flex: 1, fontFamily: F.semi, fontSize: 13, color: C.muted },
  remBold: { fontFamily: F.bold, color: C.ink },
  remBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.tile },
  remBtnOn: { backgroundColor: C.accent },
  remBtnText: { fontFamily: F.bold, fontSize: 12.5, color: C.muted },

  ram: { marginHorizontal: 8, marginTop: 8, paddingVertical: 12, paddingHorizontal: 14, gap: 10, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  ramHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ramTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  ramCount: { flex: 1, textAlign: 'right', fontFamily: F.semi, fontSize: 12.5, color: C.muted },
  ramBells: { flexDirection: 'row', gap: 8 },
  ramBtn: { flex: 1, justifyContent: 'center' },
  slBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,14,20,0.45)' },
  slDismiss: { flex: 1 },
  slSheet: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 28, gap: 14, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: C.card },
  slHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slTitle: { flex: 1, fontFamily: F.display, fontSize: 21, lineHeight: 25, color: C.ink, letterSpacing: -0.3 },
  slClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.tile },
  slChips: { flexDirection: 'row', gap: 8 },
  slChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: C.tile },
  slChipOn: { backgroundColor: C.ink },
  slChipText: { fontFamily: F.bold, fontSize: 13, color: C.ink },
  slChipTextOn: { color: C.card },
  slCustom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slInput: { width: 84, height: 44, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.tile, fontFamily: F.bold, fontSize: 18, color: C.ink, textAlign: 'center' },
  slInputHint: { flex: 1, fontFamily: F.semi, fontSize: 12.5, color: C.muted },
  slActions: { flexDirection: 'row', gap: 10 },
  slBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  slBtnGhost: { backgroundColor: C.tile },
  slBtnGhostText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  slBtnMain: { backgroundColor: C.ink },
  slBtnMainText: { fontFamily: F.bold, fontSize: 15, color: C.card },
  sf: { marginHorizontal: 8, marginTop: 8, borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  sfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14 },
  sfRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  sfSide: { flex: 1, gap: 3 },
  sfLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sfLabel: { fontFamily: F.semi, fontSize: 12, color: C.muted },
  sfTime: { fontFamily: F.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.5, color: C.ink },
  sfMid: { alignItems: 'center', gap: 2, minWidth: 84 },
  sfMidText: { fontFamily: F.bold, fontSize: 11.5, color: C.muted },

  acc: { marginHorizontal: 8, marginVertical: 8, borderRadius: 22, backgroundColor: C.tile, overflow: 'hidden' },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, paddingLeft: 16, paddingRight: 10 },
  accTitle: { fontFamily: F.bold, fontSize: 14.5, color: C.ink },
  accSub: { fontFamily: F.medium, fontSize: 12, color: C.muted, marginTop: 1 },
  chev: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F1F2E',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dl: { marginHorizontal: 8, marginBottom: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.card },
  it: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  itDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  itIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentSoft },
  itBody: { flex: 1, minWidth: 0 },
  itNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itName: { flexShrink: 1, fontFamily: F.bold, fontSize: 13.5, color: C.ink },
  itNote: { fontFamily: F.medium, fontSize: 11.5, color: C.muted, marginTop: 1 },
  itTime: { fontFamily: F.bold, fontSize: 13, color: C.ink, fontVariant: ['tabular-nums'] },
  itBell: { width: 28, height: 28, borderRadius: 14, marginLeft: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.tile },
  itBellOn: { backgroundColor: C.accent },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.tile },
  noticeText: { flex: 1, fontFamily: F.semi, fontSize: 12.5, color: C.ink },
  avoidTag: { overflow: 'hidden', fontFamily: F.heavy, fontSize: 9, letterSpacing: 0.5, color: C.warmInk, backgroundColor: C.amberSoft, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999 },
  nowChip: { overflow: 'hidden', fontFamily: F.heavy, fontSize: 9.5, color: C.onAccent, backgroundColor: C.accent, paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 999 },
}})
