import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GradientFill } from '@/src/components/GradientFill'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  HIJRI_MONTHS,
  HIJRI_MONTHS_AR,
  daysUntil,
  eventsOn,
  gregorianOf,
  hijriOf,
  monthWeeks,
  shiftMonth,
  upcomingEvents,
} from '@/src/utils/hijriCalendar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function pretty(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function short(date: Date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function awayLabel(days: number) {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export default function CalendarScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dark = mode === 'dark'
  const today = useMemo(() => new Date(), [])
  const todayHijri = useMemo(() => hijriOf(today), [today])
  const [cursor, setCursor] = useState({ year: todayHijri.year, month: todayHijri.month })
  const [selected, setSelected] = useState(todayHijri.day)

  const weeks = useMemo(() => monthWeeks(cursor.year, cursor.month), [cursor])
  const upcoming = useMemo(() => upcomingEvents(today, 4), [today])
  const next = upcoming[0]
  const viewingToday = cursor.year === todayHijri.year && cursor.month === todayHijri.month
  const selectedDate = gregorianOf({ year: cursor.year, month: cursor.month, day: selected })
  const selectedEvents = eventsOn(cursor.year, cursor.month, selected)

  const move = (delta: number) => {
    const nextMonth = shiftMonth(cursor.year, cursor.month, delta)
    setCursor(nextMonth)
    setSelected(nextMonth.year === todayHijri.year && nextMonth.month === todayHijri.month ? todayHijri.day : 1)
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={dark ? '#EAF3F0' : '#0F1F2E'} />
        </Pressable>
        <Text style={styles.headerTitle}>Hijri calendar</Text>
      </View>

      <View style={styles.hero}>
        <GradientFill colors={dark ? ['#1A2C38', '#102028'] : ['#F7F4EE', '#EFE8DC']} vertical />
        <Text style={styles.kicker}>Today</Text>
        <Text style={styles.heroDay}>
          {todayHijri.day} {HIJRI_MONTHS[todayHijri.month - 1]}
        </Text>
        <Text style={styles.heroArabic}>{HIJRI_MONTHS_AR[todayHijri.month - 1]}</Text>
        <Text style={styles.heroYear}>{todayHijri.year} AH</Text>
        <Text style={styles.heroGreg}>{pretty(today)}</Text>
        {next ? (
          <View style={styles.countdown}>
            <Ionicons name="moon-outline" size={14} color={dark ? '#E7D3A1' : '#7A5A1E'} />
            <Text style={styles.countdownText}>
              {next.name} · {awayLabel(daysUntil(next.date, today))}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => move(-1)} hitSlop={8} accessibilityLabel="Previous month" style={styles.step}>
            <Ionicons name="chevron-back" size={18} color={dark ? '#EAF3F0' : '#0F1F2E'} />
          </Pressable>
          <View style={styles.monthTitleWrap}>
            <Text style={styles.monthTitle}>
              {HIJRI_MONTHS[cursor.month - 1]} {cursor.year}
            </Text>
            <Text style={styles.monthArabic}>{HIJRI_MONTHS_AR[cursor.month - 1]}</Text>
          </View>
          <Pressable onPress={() => move(1)} hitSlop={8} accessibilityLabel="Next month" style={styles.step}>
            <Ionicons name="chevron-forward" size={18} color={dark ? '#EAF3F0' : '#0F1F2E'} />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekDay}>
              {day}
            </Text>
          ))}
        </View>
        {weeks.map((week, row) => (
          <View key={row} style={styles.weekRow}>
            {week.map((day, column) => {
              if (!day) return <View key={`${row}-${column}`} style={styles.cell} />
              const isToday = viewingToday && day === todayHijri.day
              const isSelected = day === selected
              const marked = eventsOn(cursor.year, cursor.month, day).length > 0
              return (
                <Pressable
                  key={`${row}-${column}`}
                  onPress={() => setSelected(day)}
                  style={[styles.cell, isSelected && styles.cellOn, isToday && styles.cellToday]}>
                  <Text style={[styles.cellText, (isSelected || isToday) && styles.cellTextOn]}>{day}</Text>
                  {marked ? <View style={[styles.dot, (isSelected || isToday) && styles.dotOn]} /> : <View style={styles.dotSpacer} />}
                </Pressable>
              )
            })}
          </View>
        ))}
        <View style={styles.selected}>
          <Text style={styles.selectedDate}>{pretty(selectedDate)}</Text>
          {selectedEvents.length ? (
            selectedEvents.map((event) => (
              <Text key={event.name + event.day} style={styles.selectedEvent}>
                {event.name} · {event.note}
              </Text>
            ))
          ) : (
            <Text style={styles.selectedQuiet}>No marked day</Text>
          )}
        </View>
      </View>

      <Text style={styles.section}>Coming up</Text>
      {upcoming.map((event) => (
        <Pressable
          key={`${event.year}-${event.month}-${event.day}-${event.name}`}
          onPress={() => {
            setCursor({ year: event.year, month: event.month })
            setSelected(event.day)
          }}
          style={styles.event}>
          <View style={styles.eventDate}>
            <Text style={styles.eventDay}>{event.day}</Text>
            <Text style={styles.eventMonth}>{HIJRI_MONTHS[event.month - 1].slice(0, 3)}</Text>
          </View>
          <View style={styles.eventCopy}>
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.eventNote}>
              {short(event.date)} · {event.note}
            </Text>
          </View>
          <Text style={styles.eventAway}>{awayLabel(daysUntil(event.date, today))}</Text>
        </Pressable>
      ))}
      <Text style={styles.footnote}>Umm al-Qura dates. A local moon sighting can move a day by one.</Text>
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
    hero: {
      marginHorizontal: 12,
      marginBottom: 12,
      padding: 18,
      borderRadius: 26,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: line,
    },
    kicker: { fontFamily: 'Figtree_700Bold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: muted },
    heroDay: { fontFamily: 'Newsreader_600SemiBold', fontSize: 34, lineHeight: 40, color: ink, marginTop: 4 },
    heroArabic: { fontSize: 18, color: ink, marginTop: 2 },
    heroYear: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: muted, marginTop: 2 },
    heroGreg: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, marginTop: 8 },
    countdown: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(231,211,161,0.14)' : '#F3E6CC',
    },
    countdownText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: dark ? '#E7D3A1' : '#7A5A1E' },
    card: { marginHorizontal: 12, padding: 14, borderRadius: 26, backgroundColor: card, borderWidth: 1, borderColor: line },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monthTitleWrap: { flex: 1, alignItems: 'center' },
    monthTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, color: ink },
    monthArabic: { fontSize: 13, color: muted, marginTop: 1 },
    step: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    weekRow: { flexDirection: 'row' },
    weekDay: { flex: 1, textAlign: 'center', fontFamily: 'Figtree_700Bold', fontSize: 11, color: muted, paddingVertical: 10 },
    cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    cellOn: { backgroundColor: chip },
    cellToday: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    cellText: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: ink },
    cellTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: '#C47A12' },
    dotOn: { backgroundColor: dark ? '#9A5B00' : '#E7D3A1' },
    dotSpacer: { width: 4, height: 4, marginTop: 2 },
    selected: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: line },
    selectedDate: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: ink },
    selectedEvent: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: '#9A5B00', marginTop: 3 },
    selectedQuiet: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, marginTop: 3 },
    section: {
      marginTop: 18,
      marginBottom: 8,
      marginHorizontal: 16,
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
    },
    event: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 12,
      marginBottom: 8,
      padding: 12,
      borderRadius: 20,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
    },
    eventDate: { width: 48, alignItems: 'center' },
    eventDay: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, color: ink },
    eventMonth: { fontFamily: 'Figtree_700Bold', fontSize: 10, letterSpacing: 0.4, color: muted, textTransform: 'uppercase' },
    eventCopy: { flex: 1, minWidth: 0 },
    eventName: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: ink },
    eventNote: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: muted, marginTop: 2 },
    eventAway: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: ink },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 8 },
  }
})
