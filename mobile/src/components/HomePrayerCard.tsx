import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { CountdownPill } from '@/src/components/CountdownPill'
import { radius } from '@/src/constants/theme'
import { stripMeridiem } from '@/src/utils/clockTime'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { CityPrayerConfig } from '@/src/config/cityPrayerConfig'
import {
  getCurrentPrayerRemainingMinutes,
  getCurrentPrayerRemainingSeconds,
  getMinutesUntilTime,
  getPrayerDisplayName,
  getPrayerWindowProgress,
  type LivePrayerInfo,
} from '@/src/utils/prayerSchedule'

/** Minutes left in the current window below which the countdown turns urgent. */
const URGENT_MINUTES = 15

type Props = {
  info: LivePrayerInfo
  config: CityPrayerConfig
  hijriDate: string
  now: Date
}

function TimeRange({
  start,
  end,
  style,
}: {
  start: string
  end: string
  style?: StyleProp<TextStyle>
}) {
  const styles = useStyles()
  return (
    <Text style={[styles.range, style]} numberOfLines={1}>
      {start} – {end}
    </Text>
  )
}

/**
 * One glanceable card for the whole prayer day: what is running now, what is
 * next, every fard time in order, and the sun/nafl windows on demand.
 */
export function HomePrayerCard({ info, config, hijriDate, now }: Props) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t, prayerName, formatDuration, formatCountdown } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const current = info.current
  // Both countdowns read the same `now` so an end time that doubles as the next
  // start never shows two different spans.
  const remainingMins = current ? getCurrentPrayerRemainingMinutes(current, now) : 0
  const remainingSecs = current ? getCurrentPrayerRemainingSeconds(current, now) : 0
  const nextMins = getMinutesUntilTime(info.next.start, now)
  const progress = current ? getPrayerWindowProgress(current, now) : 0
  const urgent = current !== null && remainingMins <= URGENT_MINUTES

  const clock = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const gregorian = now.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const maghribStart = config.prayerSchedule.find((p) => p.name === 'Maghrib')?.start ?? '—'

  // Zawal and Tulu Aftab are the two windows where prayer is not offered.
  const pause = info.inZawal
    ? { label: t('prayer.zawal'), until: config.zawal.end }
    : info.inTuluAftab
      ? { label: t('timings.tuluAftab'), until: config.tuluAftab.end }
      : null

  const sunItems = [
    { key: 'sunrise', label: t('timings.sunrise'), value: config.sunrise },
    { key: 'sunset', label: t('timings.sunset'), value: maghribStart },
    { key: 'sehri', label: t('timings.sehri'), value: config.nightTimings.sehri.end },
    { key: 'iftar', label: t('timings.eftari'), value: maghribStart },
  ]

  const extraTimings = [
    {
      key: 'tahajjud',
      label: t('prayer.tahajjud'),
      start: config.nightTimings.tahajjud.start,
      end: config.nightTimings.tahajjud.end,
      noPrayer: false,
    },
    {
      key: 'ishraq',
      label: t('prayer.ishraq'),
      start: config.ishraq.start,
      end: config.ishraq.end,
      noPrayer: false,
    },
    {
      key: 'chasht',
      label: t('prayer.chasht'),
      start: config.chasht.start,
      end: config.chasht.end,
      noPrayer: false,
    },
    {
      key: 'tulu',
      label: t('timings.tuluAftab'),
      start: config.tuluAftab.start,
      end: config.tuluAftab.end,
      noPrayer: true,
    },
    {
      key: 'zawal',
      label: t('prayer.zawal'),
      start: config.zawal.start,
      end: config.zawal.end,
      noPrayer: true,
    },
  ]

  return (
    <View style={styles.card}>
      <View style={styles.dateRow}>
        <Text style={styles.hijri} numberOfLines={1}>
          {hijriDate}
        </Text>
        <Text style={styles.gregorian} numberOfLines={1}>
          {gregorian} · {clock}
        </Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroNow}>
          <Text style={styles.heroLabel}>{t('home.now')}</Text>
          {current ? (
            <>
              <View style={styles.nowRow}>
                <Text
                  style={styles.nowName}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}>
                  {prayerName(current.displayName)}
                </Text>
                <CountdownPill
                  progress={progress}
                  secondsLeft={remainingSecs}
                  urgent={urgent}
                  accessibilityLabel={t('home.endsIn', {
                    duration: formatCountdown(remainingSecs),
                  })}
                />
              </View>
              <TimeRange start={current.start} end={current.end} style={styles.heroRange} />
            </>
          ) : (
            <Text style={styles.idle}>{t('home.noActive')}</Text>
          )}
        </View>

        <View style={styles.heroNext}>
          <Text style={styles.heroLabel}>{t('home.next')}</Text>
          <Text style={styles.nextName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {prayerName(info.next.displayName)}
          </Text>
          <Text style={styles.nextTime} numberOfLines={1}>
            {info.next.start}
          </Text>
          <Text style={styles.nextIn} numberOfLines={1}>
            {t('home.startsIn', { duration: formatDuration(nextMins) })}
          </Text>
        </View>
      </View>

      {pause ? (
        <View style={styles.pauseRow}>
          <Ionicons name="alert-circle" size={13} color={colors.warning} />
          <Text style={styles.pauseText} numberOfLines={1}>
            {t('home.noPrayerNow', { label: pause.label, time: pause.until })}
          </Text>
        </View>
      ) : null}

      <View style={styles.strip}>
        {config.prayerSchedule.map((prayer) => {
          const active = current?.name === prayer.name
          const isNext = !active && info.next.name === prayer.name
          return (
            <View
              key={prayer.name}
              style={[styles.stripCell, active && styles.stripCellActive, isNext && styles.stripCellNext]}>
              <Text
                style={[styles.stripName, active && styles.stripNameActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {prayerName(getPrayerDisplayName(prayer.name, now))}
              </Text>
              <Text style={[styles.stripTime, active && styles.stripTimeActive]} numberOfLines={1}>
                {stripMeridiem(prayer.start)}
              </Text>
            </View>
          )
        })}
      </View>

      <View style={styles.sunRow}>
        {sunItems.map((item) => (
          <View key={item.key} style={styles.sunCell}>
            <Text style={styles.sunLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.sunValue} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.moreBtn}
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded }}>
        <Text style={styles.moreText}>
          {expanded ? t('home.hideTimings') : t('home.moreTimings')}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.extraList}>
          {extraTimings.map((item) => (
            <View key={item.key} style={styles.extraRow}>
              <Text style={styles.extraLabel} numberOfLines={1}>
                {item.label}
              </Text>
              {item.noPrayer ? (
                <Text style={styles.extraTag} numberOfLines={1}>
                  {t('home.noPrayerTag')}
                </Text>
              ) : null}
              <TimeRange start={item.start} end={item.end} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 6,
    ...shadows.card,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 10,
  },
  hijri: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.success },
  gregorian: { flexShrink: 0, fontSize: 13, fontWeight: '400', color: colors.textSecondary },

  hero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingTop: 2,
  },
  heroNow: {
    flex: 1,
    minWidth: 0,
  },
  heroNext: {
    width: '34%',
    minWidth: 0,
    paddingLeft: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  // Poppins_500Medium rather than the app-wide Inter set: the two prayer names
  // are the design's accent moment, so they get their own family, size, weight.
  nowName: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 28,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.success,
    marginTop: 2,
  },
  // Countdown sits beside the prayer name, pushed to the right so it sits near
  // the Now/Next divider; the name shrinks first on narrow screens.
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroRange: { marginTop: 6 },
  range: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  idle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 6 },

  nextName: {
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nextTime: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  nextIn: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, marginTop: 1 },

  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
  },
  pauseText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: colors.warning },

  strip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  stripCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 9,
    paddingHorizontal: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  stripCellActive: { backgroundColor: colors.selectedBg, borderColor: colors.selectedBg },
  stripCellNext: { backgroundColor: colors.surface2, borderColor: colors.primarySoft },
  stripName: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stripNameActive: { color: colors.selectedText },
  stripTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stripTimeActive: { color: colors.selectedText },

  sunRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sunCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  sunLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sunValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  moreText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  extraList: {
    paddingBottom: 6,
    gap: 4,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
  },
  extraLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  extraTag: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.warning,
  },
}))
