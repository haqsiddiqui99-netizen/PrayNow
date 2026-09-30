import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useAzanBroadcast } from '@/src/hooks/useAzanBroadcast'
import { fetchManagerMosques } from '@/src/services/api'
import { subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { Mosque, PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function AzanDashboardScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const broadcast = useAzanBroadcast(id ? String(id) : undefined)

  const load = useCallback(async () => {
    broadcast.setError('')
    try {
      const list = await fetchManagerMosques()
      const found = list.find((m) => String(m.id) === String(id)) ?? null
      setMosque(found)
      await broadcast.syncLive()
    } catch (e) {
      broadcast.setError(e instanceof Error ? e.message : 'Failed to load')
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

  const mm = String(Math.floor(broadcast.elapsed / 60)).padStart(2, '0')
  const ss = String(broadcast.elapsed % 60).padStart(2, '0')

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Azan Dashboard</Text>
      <Text style={styles.title}>{mosque.name}</Text>
      <Text style={styles.sub}>{mosque.area}</Text>

      <View style={[styles.statusCard, broadcast.live && styles.statusLive]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, broadcast.live && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{broadcast.live ? 'ON AIR' : 'Offline'}</Text>
            <Text style={styles.statusMeta}>
              {broadcast.live
                ? `Broadcasting · ${mm}:${ss}`
                : 'Not broadcasting — start when azan begins'}
            </Text>
          </View>
        </View>
      </View>

      {!broadcast.nativeAgora ? (
        <Pressable
          style={styles.devHint}
          onPress={() =>
            Alert.alert(
              'Dev build required',
              'Expo Go cannot access the Agora mic module. Build a dev APK with npm run eas:preview, or broadcast from the web admin.',
            )
          }>
          <Text style={styles.devHintText}>
            Expo Go: LIVE badge only. Dev build or web admin needed for mic audio.
          </Text>
        </Pressable>
      ) : null}

      {!broadcast.live ? (
        <>
          <Text style={styles.label}>Prayer (optional)</Text>
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
            <Text style={styles.btnText}>{broadcast.busy ? 'Starting…' : 'Start Azan (go LIVE)'}</Text>
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
      {broadcast.error ? <Text style={styles.error}>{broadcast.error}</Text> : null}

      <View style={styles.help}>
        <Text style={styles.helpTitle}>How this works</Text>
        <Text style={styles.helpText}>
          1. When azan starts at the mosque, tap Start Azan.{'\n'}
          2. Your mic streams to all app users via Agora.{'\n'}
          3. Tap Stop Azan when finished.
        </Text>
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
  statusLive: { borderColor: colors.success, backgroundColor: colors.successBg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.success },
  statusTitle: { fontWeight: '800', fontSize: 16 },
  statusMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  devHint: {
    marginBottom: 12,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  devHintText: { fontSize: 12, color: colors.warningText, lineHeight: 17 },
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
}))
