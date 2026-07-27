import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, timingTextStyle } from '@/src/constants/theme'
import type { Mosque, PrayerName } from '@/src/types'
import { getPrayerDisplayName, isMosqueAzanLive, isFriday } from '@/src/utils/prayerSchedule'
import { getAzanState, subscribeAzan, toggleAzan } from '@/src/utils/azanAudio'
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
}: {
  mosque: Mosque
  currentPrayer?: PrayerName | null
  nextPrayer: PrayerName
}) {
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
        {shortLabel(name)}
        {!isActive ? <Text style={styles.upcomingTag}>  · Upcoming</Text> : null}
      </Text>

      <View style={styles.currentRow}>
        <Text style={styles.currentRowLabel}>Azan</Text>
        <Text style={styles.currentRowTime}>{azan}</Text>
        <AzanControls id={azanId} live={azanStarted} />
      </View>

      <View style={styles.currentRow}>
        <Text style={styles.currentRowLabel}>Namaz</Text>
        <Text style={styles.currentRowTime}>{namaz}</Text>
      </View>
    </View>
  )
}

/**
 * Live indicator + speaker control shown after the Azan time.
 * The pill and speaker turn green while the azan window is live, grey otherwise.
 * Tapping the speaker while live plays / stops the azan audio.
 */
function AzanControls({ id, live }: { id: string; live: boolean }) {
  const [state, setState] = useState(getAzanState())

  useEffect(() => subscribeAzan(() => setState(getAzanState())), [])

  const isPlaying = state.id === id && state.playing
  // pause icon while playing; play icon when live & idle/paused; muted when not live.
  const iconName = isPlaying ? 'pause' : live ? 'play' : 'volume-mute'

  return (
    <View style={styles.azanControls}>
      <View style={[styles.livePill, live ? styles.livePillOn : styles.livePillOff]}>
        <View style={[styles.livePillDot, !live && styles.livePillDotOff]} />
        <Text style={[styles.livePillText, live ? styles.livePillTextOn : styles.livePillTextOff]}>
          Live
        </Text>
      </View>

      <Pressable
        disabled={!live}
        hitSlop={8}
        onPress={() => toggleAzan(id)}
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
  currentAndNext = false,
  nextPrayer,
}: {
  mosque: Mosque
  currentPrayer?: PrayerName | null
  compact?: boolean
  currentAndNext?: boolean
  nextPrayer?: PrayerName
}) {
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
    { key: 'azan', label: 'Azan', getTime: (name: PrayerName) => getAzanTime(mosque, name) },
    { key: 'jamat', label: 'Jamat', getTime: (name: PrayerName) => getJamatTime(mosque, name) },
  ] as const

  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      <View style={styles.headerRow}>
        <View style={styles.cornerCell} />
        {PRAYERS.map((name) => {
          const active = currentPrayer === name
          return (
            <View key={name} style={[styles.colHeader, active && styles.colActive]}>
              <Text style={[styles.colHeaderText, active && styles.colHeaderTextActive]}>
                {shortLabel(name)}
              </Text>
            </View>
          )
        })}
      </View>

      {rows.map((row) => (
        <View key={row.key} style={styles.dataRow}>
          <View style={styles.rowLabelCell}>
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
          {PRAYERS.map((name) => {
            const active = currentPrayer === name
            return (
              <View key={name} style={[styles.timeCell, active && styles.colActive]}>
                <Text style={styles.timeValue}>{formatTime(row.getTime(name))}</Text>
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
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeadCell, styles.tablePrayerCol]}>Prayer</Text>
        <Text style={styles.tableHeadCell}>Azan</Text>
        <Text style={styles.tableHeadCell}>Jamat</Text>
        <Text style={styles.tableHeadCell}>Ends</Text>
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
              {label}
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

const styles = StyleSheet.create({
  currentBlock: { marginTop: 4, gap: 2 },
  currentPrayerName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
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
    ...timingTextStyle,
    fontWeight: '700',
    width: 42,
  },
  currentRowTime: {
    ...timingTextStyle,
    color: colors.textPrimary,
    fontWeight: '600',
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
  grid: {
    marginTop: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(13,71,161,0.1)',
    padding: 6,
    gap: 2,
  },
  gridCompact: { padding: 5, marginTop: 10, gap: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cornerCell: {
    width: 34,
    flexShrink: 0,
  },
  colHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  colHeaderText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  colHeaderTextActive: { color: colors.primary },
  colActive: {
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rowLabelCell: {
    width: 34,
    flexShrink: 0,
    alignItems: 'flex-start',
    paddingLeft: 2,
  },
  rowLabel: {
    ...timingTextStyle,
    textTransform: 'capitalize',
  },
  timeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  timeValue: timingTextStyle,
  table: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeadCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
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
  tableRowActive: { backgroundColor: 'rgba(13,71,161,0.06)' },
  tablePrayerName: { fontWeight: '800', color: colors.textPrimary, fontSize: 14 },
  tableCell: { flex: 1, ...timingTextStyle },
  tableActiveText: { color: colors.primary },
})
