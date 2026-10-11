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
  getCurrentPrayerRemainingSeconds,
  getMinutesUntilTime,
  getPrayerDisplayName,
  type LivePrayerInfo,
} from '@/src/utils/prayerSchedule'

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
  const remainingSecs = current ? getCurrentPrayerRemainingSeconds(current, now) : 0
  const nextMins = getMinutesUntilTime(info.next.start, now)

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
              <Text
                style={styles.nowName}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {prayerName(current.displayName)}
              </Text>
              <TimeRange start={current.start} end={current.end} style={styles.heroRange} />
              <CountdownPill
                secondsLeft={remainingSecs}
                accessibilityLabel={t('home.endsIn', {
                  duration: formatCountdown(remainingSecs),
                })}
              />
            </>
          ) : (
            <Text style={styles.idle}>{t('home.noActive')}</Text>
          )}
        </View>

        <View style={styles.heroNext}>
          <Text style={styles.nextLabel}>{t('home.next')}</Text>
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    ...shadows.card,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 12,
  },
  hijri: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  gregorian: { flexShrink: 0, fontSize: 12, fontWeight: '500', color: colors.textSecondary },

  hero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  heroNow: {
    flex: 1.35,
    minWidth: 0,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  heroNext: {
    flex: 0.9,
    minWidth: 0,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  // Poppins_500Medium rather than the app-wide Inter set: the two prayer names
  // are the design's accent moment, so they get their own family, size, weight.
  nowName: {
    fontSize: 30,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
    marginTop: 2,
  },
  heroRange: { marginTop: 0 },
  range: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  idle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 6 },

  nextName: {
    fontSize: 20,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nextTime: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  nextIn: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },

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
    gap: 6,
    marginTop: 12,
  },
  stripCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
  },
  stripCellActive: { backgroundColor: colors.selectedBg },
  stripCellNext: { backgroundColor: colors.surface1 },
  stripName: {
    fontSize: 12,
    fontWeight: '500',
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
