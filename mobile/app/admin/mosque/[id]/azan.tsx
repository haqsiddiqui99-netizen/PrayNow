import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, radius } from '@/src/constants/theme'
import { fetchManagerMosques, startMosqueAzan, stopMosqueAzan } from '@/src/services/api'
import { isMosqueLive, refreshLiveSessions, subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { Mosque, PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function AzanDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [prayer, setPrayer] = useState<PrayerName | undefined>(undefined)

  const load = useCallback(async () => {
    setError('')
    try {
      const list = await fetchManagerMosques()
      const found = list.find((m) => String(m.id) === String(id)) ?? null
      setMosque(found)
      await refreshLiveSessions()
      setLive(isMosqueLive(String(id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
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
        setHint(
          'Azan is marked LIVE for all app users. Mic streaming needs AGORA_APP_ID + a native build later — LIVE status works now.',
        )
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
      setHint('Azan stopped. Mosque shows Offline again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop azan')
    } finally {
      setBusy(false)
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
        <Text style={styles.error}>Mosque not found or not assigned to you.</Text>
      </View>
    )
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Azan Dashboard</Text>
      <Text style={styles.title}>{mosque.name}</Text>
      <Text style={styles.sub}>{mosque.area}</Text>

      <View style={[styles.statusCard, live && styles.statusLive]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, live && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{live ? 'ON AIR' : 'Offline'}</Text>
            <Text style={styles.statusMeta}>
              {live ? `Broadcasting · ${mm}:${ss}` : 'Not broadcasting — start when azan begins'}
            </Text>
          </View>
        </View>
      </View>

      {!live ? (
        <>
          <Text style={styles.label}>Prayer (optional)</Text>
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
            <Text style={styles.btnText}>{busy ? 'Starting…' : 'Start Azan (go LIVE)'}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={[styles.btn, styles.btnStop]} disabled={busy} onPress={() => void onStop()}>
          <Text style={styles.btnText}>{busy ? 'Stopping…' : 'Stop Azan'}</Text>
        </Pressable>
      )}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.help}>
        <Text style={styles.helpTitle}>How this works</Text>
        <Text style={styles.helpText}>
          1. When azan starts at the mosque, tap Start Azan.{'\n'}
          2. All users see a LIVE badge on this mosque.{'\n'}
          3. Tap Stop Azan when finished.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  statusCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  statusLive: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.success },
  statusTitle: { fontWeight: '800', fontSize: 16 },
  statusMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  prayerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  prayerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  prayerChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  prayerChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  prayerChipTextOn: { color: colors.primary },
  btn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnStart: { backgroundColor: colors.success },
  btnStop: { backgroundColor: colors.accent },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  hint: { marginTop: 12, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  error: { marginTop: 10, color: colors.accent, fontWeight: '600', fontSize: 13 },
  help: {
    marginTop: 20,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpTitle: { fontWeight: '800', fontSize: 13, marginBottom: 6 },
  helpText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
})
