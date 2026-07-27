import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MosqueAdminTimingsTable } from '@/src/components/MosqueAdminTimingsTable'
import { colors, radius } from '@/src/constants/theme'
import {
  fetchManagerMosques,
  postMosqueAnnouncement,
  startMosqueAzan,
  stopMosqueAzan,
} from '@/src/services/api'
import { isMosqueLive, refreshLiveSessions, subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { Mosque, PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function MosqueHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [prayer, setPrayer] = useState<PrayerName | undefined>(undefined)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceBusy, setAnnounceBusy] = useState(false)
  const [announceOk, setAnnounceOk] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const list = await fetchManagerMosques()
      const found = list.find((m) => String(m.id) === String(id)) ?? null
      setMosque(found)
      await refreshLiveSessions()
      setLive(isMosqueLive(String(id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mosque')
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      void load()
      return subscribeLiveSessions(() => setLive(isMosqueLive(String(id))))
    }, [load, id]),
  )

  useEffect(() => {
    if (!live) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [live])

  const onStart = async () => {
    if (!mosque) return
    setBusy(true)
    setError('')
    setHint('')
    try {
      const result = await startMosqueAzan(mosque.id, prayer)
      await refreshLiveSessions()
      setLive(true)
      if (!result.agora?.configured) {
        setHint('Azan is LIVE for app users. Mic stream needs Agora later — LIVE badge works now.')
      } else {
        setHint('Azan is live. Keep this screen open while broadcasting.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start azan')
    } finally {
      setBusy(false)
    }
  }

  const onStop = async () => {
    if (!mosque) return
    setBusy(true)
    setError('')
    try {
      await stopMosqueAzan(mosque.id)
      await refreshLiveSessions()
      setLive(false)
      setHint('Azan stopped.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop azan')
    } finally {
      setBusy(false)
    }
  }

  const onAnnounce = async () => {
    if (!mosque) return
    const title = announceTitle.trim()
    if (!title) {
      setError('Announcement title is required')
      return
    }
    setAnnounceBusy(true)
    setError('')
    setAnnounceOk('')
    try {
      const result = await postMosqueAnnouncement(mosque.id, {
        title,
        body: announceBody.trim(),
      })
      setAnnounceOk(`Sent to ${result.notified} subscriber${result.notified === 1 ? '' : 's'}`)
      setAnnounceTitle('')
      setAnnounceBody('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post announcement')
    } finally {
      setAnnounceBusy(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!mosque) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Mosque not found or not assigned to you.'}</Text>
      </View>
    )
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{mosque.name}</Text>
      <Text style={styles.sub}>{mosque.area}</Text>
      {mosque.address ? <Text style={styles.address}>{mosque.address}</Text> : null}

      <Text style={styles.sectionLabel}>Live Azan</Text>
      <View style={[styles.card, live && styles.cardLive]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, live && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{live ? 'ON AIR' : 'Offline'}</Text>
            <Text style={styles.statusMeta}>
              {live ? `Broadcasting · ${mm}:${ss}` : 'Start when azan begins at the mosque'}
            </Text>
          </View>
        </View>

        {!live ? (
          <>
            <Text style={styles.chipLabel}>Prayer (optional)</Text>
            <View style={styles.prayerRow}>
              {PRAYERS.map((p) => {
                const on = prayer === p
                return (
                  <Pressable
                    key={p}
                    style={[styles.prayerChip, on && styles.prayerChipOn]}
                    onPress={() => setPrayer(on ? undefined : p)}>
                    <Text style={[styles.prayerChipText, on && styles.prayerChipTextOn]}>{p}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable style={[styles.btn, styles.btnStart]} disabled={busy} onPress={() => void onStart()}>
              <Text style={styles.btnText}>{busy ? 'Starting…' : 'Go Live (Start Azan)'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.btn, styles.btnStop]} disabled={busy} onPress={() => void onStop()}>
            <Text style={styles.btnText}>{busy ? 'Stopping…' : 'Stop Azan'}</Text>
          </Pressable>
        )}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {error ? <Text style={styles.errorInline}>{error}</Text> : null}
      </View>

      <MosqueAdminTimingsTable mosque={mosque} />

      <Text style={styles.sectionLabel}>Announcement</Text>
      <View style={styles.card}>
        <Text style={styles.announceHint}>
          Notify users who turned on notifications for this mosque (in-app + push).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Title (e.g. Special taraweeh tonight)"
          value={announceTitle}
          onChangeText={setAnnounceTitle}
        />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Message (optional)"
          value={announceBody}
          onChangeText={setAnnounceBody}
          multiline
        />
        <Pressable
          style={[styles.btn, styles.btnAnnounce]}
          disabled={announceBusy}
          onPress={() => void onAnnounce()}>
          <Text style={styles.btnText}>{announceBusy ? 'Sending…' : 'Post announcement'}</Text>
        </Pressable>
        {announceOk ? <Text style={styles.okInline}>{announceOk}</Text> : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 },
  address: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  cardLive: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.success },
  statusTitle: { fontWeight: '800', fontSize: 15 },
  statusMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chipLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  prayerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  prayerChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface0,
  },
  prayerChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  prayerChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  prayerChipTextOn: { color: colors.primary },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnStart: { backgroundColor: colors.success },
  btnStop: { backgroundColor: colors.accent },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { marginTop: 10, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  error: { color: colors.accent, fontWeight: '600', textAlign: 'center' },
  errorInline: { marginTop: 8, color: colors.accent, fontWeight: '600', fontSize: 12 },
  announceHint: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface0,
    marginBottom: 8,
    fontSize: 14,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  btnAnnounce: { backgroundColor: colors.primary, marginTop: 4 },
  okInline: { marginTop: 8, color: colors.success, fontWeight: '700', fontSize: 12 },
})
