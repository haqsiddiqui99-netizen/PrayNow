import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { useLanguage } from '@/src/context/LanguageContext'
import { hasActiveReminders, useMosqueNotify } from '@/src/context/MosqueNotifyContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { JamaatLead, MosqueReminderPrefs } from '@/src/services/api'
import { LEAVE_BUFFER, TARAWEEH_LEAD } from '@/src/services/mosqueReminders'
import type { Mosque, PrayerName, TravelMode } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'
import { isFriday } from '@/src/utils/prayerSchedule'
import { getTravelMinutes } from '@/src/utils/travelTime'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const LEADS: JamaatLead[] = [5, 10, 15, 30]

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

type Props = {
  mosque: Mosque
  travelMode: TravelMode
  visible: boolean
  onClose: () => void
  onFailed: () => void
}

export function MosqueReminderSheet({ mosque, travelMode, visible, onClose, onFailed }: Props) {
  const styles = useStyles()
  const { mode } = useTheme()
  const insets = useSafeAreaInsets()
  const { t, prayerName, placeName, formatClock } = useLanguage()
  const { isSubscribed, remindersFor, saveSettings } = useMosqueNotify()
  const [follow, setFollow] = useState(false)
  const [prefs, setPrefs] = useState<MosqueReminderPrefs>(() => remindersFor(mosque.id))
  const [busy, setBusy] = useState(false)
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const travel = Math.max(1, getTravelMinutes(mosque, travelMode))

  useEffect(() => {
    if (!visible) return
    const saved = remindersFor(mosque.id)
    setFollow(isSubscribed(mosque.id))
    setPrefs({ ...saved, prayers: saved.prayers.length ? saved.prayers : PRAYERS })
    // Only reset the draft when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mosque.id])

  const friday = isFriday()
  const juma = getJumaSessions(mosque.jumaTimings, mosque.timings?.Dhuhr?.azan || '')[0]
  const jamatOf = (prayer: PrayerName) =>
    prayer === 'Dhuhr' && friday && juma?.namaz ? juma.namaz : mosque.timings?.[prayer]?.jamat || ''
  const labelOf = (prayer: PrayerName) => prayerName(prayer === 'Dhuhr' && friday ? 'juma' : prayer)
  const taraweeh = mosque.taraweeh?.enabled ? mosque.taraweeh : null

  const remindersOn = prefs.jamaat || prefs.azan || prefs.leave
  const setLead = (lead: JamaatLead | 0) => {
    if (lead === 0) setPrefs((p) => ({ ...p, jamaat: false }))
    else {
      setPrefs((p) => ({ ...p, jamaat: true, lead }))
      setFollow(true)
    }
  }
  const setAzan = (on: boolean) => {
    setPrefs((p) => ({ ...p, azan: on }))
    if (on) setFollow(true)
  }
  const setLeave = (on: boolean) => {
    setPrefs((p) => ({ ...p, leave: on }))
    if (on) setFollow(true)
  }
  const setTaraweeh = (on: boolean) => {
    setPrefs((p) => ({ ...p, taraweeh: on }))
    if (on) setFollow(true)
  }
  const setFollowing = (on: boolean) => {
    setFollow(on)
    if (!on) setPrefs((p) => ({ ...p, jamaat: false, azan: false, leave: false, taraweeh: false }))
  }
  const togglePrayer = (prayer: PrayerName) =>
    setPrefs((p) => ({
      ...p,
      prayers: p.prayers.includes(prayer)
        ? p.prayers.filter((x) => x !== prayer)
        : PRAYERS.filter((x) => x === prayer || p.prayers.includes(x)),
    }))

  const onSave = async () => {
    if (busy) return
    setBusy(true)
    const name = placeName(mosque.name)
    const wasFollowing = isSubscribed(mosque.id)
    const next = { ...prefs, travel, taraweeh: Boolean(taraweeh && prefs.taraweeh) }
    try {
      const { result, scheduling } = await saveSettings(mosque.id, follow, next)
      if (result !== 'ok') {
        onFailed()
        return
      }
      onClose()
      if (hasActiveReminders(next)) {
        if (scheduling === 'denied') showToast(t('home.allowNotifications'), 'notifications-off-outline')
        else if (scheduling === 'unsupported') showToast(t('reminder.phoneOnly'), 'phone-portrait-outline')
        else showToast(t('reminder.saved', { name }), 'alarm-outline')
      } else if (follow) {
        showToast(t('reminder.updatesOnly', { name }), 'checkmark-circle')
      } else if (wasFollowing) {
        showToast(t('mosque.unsubscribed', { name }), 'notifications-off-outline')
      }
    } finally {
      setBusy(false)
    }
  }

  const track = { false: dark ? '#2B3E3B' : '#D5DBE3', true: dark ? '#EAF3F0' : '#0F1F2E' }
  const thumb = (on: boolean) => (dark && on ? '#122027' : '#FFFFFF')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Claims stray taps so the mosque card behind the portal never receives them. */}
      <View style={styles.backdrop} onStartShouldSetResponder={() => true}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel={t('mosque.cancel')} />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{t('reminder.title')}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {placeName(mosque.name)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('mosque.cancel')}>
              <Ionicons name="close" size={18} color={ink} />
            </Pressable>
          </View>

          <ScrollView bounces={false} contentContainerStyle={styles.body}>
            <View style={styles.row}>
              <Ionicons name="megaphone-outline" size={18} color={ink} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('reminder.updates')}</Text>
                <Text style={styles.rowHint}>{t('reminder.updatesHint')}</Text>
              </View>
              <Switch value={follow} onValueChange={setFollowing} trackColor={track} thumbColor={thumb(follow)} />
            </View>

            <Text style={styles.section}>{t('reminder.beforeJamaat')}</Text>
            <View style={styles.chips}>
              {([0, ...LEADS] as const).map((lead) => {
                const on = lead === 0 ? !prefs.jamaat : prefs.jamaat && prefs.lead === lead
                return (
                  <Pressable
                    key={lead}
                    onPress={() => setLead(lead)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {lead === 0 ? t('reminder.off') : t('reminder.minutes', { n: lead })}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={[styles.row, styles.rowGap]}>
              <Ionicons name="walk-outline" size={18} color={ink} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('reminder.leave')}</Text>
                <Text style={styles.rowHint}>
                  {t('reminder.leaveHint', { travel, mins: travel + LEAVE_BUFFER })}
                </Text>
              </View>
              <Switch value={prefs.leave} onValueChange={setLeave} trackColor={track} thumbColor={thumb(prefs.leave)} />
            </View>

            <View style={[styles.row, styles.rowGapSmall]}>
              <Ionicons name="volume-high-outline" size={18} color={ink} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('reminder.atAzan')}</Text>
                <Text style={styles.rowHint}>{t('reminder.atAzanHint')}</Text>
              </View>
              <Switch value={prefs.azan} onValueChange={setAzan} trackColor={track} thumbColor={thumb(prefs.azan)} />
            </View>

            {taraweeh ? (
              <View style={[styles.row, styles.rowGapSmall]}>
                <Ionicons name="moon-outline" size={18} color={ink} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{t('reminder.taraweeh')}</Text>
                  <Text style={styles.rowHint}>
                    {t('reminder.taraweehHint', { lead: TARAWEEH_LEAD, time: formatClock(taraweeh.startTime) })}
                  </Text>
                </View>
                <Switch
                  value={Boolean(prefs.taraweeh)}
                  onValueChange={setTaraweeh}
                  trackColor={track}
                  thumbColor={thumb(Boolean(prefs.taraweeh))}
                />
              </View>
            ) : null}

            <Text style={styles.section}>{t('reminder.prayers')}</Text>
            <View style={[styles.prayers, !remindersOn && styles.dim]} pointerEvents={remindersOn ? 'auto' : 'none'}>
              {PRAYERS.map((prayer) => {
                const on = prefs.prayers.includes(prayer)
                const jamat = jamatOf(prayer)
                return (
                  <Pressable
                    key={prayer}
                    onPress={() => togglePrayer(prayer)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[styles.prayer, on && styles.chipOn]}>
                    <Text style={[styles.prayerName, on && styles.chipTextOn]} numberOfLines={1}>
                      {labelOf(prayer)}
                    </Text>
                    <Text style={[styles.prayerTime, on && styles.chipTextOn]} numberOfLines={1}>
                      {jamat ? formatClock(jamat) : '\u2014'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.tip}>
              <Ionicons name="lock-closed-outline" size={14} color={muted} />
              <Text style={styles.tipText}>{t('reminder.lockHint')}</Text>
            </View>
            {Platform.OS === 'android' ? (
              <Pressable
                onPress={() => void Linking.openSettings()}
                accessibilityRole="link"
                style={styles.exact}>
                <Ionicons name="alarm-outline" size={14} color={ink} />
                <Text style={styles.exactText}>{t('reminder.exactHint')}</Text>
                <Ionicons name="chevron-forward" size={14} color={muted} />
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={onSave}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}>
            {busy ? (
              <ActivityIndicator color={dark ? '#0F1F2E' : '#FFFFFF'} />
            ) : (
              <Text style={styles.saveText}>{t('reminder.save')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const chipOn = dark ? '#EAF3F0' : '#0F1F2E'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)'
  return {
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,14,20,0.45)' },
    dismiss: { flex: 1 },
    sheet: {
      maxHeight: '88%',
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
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: chip,
    },
    rowGap: { marginTop: 14 },
    rowGapSmall: { marginTop: 8 },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: F.semi, fontSize: 14.5, color: ink },
    rowHint: { fontFamily: F.medium, fontSize: 12, color: muted, marginTop: 2 },
    section: {
      marginTop: 18,
      marginBottom: 8,
      fontFamily: F.semi,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
    },
    chips: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: chip,
    },
    chipOn: { backgroundColor: chipOn },
    chipText: { fontFamily: F.semi, fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    prayers: { flexDirection: 'row', gap: 6 },
    dim: { opacity: 0.45 },
    prayer: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 2,
      borderRadius: 14,
      backgroundColor: chip,
    },
    prayerName: { fontFamily: F.semi, fontSize: 12.5, color: ink },
    prayerTime: { fontFamily: F.medium, fontSize: 10.5, color: muted, marginTop: 2 },
    tip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: line,
    },
    tipText: { flex: 1, fontFamily: F.medium, fontSize: 12, lineHeight: 17, color: muted },
    exact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    exactText: { flex: 1, fontFamily: F.semi, fontSize: 12, lineHeight: 17, color: ink },
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
