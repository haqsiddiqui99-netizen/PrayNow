import { Ionicons } from '@expo/vector-icons'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GradientFill } from '@/src/components/GradientFill'
import { MosqueCorrectionsManager } from '@/src/components/MosqueCorrectionsManager'
import { MosqueEventsManager } from '@/src/components/MosqueEventsManager'
import { MosqueJanazaManager } from '@/src/components/MosqueJanazaManager'
import { MosqueNeedsManager } from '@/src/components/MosqueNeeds'
import { TabLiveButton } from '@/src/components/MosqueTabCard'
import { TimePickerField } from '@/src/components/TimePickerField'
import { VoiceNotePlayer } from '@/src/components/VoiceNotePlayer'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useAzanBroadcast } from '@/src/hooks/useAzanBroadcast'
import { useLiveSession } from '@/src/hooks/useLiveAzanSession'
import {
  fetchManagerMosques,
  postMosqueAnnouncement,
  sendAzanAlert,
  updateAssignedMosque,
  updateManagerMosqueTimings,
  updateMosqueTaraweeh,
} from '@/src/services/api'
import { recordingToBase64 } from '@/src/services/islamicChat'
import { refreshLiveSessions } from '@/src/store/liveAzanSessions'
import type { BroadcastPrayer, JumaSession, Mosque, MosqueTimings, PrayerName, TaraweehSettings } from '@/src/types'
import { renderFacilityIcon } from '@/src/utils/facilities'
import { getJumaSessions, toJumaTimingsPayload } from '@/src/utils/jumaTimings'
import { getCurrentPrayerForMosques, getLivePrayerInfo, isFriday } from '@/src/utils/prayerSchedule'
import { isMosqueAdmin } from '@/src/utils/roles'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const TARAWEH_NIGHTS = [10, 15, 20, 27, 29] as const
const TARAWEH_RAKAHS = [8, 20] as const
const MAX_VOICE_MS = 120000
const SUGGESTED_FEATURES = [
  'Wudu Area',
  'Two-wheeler parking',
  'Four-wheeler parking',
  'Washroom',
  'Women section',
  'Wheelchair access',
  'Chairs available',
  'Drinking water',
  'WiFi',
  'Library',
  'AC',
]
const DEFAULT_TARAWEH: TaraweehSettings = {
  enabled: false,
  startTime: '8:45 PM',
  nights: 27,
  rakahs: 20,
  night: 1,
}

const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
} as const

type FeatureRow = { name: string; enabled: boolean }

function featureRows(mosque: Mosque): FeatureRow[] {
  const options = mosque.featureOptions?.length ? mosque.featureOptions : mosque.facilities || []
  const enabled = new Set(mosque.facilities || [])
  const allOn = !mosque.featureOptions?.length
  return options.map((name) => ({ name, enabled: allOn || enabled.has(name) }))
}

function clockParts(value: string) {
  const match = (value || '').trim().match(/^(.*?)\s*(AM|PM)$/i)
  if (!match) return { time: value || '—', mer: '' }
  return { time: match[1], mer: match[2].toUpperCase() }
}

function prayerIcon(name: BroadcastPrayer) {
  if (name === 'Fajr') return 'cloudy-night-outline' as const
  if (name === 'Dhuhr') return 'sunny-outline' as const
  if (name === 'Asr') return 'partly-sunny-outline' as const
  if (name === 'Maghrib') return 'moon-outline' as const
  return 'moon' as const
}

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Switch({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.sw, on && styles.swOn]}>
      <View style={[styles.swKnob, on && styles.swKnobOn]} />
    </Pressable>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const dark = mode === 'dark'
  return (
    <View style={styles.panel}>
      <GradientFill colors={dark ? ['#16302C', '#102421'] : ['#FBFBFC', '#F2F3F6']} vertical />
      {children}
    </View>
  )
}

