import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { TimePickerField } from '@/src/components/TimePickerField'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { refreshJanaza, useJanaza } from '@/src/hooks/useJanaza'
import { useEventWhen } from '@/src/hooks/useMosqueEvents'
import { deleteJanaza, postJanaza } from '@/src/services/api'
import type { Mosque, PrayerName } from '@/src/types'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
/** A janaza "after Asr" counts as this many minutes after the jamaat starts. */
const AFTER_JAMAAT_MIN = 10

function minutesOf(clock: string): number | null {
  const match = clock.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + Number(match[2])
}

function atMinutes(minutes: number, dayOffset: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

/** Lets a mosque admin announce a janaza; followers get a notification straight away. */
export function MosqueJanazaManager({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t, prayerName, digits } = useLanguage()
  const when = useEventWhen()
  const active = useJanaza(mosque.id)
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'

  const [name, setName] = useState('')
  const [after, setAfter] = useState<PrayerName | null>('Asr')
  const [time, setTime] = useState('4:30 PM')
  const [dayOffset, setDayOffset] = useState(0)
  const [burial, setBurial] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const prayerAt = (): Date | null => {
    if (after) {
      const jamat = minutesOf(mosque.timings?.[after]?.jamat || '')
      return jamat === null ? null : atMinutes(jamat + AFTER_JAMAAT_MIN, dayOffset)
    }
    const minutes = minutesOf(time)
    return minutes === null ? null : atMinutes(minutes, dayOffset)
  }

  const post = async () => {
    const at = prayerAt()
    if (!at) {
      setMessage(t('janaza.needTime'))
      return
    }
    if (at.getTime() < Date.now() - 30 * 60 * 1000) {
      setMessage(t('janaza.past'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { notified } = await postJanaza(mosque.id, {
        deceasedName: name.trim(),
        afterPrayer: after,
        prayerAt: at.toISOString(),
        burial: burial.trim(),
        note: note.trim(),
      })
      setName('')
      setBurial('')
      setNote('')
      setMessage(t('janaza.posted', { count: digits(notified) }))
      await refreshJanaza(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('janaza.postFail'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setMessage('')
    try {
      await deleteJanaza(mosque.id, id)
      await refreshJanaza(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('janaza.postFail'))
    }
  }

  return (
    <View>
      <Text style={styles.title}>{t('janaza.manageTitle')}</Text>
      <Text style={styles.sub}>{t('janaza.manageSub')}</Text>

      {active.map((j) => (
        <View key={j.id} style={styles.item}>
          <View style={styles.icon}>
            <Ionicons name="flower-outline" size={15} color={ink} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={1}>
              {j.deceasedName || t('janaza.title')}
            </Text>
            <Text style={styles.when} numberOfLines={1}>
              {j.afterPrayer
                ? t('janaza.afterAt', { prayer: prayerName(j.afterPrayer), when: when(new Date(j.prayerAt)) })
                : when(new Date(j.prayerAt))}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => void remove(j.id)}
            accessibilityRole="button"
            accessibilityLabel={t('janaza.remove')}>
            <Ionicons name="trash-outline" size={17} color="#C2321F" />
          </Pressable>
        </View>
      ))}

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('janaza.namePh')}
        placeholderTextColor={muted}
        maxLength={160}
      />

      <Text style={styles.label}>{t('janaza.day')}</Text>
      <View style={styles.chips}>
        {[0, 1].map((offset) => (
          <Pressable
            key={offset}
            onPress={() => setDayOffset(offset)}
            accessibilityRole="radio"
            accessibilityState={{ selected: dayOffset === offset }}
            style={[styles.chip, dayOffset === offset && styles.chipOn]}>
            <Text style={[styles.chipText, dayOffset === offset && styles.chipTextOn]}>
              {offset === 0 ? t('cal.today') : t('cal.tomorrow')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t('janaza.when')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PRAYERS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setAfter(p)}
            accessibilityRole="radio"
            accessibilityState={{ selected: after === p }}
            style={[styles.chip, after === p && styles.chipOn]}>
            <Text style={[styles.chipText, after === p && styles.chipTextOn]}>
              {t('janaza.afterChip', { prayer: prayerName(p) })}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setAfter(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: after === null }}
          style={[styles.chip, after === null && styles.chipOn]}>
          <Text style={[styles.chipText, after === null && styles.chipTextOn]}>{t('janaza.exactTime')}</Text>
        </Pressable>
      </ScrollView>
      {after === null ? (
        <View style={styles.timeField}>
          <TimePickerField label={t('mevent.time')} value={time} onChange={setTime} layout="inline" />
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={burial}
        onChangeText={setBurial}
        placeholder={t('janaza.burialPh')}
        placeholderTextColor={muted}
        maxLength={255}
      />
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={note}
        onChangeText={setNote}
        placeholder={t('janaza.notePh')}
        placeholderTextColor={muted}
        multiline
        maxLength={1000}
      />

      <Pressable style={[styles.addBtn, busy && styles.dim]} disabled={busy} onPress={() => void post()}>
        {busy ? (
          <ActivityIndicator color={dark ? '#0F1F2E' : '#FFFFFF'} />
        ) : (
          <>
            <Ionicons name="paper-plane" size={16} color={dark ? '#0F1F2E' : '#FFFFFF'} />
            <Text style={styles.addText}>{t('janaza.post')}</Text>
          </>
        )}
      </Pressable>
      {message ? <Text style={styles.note}>{message}</Text> : null}
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
    sub: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2, marginBottom: 6 },
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
    inputMulti: { minHeight: 60, textAlignVertical: 'top' },
    label: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: muted, marginTop: 14, marginBottom: 8 },
    chips: { flexDirection: 'row', gap: 8 },
    chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: ink },
    chipText: { fontFamily: F.semi, fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    timeField: { marginTop: 10 },
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
