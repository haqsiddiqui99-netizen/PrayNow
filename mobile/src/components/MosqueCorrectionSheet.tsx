import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { TranslationKey } from '@/src/i18n/translations'
import { submitCorrection, type CorrectionTopic } from '@/src/services/api'
import type { Mosque, PrayerName } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const TOPICS: { id: CorrectionTopic; label: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'jamaat', label: 'correction.topicJamaat', icon: 'time-outline' },
  { id: 'juma', label: 'correction.topicJuma', icon: 'calendar-outline' },
  { id: 'address', label: 'correction.topicAddress', icon: 'location-outline' },
  { id: 'phone', label: 'correction.topicPhone', icon: 'call-outline' },
  { id: 'facilities', label: 'correction.topicFacilities', icon: 'grid-outline' },
  { id: 'other', label: 'correction.topicOther', icon: 'ellipsis-horizontal' },
]

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

type Props = {
  mosque: Mosque
  visible: boolean
  onClose: () => void
}

export function MosqueCorrectionSheet({ mosque, visible, onClose }: Props) {
  const styles = useStyles()
  const router = useRouter()
  const { mode } = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { t, prayerName, placeName, formatClock } = useLanguage()
  const [topic, setTopic] = useState<CorrectionTopic>('jamaat')
  const [prayer, setPrayer] = useState<PrayerName>('Fajr')
  const [suggestion, setSuggestion] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'

  useEffect(() => {
    if (!visible) return
    setTopic('jamaat')
    setPrayer('Fajr')
    setSuggestion('')
    setNote('')
  }, [visible, mosque.id])

  const juma = getJumaSessions(mosque.jumaTimings, mosque.timings?.Dhuhr?.azan || '')[0]
  const current = (() => {
    if (topic === 'jamaat') {
      const jamat = mosque.timings?.[prayer]?.jamat
      return jamat ? formatClock(jamat) : ''
    }
    if (topic === 'juma') return juma?.namaz ? formatClock(juma.namaz) : ''
    if (topic === 'address') return [mosque.address, mosque.area].filter(Boolean).join(', ')
    if (topic === 'phone') return mosque.phone || ''
    return ''
  })()
  const timeTopic = topic === 'jamaat' || topic === 'juma'

  const onSend = async () => {
    if (busy) return
    if (!suggestion.trim() && !note.trim()) {
      showToast(t('correction.needDetail'), 'information-circle-outline')
      return
    }
    setBusy(true)
    try {
      await submitCorrection(mosque.id, {
        topic,
        prayer: topic === 'jamaat' ? prayer : null,
        suggestion: suggestion.trim(),
        note: note.trim(),
      })
      onClose()
      showToast(t('correction.sent'), 'checkmark-circle')
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t('correction.failed'), 'cloud-offline-outline')
    } finally {
      setBusy(false)
    }
  }

  const signIn = () => {
    onClose()
    router.push('/login')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel={t('mosque.cancel')} />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{t('correction.title')}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {placeName(mosque.name)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('mosque.cancel')}>
              <Ionicons name="close" size={18} color={ink} />
            </Pressable>
          </View>

          {!user ? (
            <View style={styles.body}>
              <Text style={styles.hint}>{t('correction.signInHint')}</Text>
              <Pressable onPress={signIn} accessibilityRole="button" style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}>
                <Text style={styles.saveText}>{t('correction.signIn')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                <Text style={styles.section}>{t('correction.what')}</Text>
                <View style={styles.topics}>
                  {TOPICS.map((item) => {
                    const on = topic === item.id
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setTopic(item.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={[styles.topic, on && styles.chipOn]}>
                        <Ionicons name={item.icon} size={15} color={on ? (dark ? '#0F1F2E' : '#FFFFFF') : ink} />
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {t(item.label)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                {topic === 'jamaat' ? (
                  <>
                    <Text style={styles.section}>{t('correction.whichPrayer')}</Text>
                    <View style={styles.prayers}>
                      {PRAYERS.map((p) => {
                        const on = prayer === p
                        return (
                          <Pressable
                            key={p}
                            onPress={() => setPrayer(p)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            style={[styles.prayer, on && styles.chipOn]}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                              {prayerName(p)}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </>
                ) : null}

                {current ? <Text style={styles.current}>{t('correction.shownNow', { value: current })}</Text> : null}

                <Text style={styles.section}>{t('correction.right')}</Text>
                <TextInput
                  value={suggestion}
                  onChangeText={setSuggestion}
                  placeholder={timeTopic ? t('correction.timePlaceholder') : t('correction.rightPlaceholder')}
                  placeholderTextColor={muted}
                  maxLength={200}
                  style={styles.input}
                />
                <Text style={styles.section}>{t('correction.note')}</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('correction.notePlaceholder')}
                  placeholderTextColor={muted}
                  maxLength={500}
                  multiline
                  style={[styles.input, styles.noteInput]}
                />
                <View style={styles.tip}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={muted} />
                  <Text style={styles.tipText}>{t('correction.reviewHint')}</Text>
                </View>
              </ScrollView>
              <Pressable
                onPress={onSend}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}>
                {busy ? (
                  <ActivityIndicator color={dark ? '#0F1F2E' : '#FFFFFF'} />
                ) : (
                  <Text style={styles.saveText}>{t('correction.send')}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)'
  return {
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,14,20,0.45)' },
    dismiss: { flex: 1 },
    sheet: {
      maxHeight: '90%',
      paddingTop: 8,
      paddingHorizontal: 18,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: dark ? '#122027' : '#FFFFFF',
    },
    grip: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      marginBottom: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(15,31,46,0.14)',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
    headText: { flex: 1, minWidth: 0 },
    title: { fontFamily: F.display, fontSize: 22, lineHeight: 26, color: ink, letterSpacing: -0.3 },
    subtitle: { fontFamily: F.medium, fontSize: 13, color: muted, marginTop: 2 },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    body: { paddingBottom: 14 },
    hint: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 19, color: muted, marginVertical: 14 },
    section: {
      marginTop: 14,
      marginBottom: 8,
      fontFamily: F.semi,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
    },
    topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    topic: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: chip,
    },
    prayers: { flexDirection: 'row', gap: 6 },
    prayer: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14, backgroundColor: chip },
    chipOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    chipText: { fontFamily: F.semi, fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    current: { fontFamily: F.medium, fontSize: 12.5, color: muted, marginTop: 10 },
    input: {
      fontFamily: F.medium,
      fontSize: 14.5,
      color: ink,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: chip,
    },
    noteInput: { minHeight: 72, textAlignVertical: 'top' },
    tip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: line,
    },
    tipText: { flex: 1, fontFamily: F.medium, fontSize: 12, lineHeight: 17, color: muted },
    save: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderRadius: 24,
      backgroundColor: dark ? '#EAF3F0' : '#0F1F2E',
    },
    saveText: { fontFamily: F.bold, fontSize: 15, color: dark ? '#0F1F2E' : '#FFFFFF' },
  }
})
