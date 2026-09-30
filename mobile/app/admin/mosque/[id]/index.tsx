import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MosqueAdminTimingsTable } from '@/src/components/MosqueAdminTimingsTable'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useAzanBroadcast } from '@/src/hooks/useAzanBroadcast'
import { fetchManagerMosques, postMosqueAnnouncement } from '@/src/services/api'
import { subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { Mosque, PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function MosqueHubScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const broadcast = useAzanBroadcast(id ? String(id) : undefined)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceBusy, setAnnounceBusy] = useState(false)
  const [announceOk, setAnnounceOk] = useState('')

  const load = useCallback(async () => {
    broadcast.setError('')
    try {
      const list = await fetchManagerMosques()
      const found = list.find((m) => String(m.id) === String(id)) ?? null
      setMosque(found)
      await broadcast.syncLive()
    } catch (e) {
      broadcast.setError(e instanceof Error ? e.message : 'Failed to load mosque')
    } finally {
      setLoading(false)
    }
  }, [broadcast.setError, broadcast.syncLive, id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      void load()
      return subscribeLiveSessions(() => void broadcast.syncLive())
    }, [broadcast.syncLive, load]),
  )

  const onAnnounce = async () => {
    if (!mosque) return
    const title = announceTitle.trim()
    if (!title) {
      broadcast.setError('Announcement title is required')
      return
    }
    setAnnounceBusy(true)
    broadcast.setError('')
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
      broadcast.setError(e instanceof Error ? e.message : 'Could not post announcement')
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
        <Text style={styles.error}>{broadcast.error || 'Mosque not found or not assigned to you.'}</Text>
      </View>
    )
  }

  const mm = String(Math.floor(broadcast.elapsed / 60)).padStart(2, '0')
  const ss = String(broadcast.elapsed % 60).padStart(2, '0')

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{mosque.name}</Text>
      <Text style={styles.sub}>{mosque.area}</Text>
      {mosque.address ? <Text style={styles.address}>{mosque.address}</Text> : null}

      <Text style={styles.sectionLabel}>Live Azan</Text>
      <View style={[styles.card, broadcast.live && styles.cardLive]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, broadcast.live && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{broadcast.live ? 'ON AIR' : 'Offline'}</Text>
            <Text style={styles.statusMeta}>
              {broadcast.live ? `Broadcasting · ${mm}:${ss}` : 'Start when azan begins at the mosque'}
            </Text>
          </View>
        </View>

        {!broadcast.live ? (
          <>
            <Text style={styles.chipLabel}>Prayer (optional)</Text>
            <View style={styles.prayerRow}>
              {PRAYERS.map((p) => {
                const on = broadcast.prayer === p
                return (
                  <Pressable
                    key={p}
                    style={[styles.prayerChip, on && styles.prayerChipOn]}
                    onPress={() => broadcast.setPrayer(on ? undefined : p)}>
                    <Text style={[styles.prayerChipText, on && styles.prayerChipTextOn]}>{p}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable
              style={[styles.btn, styles.btnStart]}
              disabled={broadcast.busy}
              onPress={() => void broadcast.onStart()}>
              <Text style={styles.btnText}>{broadcast.busy ? 'Starting…' : 'Go Live (Start Azan)'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.btn, styles.btnStop]}
            disabled={broadcast.busy}
            onPress={() => void broadcast.onStop()}>
            <Text style={styles.btnText}>{broadcast.busy ? 'Stopping…' : 'Stop Azan'}</Text>
          </Pressable>
        )}

        {broadcast.hint ? <Text style={styles.hint}>{broadcast.hint}</Text> : null}
        {broadcast.error ? <Text style={styles.errorInline}>{broadcast.error}</Text> : null}
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

const useStyles = makeStyles(({ colors }) => ({
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
  cardLive: { borderColor: colors.success, backgroundColor: colors.successBg },
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
}))
