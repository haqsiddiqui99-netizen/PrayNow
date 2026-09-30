import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius, timingTextStyle } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useTimingGridStyles } from '@/src/constants/timingGridStyles'
import type { Mosque, PrayerName } from '@/src/types'
import { getPrayerDisplayName, isMosqueAzanLive, isFriday } from '@/src/utils/prayerSchedule'
import { getAzanState, subscribeAzan, toggleLiveAzan } from '@/src/utils/azanAudio'
import { useMosqueLive } from '@/src/hooks/useLiveAzanSession'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

/** Re-renders the caller on an interval so time-based UI stays current. */
function useNowTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

function shortLabel(name: PrayerName) {
  if (name === 'Dhuhr' && isFriday()) return 'Juma'
  if (name === 'Dhuhr') return 'Zohr'
  if (name === 'Maghrib') return 'Maghrib'
  return name
}

function formatTime(t: string) {
  return t
}

function getAzanTime(mosque: Mosque, name: PrayerName) {
  const slot = mosque.timings[name]
  const isJuma = name === 'Dhuhr' && isFriday()
  return isJuma && mosque.jumaTimings.khutba ? mosque.jumaTimings.khutba : slot.azan
}

function getJamatTime(mosque: Mosque, name: PrayerName) {
  const slot = mosque.timings[name]
  const isJuma = name === 'Dhuhr' && isFriday()
  return isJuma && mosque.jumaTimings.namaz ? mosque.jumaTimings.namaz : slot.jamat
}

export function MosqueCurrentNextTimings({
  mosque,
  currentPrayer,
  nextPrayer,
  azanOnly = false,
}: {
  mosque: Mosque
  currentPrayer?: PrayerName | null
  nextPrayer: PrayerName
  azanOnly?: boolean
}) {
  const styles = useStyles()
  const { t, prayerName } = useLanguage()
  // Re-render periodically so the "Live" state flips on automatically at azan time.
  const now = useNowTick(30000)
  // Real broadcast session (mosque admin is streaming azan right now).
  const broadcastLive = useMosqueLive(mosque.id)
  // Show only the current prayer. If no prayer is active, fall back to the upcoming one.
  const isActive = Boolean(currentPrayer)
  const name = currentPrayer ?? nextPrayer
  const azan = getAzanTime(mosque, name)
  const namaz = getJamatTime(mosque, name)
  // Live when a real broadcast is on air, or (fallback) during the azan→jamat window.
  const azanStarted = broadcastLive || (isActive && isMosqueAzanLive(mosque, name, now))
  const azanId = `${mosque.id}-${name}`

  return (
    <View style={styles.currentBlock}>
      <Text style={styles.currentPrayerName} numberOfLines={1}>
        {prayerName(shortLabel(name))}
        {!isActive ? (
          <Text style={styles.upcomingTag}>{`  · ${t('mosque.upcoming')}`}</Text>
        ) : null}
      </Text>

      <View style={styles.currentRow}>
        <Text style={styles.currentRowLabel}>{t('mosque.azan')}</Text>
        <Text style={styles.currentRowTime}>{azan}</Text>
        <AzanControls mosqueId={mosque.id} sessionKey={azanId} live={azanStarted} />
      </View>

      {!azanOnly ? (
        <View style={styles.currentRow}>
          <Text style={styles.currentRowLabel}>{t('mosque.namaz')}</Text>
          <Text style={styles.currentRowTime}>{namaz}</Text>
        </View>
      ) : null}
    </View>
  )
}

/**
 * Live indicator + speaker control shown after the Azan time.
 * The pill and speaker turn green while the azan window is live, grey otherwise.
 * Tapping the speaker while live plays / stops the azan audio.
 */
