import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { TimePickerField } from '@/src/components/TimePickerField'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { localeOf, useEventWhen } from '@/src/hooks/useMosqueEvents'
import { createMosqueEvent, deleteMosqueEvent } from '@/src/services/api'
import { eventsForMosque, loadMosqueEvents } from '@/src/services/mosqueEvents'
import type { MosqueEvent } from '@/src/services/api'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

const DAYS_AHEAD = 14

function minutesOf(clock: string): number | null {
  const match = clock.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + Number(match[2])
}

/** Lets a mosque manager announce classes, talks and iftars that followers can be reminded of. */
export function MosqueEventsManager({ mosqueId }: { mosqueId: string }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t, language, digits } = useLanguage()
  const when = useEventWhen()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'

  const [events, setEvents] = useState<MosqueEvent[]>([])
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [dayOffset, setDayOffset] = useState(0)
  const [time, setTime] = useState('8:00 PM')
  const [weekly, setWeekly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const refresh = useCallback(async () => {
    setEvents(await loadMosqueEvents(true))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mine = useMemo(() => eventsForMosque(events, mosqueId), [events, mosqueId])

  const days = useMemo(() => {
    const locale = localeOf(language)
    return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const label =
        offset === 0
          ? t('cal.today')
          : offset === 1
            ? t('cal.tomorrow')
            : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
      return { offset, label: digits(label) }
    })
  }, [language, t, digits])

  const add = async () => {
    const minutes = minutesOf(time)
    if (!title.trim()) {
      setNote(t('mevent.needTitle'))
      return
    }
    if (minutes === null) {
      setNote(t('mevent.needTime'))
      return
    }
    const start = new Date()
    start.setDate(start.getDate() + dayOffset)
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    if (!weekly && start.getTime() < Date.now()) {
      setNote(t('mevent.past'))
      return
    }
    setBusy(true)
    setNote('')
    try {
      const { notified } = await createMosqueEvent(mosqueId, {
        title: title.trim(),
        details: details.trim(),
        startsAt: start.toISOString(),
        weekly,
      })
      setTitle('')
      setDetails('')
      setWeekly(false)
      setNote(notified === 1 ? t('mevent.addedOne') : t('mevent.addedMany', { count: notified }))
      await refresh()
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('mevent.addFail'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (event: MosqueEvent) => {
    setNote('')
    try {
      await deleteMosqueEvent(mosqueId, event.id)
      setNote(t('mevent.removed', { title: event.title }))
      await refresh()
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('mevent.removeFail'))
    }
  }

  return (
    <View>
      <Text style={styles.title}>{t('mevent.manageTitle')}</Text>
      <Text style={styles.sub}>{t('mevent.manageSub')}</Text>

      {mine.map(({ event, next }) => (
        <View key={event.id} style={styles.item}>
          <View style={styles.icon}>
            <Ionicons name={event.weekly ? 'repeat' : 'calendar-outline'} size={15} color={ink} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.when} numberOfLines={1}>
              {when(next)}
              {event.weekly ? ` · ${t('mevent.weekly')}` : ''}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => void remove(event)}
            accessibilityRole="button"
            accessibilityLabel={t('mevent.removeA11y', { title: event.title })}>
            <Ionicons name="trash-outline" size={17} color="#C2321F" />
          </Pressable>
        </View>
      ))}

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('mevent.titlePh')}
        placeholderTextColor={muted}
        maxLength={160}
      />
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={details}
        onChangeText={setDetails}
        placeholder={t('mevent.detailsPh')}
        placeholderTextColor={muted}
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>{t('mevent.day')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {days.map((day) => (
          <Pressable
            key={day.offset}
            onPress={() => setDayOffset(day.offset)}
            accessibilityRole="radio"
            accessibilityState={{ selected: dayOffset === day.offset }}
            style={[styles.chip, dayOffset === day.offset && styles.chipOn]}>
            <Text style={[styles.chipText, dayOffset === day.offset && styles.chipTextOn]}>{day.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <TimePickerField label={t('mevent.time')} value={time} onChange={setTime} layout="inline" />
        </View>
        <View style={styles.repeat}>
          {[false, true].map((value) => (
            <Pressable
              key={String(value)}
              onPress={() => setWeekly(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: weekly === value }}
              style={[styles.chip, weekly === value && styles.chipOn]}>
              <Text style={[styles.chipText, weekly === value && styles.chipTextOn]}>
                {value ? t('mevent.weekly') : t('mevent.once')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={[styles.addBtn, busy && styles.dim]} disabled={busy} onPress={() => void add()}>
        {busy ? (
          <ActivityIndicator color={dark ? '#0F1F2E' : '#FFFFFF'} />
        ) : (
          <>
            <Ionicons name="add" size={17} color={dark ? '#0F1F2E' : '#FFFFFF'} />
            <Text style={styles.addText}>{t('mevent.add')}</Text>
          </>
        )}
      </Pressable>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)'
  return {
    title: { fontFamily: F.display, fontSize: 21, lineHeight: 25, color: ink, letterSpacing: -0.3 },
    sub: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2, marginBottom: 10 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
    icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    copy: { flex: 1, minWidth: 0 },
    name: { fontFamily: F.bold, fontSize: 14, color: ink },
    when: { fontFamily: F.semi, fontSize: 12, color: muted, marginTop: 1 },
    input: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: chip,
      fontFamily: F.medium,
      fontSize: 14,
      color: ink,
    },
    inputMulti: { minHeight: 70, textAlignVertical: 'top' },
    label: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: muted, marginTop: 14, marginBottom: 8 },
    chips: { gap: 8 },
    chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: ink },
    chipText: { fontFamily: F.semi, fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14 },
    timeField: { flex: 1, minWidth: 0 },
    repeat: { flexDirection: 'row', gap: 6 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 46,
      marginTop: 16,
      borderRadius: 23,
      backgroundColor: ink,
    },
    addText: { fontFamily: F.bold, fontSize: 15, color: dark ? '#0F1F2E' : '#FFFFFF' },
    dim: { opacity: 0.6 },
    note: { fontFamily: F.semi, fontSize: 12.5, lineHeight: 17, color: ink, marginTop: 10 },
  }
})
