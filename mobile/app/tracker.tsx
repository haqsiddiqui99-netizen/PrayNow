import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  TRACKED_PRAYERS,
  countDone,
  dateKey,
  isComplete,
  loadTracker,
  streakOf,
  toggleTrackedPrayer,
  type TrackerStore,
} from '@/src/services/prayerTracker'
import type { PrayerName } from '@/src/types'

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export default function TrackerScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { config } = useCityPrayer()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const [store, setStore] = useState<TrackerStore>({})
  const today = useMemo(() => new Date(), [])
  const todayLog = store[dateKey(today)]
  const done = countDone(todayLog)
  const streak = streakOf(store, today)
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)), [today])

  useFocusEffect(
    useCallback(() => {
      void loadTracker().then(setStore)
    }, []),
  )

  const times = useMemo(() => {
    const map = new Map<PrayerName, string>()
    for (const slot of config.prayerSchedule) map.set(slot.name, slot.start)
    return map
  }, [config])

  const toggle = async (name: PrayerName) => {
    const next = await toggleTrackedPrayer(name, today)
    setStore(next)
    const on = Boolean(next[dateKey(today)]?.[name])
    showToast(on ? `${name} marked` : `${name} cleared`, on ? 'checkmark-circle' : 'information-circle-outline')
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Prayer tracker</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>
          {today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroCount}>
              {done}
              <Text style={styles.heroOf}> / 5</Text>
            </Text>
            <Text style={styles.heroSub}>{done === 5 ? 'All five offered today' : 'Offered today'}</Text>
          </View>
          <View style={styles.streak}>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>{streak === 1 ? 'day streak' : 'day streak'}</Text>
          </View>
        </View>
        <View style={styles.pips}>
          {TRACKED_PRAYERS.map((name) => (
            <View key={name} style={[styles.pip, todayLog?.[name] && styles.pipOn]} />
          ))}
        </View>
      </View>

      <View style={styles.week}>
        {week.map((day) => {
          const key = dateKey(day)
          const complete = isComplete(store[key])
          const partial = countDone(store[key]) > 0 && !complete
          const isToday = key === dateKey(today)
          return (
            <View key={key} style={styles.weekDay}>
              <Text style={[styles.weekLabel, isToday && styles.weekLabelOn]}>
                {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
              </Text>
              <View style={[styles.weekDot, complete && styles.weekDotOn, partial && styles.weekDotPartial, isToday && styles.weekDotToday]}>
                <Text style={[styles.weekNum, complete && styles.weekNumOn]}>{day.getDate()}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <View style={styles.list}>
        {TRACKED_PRAYERS.map((name, index) => {
          const on = Boolean(todayLog?.[name])
          return (
            <Pressable
              key={name}
              onPress={() => void toggle(name)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              style={[styles.row, index > 0 && styles.rowLine]}>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Ionicons name="checkmark" size={16} color={dark ? '#0F1F2E' : '#FFFFFF'} /> : null}
              </View>
              <Text style={[styles.prayer, on && styles.prayerOn]}>{name}</Text>
              <Text style={styles.time}>{times.get(name) || ''}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.footnote}>Saved on this phone. A day counts toward the streak once all five are marked.</Text>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const card = dark ? '#122027' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const chip = dark ? '#1C3330' : '#F3F1EC'
  return {
    page: { flex: 1, backgroundColor: dark ? '#0C1818' : '#F6F4F0' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: card },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: ink, letterSpacing: -0.3 },
    hero: { marginHorizontal: 12, padding: 18, borderRadius: 26, backgroundColor: card, borderWidth: 1, borderColor: line },
    kicker: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: muted },
    heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
    heroCount: { fontFamily: 'Newsreader_600SemiBold', fontSize: 48, lineHeight: 52, color: ink },
    heroOf: { fontFamily: 'Newsreader_500Medium', fontSize: 22, color: muted },
    heroSub: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, marginTop: 2 },
    streak: { alignItems: 'flex-end', paddingBottom: 6 },
    streakNum: { fontFamily: 'Newsreader_600SemiBold', fontSize: 32, lineHeight: 36, color: ink },
    streakLabel: { fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: muted },
    pips: { flexDirection: 'row', gap: 6, marginTop: 16 },
    pip: { flex: 1, height: 6, borderRadius: 3, backgroundColor: chip },
    pipOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    week: {
      flexDirection: 'row',
      marginHorizontal: 12,
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 22,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
    },
    weekDay: { flex: 1, alignItems: 'center', gap: 6 },
    weekLabel: { fontFamily: 'Figtree_700Bold', fontSize: 11, color: muted },
    weekLabelOn: { color: ink },
    weekDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    weekDotOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    weekDotPartial: { backgroundColor: chip },
    weekDotToday: { borderWidth: 1.5, borderColor: dark ? '#EAF3F0' : '#0F1F2E' },
    weekNum: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: ink },
    weekNumOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    list: { marginHorizontal: 12, marginTop: 12, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
    rowLine: { borderTopWidth: 1, borderTopColor: line },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: dark ? '#3A4E4A' : '#D5DBE3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E', borderColor: dark ? '#EAF3F0' : '#0F1F2E' },
    prayer: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 16, color: ink },
    prayerOn: { color: muted },
    time: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: muted },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 12 },
  }
})