function AzanControls({
  mosqueId,
  sessionKey,
  live,
}: {
  mosqueId: string
  sessionKey: string
  live: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const [state, setState] = useState(getAzanState())

  useEffect(() => subscribeAzan(() => setState(getAzanState())), [])

  const { t } = useLanguage()
  const isPlaying = state.id === sessionKey && state.playing
  // pause icon while playing; play icon when live & idle/paused; muted when not live.
  const iconName = isPlaying ? 'pause' : live ? 'play' : 'volume-mute'

  return (
    <View style={styles.azanControls}>
      <View style={[styles.livePill, live ? styles.livePillOn : styles.livePillOff]}>
        <View style={[styles.livePillDot, !live && styles.livePillDotOff]} />
        <Text style={[styles.livePillText, live ? styles.livePillTextOn : styles.livePillTextOff]}>
          {t('mosque.live')}
        </Text>
      </View>

      <Pressable
        disabled={!live}
        hitSlop={8}
        onPress={() => {
          void toggleLiveAzan(mosqueId, sessionKey).catch((e) => {
            Alert.alert('Live azan', e instanceof Error ? e.message : 'Could not play live azan')
          })
        }}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause azan' : 'Play azan'}
        style={[styles.speakerBtn, live ? styles.speakerBtnOn : styles.speakerBtnOff]}>
        <Ionicons name={iconName} size={13} color={live ? '#ffffff' : colors.textMuted} />
      </Pressable>
    </View>
  )
}

export function MosqueTimingsGrid({
  mosque,
  currentPrayer,
  compact = false,
  dense = false,
  currentAndNext = false,
  nextPrayer,
}: {
  mosque: Mosque
  currentPrayer?: PrayerName | null
  compact?: boolean
  dense?: boolean
  currentAndNext?: boolean
  nextPrayer?: PrayerName
}) {
  const styles = useStyles()
  const gridStyles = useTimingGridStyles()
  const { t, prayerName } = useLanguage()

  if (currentAndNext && nextPrayer) {
    return (
      <MosqueCurrentNextTimings
        mosque={mosque}
        currentPrayer={currentPrayer}
        nextPrayer={nextPrayer}
      />
    )
  }
  const rows = [
    { key: 'azan', label: t('mosque.azan'), getTime: (name: PrayerName) => getAzanTime(mosque, name) },
    { key: 'jamat', label: t('mosque.jamat'), getTime: (name: PrayerName) => getJamatTime(mosque, name) },
  ] as const

  // The mosque-list card uses standalone tiles (matching the home card's prayer
  // strip) instead of the azan/jamat table used everywhere else.
  if (dense) {
    return (
      <View style={styles.tileRow}>
        {PRAYERS.map((name) => {
          const active = currentPrayer === name
          return (
            <View key={name} style={[styles.tile, active && styles.tileActive]}>
              <Text style={[styles.tileName, active && styles.tileNameActive]} numberOfLines={1}>
                {prayerName(shortLabel(name))}
              </Text>
              <Text style={[styles.tileTime, active && styles.tileTimeActive]} numberOfLines={1}>
                {formatTime(getAzanTime(mosque, name))}
              </Text>
              <Text style={[styles.tileSubTime, active && styles.tileSubTimeActive]} numberOfLines={1}>
                {formatTime(getJamatTime(mosque, name))}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <View
      style={[
        gridStyles.grid,
        compact && gridStyles.gridCompact,
        compact ? styles.gridCompactMargin : styles.gridMargin,
      ]}>
      <View style={gridStyles.headerRow}>
        <View style={gridStyles.cornerCell} />
        {PRAYERS.map((name) => {
          const active = currentPrayer === name
          return (
            <View key={name} style={[gridStyles.colHeader, active && gridStyles.colActive]}>
              <Text style={gridStyles.colHeaderText}>{prayerName(shortLabel(name))}</Text>
            </View>
          )
        })}
      </View>

      {rows.map((row) => (
        <View key={row.key} style={gridStyles.dataRow}>
          <View style={gridStyles.rowLabelCell}>
            <Text style={gridStyles.rowLabel}>{row.label}</Text>
          </View>
          {PRAYERS.map((name) => {
            const active = currentPrayer === name
            return (
              <View key={name} style={[gridStyles.timeCell, active && gridStyles.colActive]}>
                <Text style={gridStyles.timeValue}>{formatTime(row.getTime(name))}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export function MosqueTimingsTable({
  mosque,
  currentPrayer,
}: {
  mosque: Mosque
  currentPrayer?: PrayerName | null
}) {
  const styles = useStyles()
  const { t, prayerName } = useLanguage()

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeadCell, styles.tablePrayerCol]}>{t('mosque.prayer')}</Text>
        <Text style={styles.tableHeadCell}>{t('mosque.azan')}</Text>
        <Text style={styles.tableHeadCell}>{t('mosque.jamat')}</Text>
        <Text style={styles.tableHeadCell}>{t('mosque.ends')}</Text>
      </View>
      {PRAYERS.map((name) => {
        const slot = mosque.timings[name]
        const active = currentPrayer === name
        const isJuma = name === 'Dhuhr' && isFriday()
        const label = getPrayerDisplayName(name)
        const azan = isJuma && mosque.jumaTimings.khutba ? mosque.jumaTimings.khutba : slot.azan
        const jamat = isJuma && mosque.jumaTimings.namaz ? mosque.jumaTimings.namaz : slot.jamat

        return (
          <View key={name} style={[styles.tableRow, active && styles.tableRowActive]}>
            <Text style={[styles.tablePrayerCol, styles.tablePrayerName, active && styles.tableActiveText]}>
              {prayerName(label)}
            </Text>
            <Text style={styles.tableCell}>{azan}</Text>
            <Text style={styles.tableCell}>{jamat}</Text>
            <Text style={styles.tableCell}>{slot.end}</Text>
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  currentBlock: { marginTop: 4, gap: 2 },
  // Matches the mosque name header's family/weight (Poppins_500Medium).
  currentPrayerName: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.pageAccent,
  },
  upcomingTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentRowLabel: {
    ...timingTextStyle(colors),
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    width: 42,
  },
  currentRowTime: {
    ...timingTextStyle(colors),
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
  },
  azanControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  livePillOn: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  livePillOff: {
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderColor: colors.border,
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  livePillDotOff: {
    backgroundColor: colors.textMuted,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  livePillTextOn: { color: colors.success },
  livePillTextOff: { color: colors.textMuted },
  speakerBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  speakerBtnOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  speakerBtnOff: {
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderColor: colors.border,
  },
  gridMargin: { marginTop: 12 },
  gridCompactMargin: { marginTop: 10 },
  gridDenseMargin: { marginTop: 0 },

  // Prayer tiles for the mosque-list card — same shape/active treatment as the
  // home card's strip (radius.md, colors.border, dark selectedBg when active).
  tileRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  tileActive: { backgroundColor: colors.selectedBg, borderColor: colors.selectedBg },
  tileName: {
    fontSize: 10.5,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tileNameActive: { color: colors.selectedText },
  tileTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  tileTimeActive: { color: colors.selectedText },
  tileSubTime: {
    fontSize: 9.5,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  tileSubTimeActive: { color: colors.selectedText },
  table: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.pageAccentSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeadCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: colors.pageAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tablePrayerCol: { flex: 1.2 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tableRowActive: { backgroundColor: 'rgba(51,65,85,0.06)' },
  tablePrayerName: { fontWeight: '800', color: colors.textPrimary, fontSize: 14 },
  tableCell: { flex: 1, ...timingTextStyle(colors) },
  tableActiveText: { color: colors.pageAccent },
}))