export default function MyMosqueTab() {
  const styles = useStyles()
  const { mode } = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { prayerName, placeName, t, facilityName, digits } = useLanguage()
  const muted = mode === 'dark' ? '#9DBAB4' : '#5A6676'

  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())

  const [alertOn, setAlertOn] = useState(false)
  const [alertNote, setAlertNote] = useState('')

  const [timings, setTimings] = useState<MosqueTimings | null>(null)
  const [jumaSessions, setJumaSessions] = useState<JumaSession[]>([{ azan: '', khutba: '', namaz: '' }])
  const [taraweeh, setTaraweeh] = useState<TaraweehSettings>(DEFAULT_TARAWEH)
  const [editing, setEditing] = useState(false)
  const [savingTimes, setSavingTimes] = useState(false)
  const [timesNote, setTimesNote] = useState('')

  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [featureDraft, setFeatureDraft] = useState('')
  const [featureNote, setFeatureNote] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [voiceUri, setVoiceUri] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordMs, setRecordMs] = useState(0)
  const [sending, setSending] = useState(false)
  const [messageNote, setMessageNote] = useState('')
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStarted = useRef(0)

  const broadcast = useAzanBroadcast(mosque?.id)
  const listeners = useLiveSession(mosque?.id || '')?.listeners ?? 0

  const applyMosque = useCallback((next: Mosque) => {
    setMosque(next)
    setTimings(next.timings)
    setJumaSessions(getJumaSessions(next.jumaTimings, next.timings?.Dhuhr?.azan || ''))
    setTaraweeh({ ...DEFAULT_TARAWEH, ...next.taraweeh })
    setFeatures(featureRows(next))
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const [list] = await Promise.all([fetchManagerMosques(), refreshLiveSessions()])
      const next = Array.isArray(list) ? list.filter(Boolean) : []
      if (next[0]) applyMosque(next[0])
      else setMosque(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [applyMosque])

  useFocusEffect(
    useCallback(() => {
      if (!isMosqueAdmin(user)) return undefined
      void load()
      void broadcast.syncLive()
      const timer = setInterval(() => void refreshLiveSessions(), 5000)
      return () => clearInterval(timer)
    }, [broadcast.syncLive, load, user]),
  )

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!broadcast.live) setAlertOn(false)
  }, [broadcast.live])

  useEffect(
    () => () => {
      if (recordTimer.current) clearInterval(recordTimer.current)
    },
    [],
  )

  const focus: PrayerName = getCurrentPrayerForMosques(now)?.name ?? getLivePrayerInfo(now).next.name
  const selected = focus as BroadcastPrayer

  const selectedTimes = (() => {
    if (!timings) return { azan: '—', jamat: '—' }
    if (selected === 'Taraweeh') return { azan: taraweeh.startTime, jamat: taraweeh.startTime }
    const friday = selected === 'Dhuhr' && isFriday(now)
    return {
      azan: friday && jumaSessions[0]?.azan ? jumaSessions[0].azan : timings[selected]?.azan || '—',
      jamat: friday && jumaSessions[0]?.namaz ? jumaSessions[0].namaz : timings[selected]?.jamat || '—',
    }
  })()
  const azanClock = clockParts(selectedTimes.azan)
  const jamatClock = clockParts(selectedTimes.jamat)

  const toggleAlert = async () => {
    if (!mosque) return
    if (alertOn) {
      setAlertOn(false)
      setAlertNote('')
      return
    }
    setAlertOn(true)
    setAlertNote(t('admin.alerting'))
    try {
      const result = await sendAzanAlert(mosque.id, prayerName(selected))
      setAlertNote(result.notified === 1 ? t('admin.toldOne') : t('admin.toldMany', { count: result.notified }))
    } catch (e) {
      setAlertOn(false)
      setAlertNote(e instanceof Error ? e.message : t('admin.alertFail'))
    }
  }

  const startRecording = async () => {
    setMessageNote('')
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setMessageNote(t('admin.micAllow'))
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setVoiceUri(null)
      setRecording(true)
      setRecordMs(0)
      recordStarted.current = Date.now()
      recordTimer.current = setInterval(() => {
        const elapsed = Date.now() - recordStarted.current
        setRecordMs(elapsed)
        if (elapsed >= MAX_VOICE_MS) void stopRecording()
      }, 250)
    } catch {
      setMessageNote(t('admin.micFail'))
    }
  }

  const stopRecording = async () => {
    if (recordTimer.current) {
      clearInterval(recordTimer.current)
      recordTimer.current = null
    }
    setRecording(false)
    try {
      if (recorder.isRecording || recorder.getStatus().isRecording) await recorder.stop()
      setVoiceUri(recorder.uri ?? null)
    } catch {
      setMessageNote(t('admin.recordFail'))
    } finally {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
    }
  }

  const sendMessage = async () => {
    if (!mosque) return
    if (!title.trim() && !message.trim() && !voiceUri) {
      setMessageNote(t('admin.needMessage'))
      return
    }
    setSending(true)
    setMessageNote('')
    try {
      const voice = voiceUri ? await recordingToBase64(voiceUri) : null
      const result = await postMosqueAnnouncement(mosque.id, {
        title: title.trim(),
        body: message.trim(),
        ...(voice ? { audioBase64: voice.audioBase64, mime: voice.mime } : {}),
      })
      setTitle('')
      setMessage('')
      setVoiceUri(null)
      setMessageNote(result.notified === 1 ? t('admin.sentOne') : t('admin.sentMany', { count: result.notified }))
    } catch (e) {
      setMessageNote(e instanceof Error ? e.message : t('admin.sendFail'))
    } finally {
      setSending(false)
    }
  }

  const cancelEdit = () => {
    if (mosque) applyMosque(mosque)
    setEditing(false)
    setTimesNote('')
  }

  const saveTimes = async () => {
    if (!mosque || !timings) return
    setSavingTimes(true)
    setTimesNote('')
    try {
      const nextTaraweeh = { ...taraweeh, night: Math.min(taraweeh.nights, Math.max(1, taraweeh.night)) }
      await updateMosqueTaraweeh(mosque.id, nextTaraweeh)
      const saved = await updateManagerMosqueTimings(mosque.id, {
        timings,
        jumaTimings: toJumaTimingsPayload(jumaSessions),
      })
      applyMosque({ ...saved, taraweeh: nextTaraweeh })
      setEditing(false)
      setTimesNote(t('admin.savedNote'))
    } catch (e) {
      setTimesNote(e instanceof Error ? e.message : t('admin.timesFail'))
    } finally {
      setSavingTimes(false)
    }
  }

  const saveFeatures = async (next: FeatureRow[], changeNote: string) => {
    if (!mosque) return
    const previous = features
    setFeatures(next)
    setFeatureNote('')
    try {
      const saved = await updateAssignedMosque(mosque.id, {
        facilities: next.filter((row) => row.enabled).map((row) => row.name),
        featureOptions: next.map((row) => row.name),
      })
      setMosque(saved)
      setFeatures(featureRows(saved))
      setFeatureNote(changeNote)
    } catch (e) {
      setFeatures(previous)
      setFeatureNote(e instanceof Error ? e.message : t('admin.featureFail'))
    }
  }

  const addFeature = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || features.some((row) => row.name.toLowerCase() === trimmed.toLowerCase())) return
    setFeatureDraft('')
    void saveFeatures([...features, { name: trimmed, enabled: true }], t('admin.featureAdded', { name: facilityName(trimmed) }))
  }

  if (!isMosqueAdmin(user)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('admin.notAdmin')}</Text>
      </View>
    )
  }

  const suggestions = SUGGESTED_FEATURES.filter(
    (name) => !features.some((row) => row.name.toLowerCase() === name.toLowerCase()),
  )

  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 110 }}>
      {loading && !mosque ? <ActivityIndicator color="#0F1F2E" style={{ marginTop: 40 }} /> : null}
      {!loading && !mosque ? <Text style={styles.muted}>{t('admin.noneLogin')}</Text> : null}
      {error ? <Text style={styles.warn}>{error}</Text> : null}

      {mosque && timings ? (
        <>
          <View style={styles.header}>
            <Text style={styles.kicker}>{t('admin.yours')}</Text>
            <Text style={styles.name} numberOfLines={2}>
              {placeName(mosque.name)}
            </Text>
          </View>

          {/* Azan */}
          <Panel>
            <View style={styles.pTop}>
              <View style={[styles.pIcon, broadcast.live && styles.pIconLive]}>
                <Ionicons name={prayerIcon(selected)} size={18} color={broadcast.live ? '#C2321F' : mode === 'dark' ? '#EAF3F0' : '#0F1F2E'} />
              </View>
              <View style={styles.pTitle}>
                <Text style={styles.pName} numberOfLines={1}>
                  {prayerName(selected)}
                </Text>
                <Text style={styles.pSub} numberOfLines={1}>
                  {digits(azanClock.time)}
                  {azanClock.mer ? ` ${azanClock.mer}` : ''} {t('mosque.azan')} · {digits(jamatClock.time)}
                  {jamatClock.mer ? ` ${jamatClock.mer}` : ''} {t('mosque.namaz')}
                </Text>
              </View>
              <View style={[styles.alertPill, alertOn && styles.alertPillOn]}>
                <Ionicons
                  name={alertOn ? 'notifications' : 'notifications-outline'}
                  size={14}
                  color={alertOn ? '#0F1F2E' : muted}
                />
                <Text style={[styles.alertText, alertOn && styles.alertTextOn]}>{(alertOn ? t('admin.stateOn') : t('admin.stateOff')).toUpperCase()}</Text>
                <Switch on={alertOn} onPress={() => void toggleAlert()} label={t('admin.alertSwitch')} />
              </View>
            </View>
            <Text style={styles.hint}>
              {alertNote || t('admin.alertHint')}
            </Text>

            <View style={styles.liveWrap}>
              <TabLiveButton
                isLive={broadcast.live}
                isPlaying={broadcast.live}
                listeners={listeners}
                azanTime={selectedTimes.azan}
                title={broadcast.busy ? t('admin.wait') : broadcast.live ? t('admin.live') : t('admin.startAzan', { name: prayerName(selected) })}
                icon={broadcast.live ? 'stop' : 'mic'}
                actionLabel={broadcast.live ? t('admin.stopLive') : t('admin.startAzan', { name: prayerName(selected) })}
                onPress={() => {
                  if (broadcast.busy) return
                  void (broadcast.live ? broadcast.onStop() : broadcast.onStart(selected))
                }}
              />
            </View>
            {broadcast.error ? <Text style={styles.warn}>{broadcast.error}</Text> : null}
          </Panel>

          {/* Message followers */}
          <Panel>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>{t('admin.message')}</Text>
                <Text style={styles.sectionSub}>{t('admin.messageSub')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('admin.titlePh')}
              placeholderTextColor={muted}
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={message}
              onChangeText={setMessage}
              placeholder={t('admin.noticePh')}
              placeholderTextColor={muted}
              multiline
            />

            {recording ? (
              <Pressable style={[styles.voiceRow, styles.voiceRowLive]} onPress={() => void stopRecording()}>
                <View style={styles.recDot} />
                <Text style={styles.voiceLive}>{t('admin.recording', { time: formatMs(recordMs) })}</Text>
                <Text style={styles.voiceStop}>{t('admin.tapStop')}</Text>
              </Pressable>
            ) : voiceUri ? (
              <View style={styles.voicePreview}>
                <View style={{ flex: 1 }}>
                  <VoiceNotePlayer source={voiceUri} />
                </View>
                <Pressable hitSlop={8} onPress={() => setVoiceUri(null)} accessibilityLabel={t('admin.removeVoice')}>
                  <Ionicons name="trash-outline" size={18} color="#C2321F" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.voiceRow} onPress={() => void startRecording()}>
                <View style={styles.micKnob}>
                  <Ionicons name="mic" size={16} color="#fff" />
                </View>
                <Text style={styles.voiceText}>{t('admin.voice')}</Text>
                <Text style={styles.voiceLimit}>{t('admin.voiceHint')}</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.sendBtn, (sending || recording) && styles.btnDim]}
              disabled={sending || recording}
              onPress={() => void sendMessage()}>
              <Ionicons name="paper-plane" size={16} color="#fff" />
              <Text style={styles.sendText}>{sending ? t('admin.sending') : t('admin.send')}</Text>
            </Pressable>
            {messageNote ? <Text style={styles.ok}>{messageNote}</Text> : null}
          </Panel>

          <Panel>
            <MosqueJanazaManager mosque={mosque} />
          </Panel>

          <Panel>
            <MosqueCorrectionsManager mosqueId={mosque.id} />
          </Panel>

          <Panel>
            <MosqueNeedsManager mosqueId={mosque.id} />
          </Panel>

          <Panel>
            <MosqueEventsManager mosqueId={mosque.id} />
          </Panel>

          {/* Prayer times */}
          <Panel>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>{t('admin.prayerTimes')}</Text>
                <Text style={styles.sectionSub}>
                  {editing ? t('admin.tapTime') : t('admin.todaySee')}
                </Text>
              </View>
              {editing ? (
                <View style={styles.editActions}>
                  <Pressable onPress={cancelEdit} hitSlop={6}>
                    <Text style={styles.cancelText}>{t('admin.cancel')}</Text>
                  </Pressable>
                  <Pressable style={styles.editBtn} disabled={savingTimes} onPress={() => void saveTimes()}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={styles.editBtnText}>{savingTimes ? t('admin.saving') : t('admin.save')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
                  <Ionicons name="create-outline" size={14} color="#fff" />
                  <Text style={styles.editBtnText}>{t('admin.edit')}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.rowHead}>
              <Text style={styles.rowHeadName}>{t('admin.prayer')}</Text>
              <Text style={styles.rowHeadTime}>{t('admin.azan')}</Text>
              <Text style={styles.rowHeadTime}>{t('admin.namaz')}</Text>
            </View>
            {PRAYERS.map((name) => {
              const active = name === focus
              return (
                <View key={name} style={styles.row}>
                  <Text style={[styles.rowName, active && styles.rowNow]}>{prayerName(name)}</Text>
                  {editing ? (
                    <View style={styles.editCells}>
                      <TimePickerField
                        label={`${name} azan`}
                        layout="inline"
                        hideLabel
                        value={timings[name].azan}
                        onChange={(azan) => setTimings({ ...timings, [name]: { ...timings[name], azan, start: azan } })}
                      />
                      <TimePickerField
                        label={`${name} namaz`}
                        layout="inline"
                        hideLabel
                        value={timings[name].jamat}
                        onChange={(jamat) => setTimings({ ...timings, [name]: { ...timings[name], jamat } })}
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.rowTime, active && styles.rowNow]}>{timings[name].azan || '—'}</Text>
                      <Text style={[styles.rowTime, active && styles.rowNow]}>{timings[name].jamat || '—'}</Text>
                    </>
                  )}
                </View>
              )
            })}

            <View style={styles.subHead}>
              <Text style={styles.rowHeadName}>{t('admin.friday')}</Text>
              <Text style={styles.jumaHead}>{t('admin.azan')}</Text>
              <Text style={styles.jumaHead}>{t('admin.khutba')}</Text>
              <Text style={styles.jumaHead}>{t('admin.namaz')}</Text>
            </View>
            {jumaSessions.map((session, index) => (
              <View key={`juma-${index}`} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {jumaSessions.length > 1 ? `Juma ${index + 1}` : 'Juma'}
                </Text>
                {editing ? (
                  <View style={styles.editCells}>
                    {(['azan', 'khutba', 'namaz'] as const).map((field) => (
                      <TimePickerField
                        key={field}
                        label={`Juma ${field}`}
                        layout="inline"
                        hideLabel
                        value={session[field]}
                        onChange={(value) =>
                          setJumaSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <>
                    <Text style={styles.jumaTime}>{session.azan || '—'}</Text>
                    <Text style={styles.jumaTime}>{session.khutba || '—'}</Text>
                    <Text style={styles.jumaTime}>{session.namaz || '—'}</Text>
                  </>
                )}
              </View>
            ))}
            {editing ? (
              <View style={styles.inlineActions}>
                <Pressable onPress={() => setJumaSessions((prev) => [...prev, { azan: '', khutba: '', namaz: '' }])}>
                  <Text style={styles.link}>{t('admin.addJuma')}</Text>
                </Pressable>
                {jumaSessions.length > 1 ? (
                  <Pressable onPress={() => setJumaSessions((prev) => prev.slice(0, -1))}>
                    <Text style={styles.removeText}>{t('admin.removeLast')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.subHead}>
              <Text style={styles.rowHeadName}>{t('admin.taraweeh')}</Text>
              {editing ? (
                <Switch
                  on={taraweeh.enabled}
                  onPress={() => setTaraweeh((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  label={t('admin.taraweehSwitch')}
                />
              ) : null}
            </View>
            {!editing ? (
              <View style={styles.row}>
                <Text style={styles.rowName}>
                  {taraweeh.enabled
                    ? t('admin.nightLine', { night: taraweeh.night, nights: taraweeh.nights, rakahs: taraweeh.rakahs })
                    : t('admin.notRunning')}
                </Text>
                <Text style={styles.rowTime}>{taraweeh.enabled ? taraweeh.startTime : ''}</Text>
              </View>
            ) : taraweeh.enabled ? (
              <View style={styles.taraweehEdit}>
                <View style={styles.row}>
                  <Text style={styles.rowName}>{t('admin.starts')}</Text>
                  <View style={styles.editCells}>
                    <TimePickerField
                      label={t('admin.taraweehStart')}
                      layout="inline"
                      hideLabel
                      value={taraweeh.startTime}
                      onChange={(startTime) => setTaraweeh((prev) => ({ ...prev, startTime }))}
                    />
                  </View>
                </View>
                <Text style={styles.fieldLabel}>{t('admin.nights')}</Text>
                <View style={styles.wrapRow}>
                  {TARAWEH_NIGHTS.map((nights) => (
                    <Pressable
                      key={nights}
                      style={[styles.chip, taraweeh.nights === nights && styles.chipOn]}
                      onPress={() => setTaraweeh((prev) => ({ ...prev, nights, night: Math.min(prev.night, nights) }))}>
                      <Text style={[styles.chipText, taraweeh.nights === nights && styles.chipTextOn]}>{digits(nights)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>{t('admin.rakahs')}</Text>
                <View style={styles.wrapRow}>
                  {TARAWEH_RAKAHS.map((rakahs) => (
                    <Pressable
                      key={rakahs}
                      style={[styles.chip, taraweeh.rakahs === rakahs && styles.chipOn]}
                      onPress={() => setTaraweeh((prev) => ({ ...prev, rakahs }))}>
                      <Text style={[styles.chipText, taraweeh.rakahs === rakahs && styles.chipTextOn]}>{digits(rakahs)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.rowName}>{t('admin.tonight')}</Text>
                  <Pressable
                    style={styles.step}
                    onPress={() => setTaraweeh((prev) => ({ ...prev, night: Math.max(1, prev.night - 1) }))}>
                    <Ionicons name="remove" size={16} color="#0F1F2E" />
                  </Pressable>
                  <Text style={styles.stepValue}>
                    {digits(taraweeh.night)} / {digits(taraweeh.nights)}
                  </Text>
                  <Pressable
                    style={styles.step}
                    onPress={() => setTaraweeh((prev) => ({ ...prev, night: Math.min(prev.nights, prev.night + 1) }))}>
                    <Ionicons name="add" size={16} color="#0F1F2E" />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {timesNote ? <Text style={styles.ok}>{timesNote}</Text> : null}
          </Panel>

          {/* Features */}
          <Panel>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>{t('admin.features')}</Text>
                <Text style={styles.sectionSub}>{t('admin.featuresSub')}</Text>
              </View>
            </View>
            {features.map((row) => (
              <View key={row.name} style={styles.featureRow}>
                <View style={[styles.featureIcon, !row.enabled && styles.featureIconOff]}>
                  {renderFacilityIcon(row.name, 16, row.enabled ? '#0F1F2E' : muted)}
                </View>
                <View style={styles.featureCopy}>
                  <Text style={[styles.featureName, !row.enabled && styles.featureNameOff]} numberOfLines={1}>
                    {facilityName(row.name)}
                  </Text>
                  <Text style={styles.featureState}>{row.enabled ? t('admin.available') : t('admin.unavailable')}</Text>
                </View>
                <Switch
                  on={row.enabled}
                  label={t('admin.featureSwitch', { name: facilityName(row.name) })}
                  onPress={() =>
                    void saveFeatures(
                      features.map((item) => (item.name === row.name ? { ...item, enabled: !item.enabled } : item)),
                      t('admin.featureToggled', { name: facilityName(row.name), state: row.enabled ? t('admin.stateOff') : t('admin.stateOn') }),
                    )
                  }
                />
                <Pressable
                  hitSlop={8}
                  style={styles.trash}
                  accessibilityLabel={t('admin.deleteFeature', { name: facilityName(row.name) })}
                  onPress={() =>
                    void saveFeatures(
                      features.filter((item) => item.name !== row.name),
                      t('admin.removed', { name: facilityName(row.name) }),
                    )
                  }>
                  <Ionicons name="trash-outline" size={17} color="#C2321F" />
                </Pressable>
              </View>
            ))}
            {suggestions.length ? (
              <View style={[styles.wrapRow, { marginTop: 12 }]}>
                {suggestions.map((name) => (
                  <Pressable key={name} style={styles.addChip} onPress={() => addFeature(name)}>
                    <Ionicons name="add" size={13} color="#0F1F2E" />
                    <Text style={styles.addChipText}>{facilityName(name)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.addInput]}
                value={featureDraft}
                onChangeText={setFeatureDraft}
                placeholder={t('admin.addFeature')}
                placeholderTextColor={muted}
                onSubmitEditing={() => addFeature(featureDraft)}
                returnKeyType="done"
              />
              <Pressable style={styles.addBtn} onPress={() => addFeature(featureDraft)}>
                <Ionicons name="add" size={18} color="#fff" />
              </Pressable>
            </View>
            {featureNote ? <Text style={styles.ok}>{featureNote}</Text> : null}
          </Panel>
        </>
      ) : null}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const chipInk = dark ? '#EAF3F0' : '#0F1F2E'
  const tile = dark ? '#1A3330' : '#FFFFFF'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)'
  return {
    page: { flex: 1, backgroundColor: dark ? '#122027' : '#FFFFFF' },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? '#122027' : '#FFFFFF',
      padding: 24,
    },
    header: { paddingHorizontal: 18, paddingBottom: 6 },
    kicker: { fontFamily: F.semi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: muted },
    name: { fontFamily: F.display, fontSize: 28, lineHeight: 33, color: ink, letterSpacing: -0.4, marginTop: 2 },
    panel: {
      marginHorizontal: 10,
      marginTop: 10,
      paddingTop: 14,
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: line,
      overflow: 'hidden',
    },
    pTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    pIconLive: { backgroundColor: dark ? '#3A2422' : '#FDECEA' },
    pTitle: { flex: 1, minWidth: 0 },
    pName: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: ink, letterSpacing: -0.3 },
    pSub: { fontFamily: F.medium, fontSize: 12, color: muted, marginTop: 1 },
    alertPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingLeft: 9,
      paddingRight: 4,
      borderRadius: 999,
      backgroundColor: chip,
    },
    alertPillOn: { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,31,46,0.1)' },
    alertText: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 0.6, color: muted },
    alertTextOn: { color: '#0F1F2E' },
    sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: 'rgba(91,113,112,0.35)', padding: 2 },
    swOn: { backgroundColor: '#0F1F2E' },
    swKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
    swKnobOn: { marginLeft: 14 },
    hint: { fontFamily: F.medium, fontSize: 12, lineHeight: 17, color: muted, marginTop: 10 },
    chips: { gap: 8, paddingTop: 12 },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: '#0F1F2E' },
    chipText: { fontFamily: F.semi, fontSize: 13, color: chipInk },
    chipTextOn: { color: '#FFFFFF' },
    liveWrap: { marginTop: 14 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    sectionTitleWrap: { flex: 1, minWidth: 0 },
    sectionTitle: { fontFamily: F.display, fontSize: 21, lineHeight: 25, color: ink, letterSpacing: -0.3 },
    sectionSub: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2 },
    input: {
      position: 'relative',
      marginTop: 8,
      backgroundColor: tile,
      borderWidth: 1,
      borderColor: line,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: F.medium,
      fontSize: 14,
      color: ink,
    },
    inputMulti: { minHeight: 78, textAlignVertical: 'top' },
    voiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: 14,
      borderRadius: 999,
      backgroundColor: chip,
    },
    voiceRowLive: { backgroundColor: dark ? '#3A2422' : '#FDECEA', paddingLeft: 14, paddingVertical: 12 },
    micKnob: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#0F1F2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceText: { flex: 1, fontFamily: F.semi, fontSize: 13, color: chipInk },
    voiceLimit: { fontFamily: F.medium, fontSize: 11, color: muted },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4D3D' },
    voiceLive: { flex: 1, fontFamily: F.bold, fontSize: 13, color: '#C2321F' },
    voiceStop: { fontFamily: F.semi, fontSize: 12, color: '#C2321F' },
    voicePreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: '#0F1F2E',
    },
    btnDim: { opacity: 0.6 },
    sendText: { fontFamily: F.bold, fontSize: 15, color: '#FFFFFF' },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: '#0F1F2E',
    },
    editBtnText: { fontFamily: F.bold, fontSize: 13, color: '#FFFFFF' },
    editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cancelText: { fontFamily: F.semi, fontSize: 13, color: muted },
    rowHead: { flexDirection: 'row', paddingTop: 8, paddingBottom: 2, paddingHorizontal: 4 },
    rowHeadName: {
      flex: 1,
      fontFamily: F.semi,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: muted,
    },
    rowHeadTime: {
      width: 88,
      textAlign: 'right',
      fontFamily: F.semi,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: muted,
    },
    subHead: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 12,
      paddingBottom: 2,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: line,
    },
    jumaHead: {
      width: 72,
      textAlign: 'right',
      fontFamily: F.semi,
      fontSize: 10,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: muted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
    },
    rowName: { flex: 1, fontFamily: F.semi, fontSize: 14, color: ink },
    rowTime: { width: 88, textAlign: 'right', fontFamily: F.medium, fontSize: 14, color: muted },
    rowNow: { color: '#9A5B00', fontFamily: F.bold },
    jumaTime: { width: 72, textAlign: 'right', fontFamily: F.medium, fontSize: 12, color: muted },
    editCells: { flexDirection: 'row', gap: 6, flexShrink: 1 },
    inlineActions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
    link: { fontFamily: F.bold, fontSize: 13, color: '#0F1F2E' },
    removeText: { fontFamily: F.semi, fontSize: 13, color: '#C2321F' },
    taraweehEdit: { paddingBottom: 4 },
    fieldLabel: { fontFamily: F.semi, fontSize: 12, color: muted, marginTop: 10, marginBottom: 6, paddingHorizontal: 4 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 4 },
    step: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    stepValue: { fontFamily: F.bold, fontSize: 14, color: ink, minWidth: 48, textAlign: 'center' },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
    },
    featureIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    featureIconOff: { backgroundColor: chip },
    featureCopy: { flex: 1, minWidth: 0 },
    featureName: { fontFamily: F.semi, fontSize: 14, color: ink },
    featureNameOff: { color: muted, textDecorationLine: 'line-through' },
    featureState: { fontFamily: F.medium, fontSize: 11, color: muted, marginTop: 1 },
    trash: { padding: 4 },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingLeft: 9,
      paddingRight: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: dark ? 'rgba(142,212,196,0.4)' : 'rgba(27,94,82,0.35)',
    },
    addChipText: { fontFamily: F.semi, fontSize: 12.5, color: chipInk },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    addInput: { flex: 1 },
    addBtn: {
      marginTop: 8,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F1F2E',
    },
    ok: { fontFamily: F.semi, fontSize: 12, color: '#0F1F2E', marginTop: 10, textAlign: 'center' },
    warn: { fontFamily: F.semi, fontSize: 12, color: '#C2321F', marginTop: 10, textAlign: 'center' },
    muted: { fontFamily: F.medium, color: muted, marginTop: 24, lineHeight: 20, textAlign: 'center' },
  }
})
