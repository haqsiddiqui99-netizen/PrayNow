import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MosqueAdminTimingsTable } from '@/src/components/MosqueAdminTimingsTable'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { fetchLiveAzanSessions, fetchManagerMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { isMosqueLive, refreshLiveSessions, subscribeLiveSessions } from '@/src/store/liveAzanSessions'

type Props = {
  /** Show for mosque managers / app admins only (parent gates this). */
  visible: boolean
}

/**
 * Home dashboard for mosque admins: Live Azan + full prayer timings table with edit.
 */
export function HomeMosqueAdminPanel({ visible }: Props) {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { placeName } = useLanguage()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [mosqueCount, setMosqueCount] = useState(0)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!visible) return
    setError('')
    try {
      const [list, sessions] = await Promise.all([fetchManagerMosques(), fetchLiveAzanSessions()])
      const mosques = Array.isArray(list) ? list.filter(Boolean) : []
      setMosqueCount(mosques.length)
      const first = mosques[0] ?? null
      setMosque(first)
      await refreshLiveSessions()
      if (first) {
        setLive(isMosqueLive(String(first.id)) || sessions.some((s) => String(s.mosqueId) === String(first.id)))
      } else {
        setLive(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your mosque')
      setMosque(null)
    } finally {
      setLoading(false)
    }
  }, [visible])

  useFocusEffect(
    useCallback(() => {
      if (!visible) return undefined
      setLoading(true)
      void load()
      return undefined
    }, [visible, load]),
  )

  useFocusEffect(
    useCallback(() => {
      if (!visible || !mosque?.id) return undefined
      const id = String(mosque.id)
      setLive(isMosqueLive(id))
      return subscribeLiveSessions(() => setLive(isMosqueLive(id)))
    }, [visible, mosque?.id]),
  )

  if (!visible) return null

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (error || !mosque) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Mosque Admin</Text>
        <Text style={styles.error}>{error || 'No mosque assigned yet.'}</Text>
        <Pressable style={styles.linkBtn} onPress={() => router.push('/admin/my-mosques')}>
          <Text style={styles.linkText}>Open Mosque Admin ›</Text>
        </Pressable>
      </View>
    )
  }

  const openAzan = () => {
    if (mosqueCount > 1) router.push('/admin/my-mosques')
    else router.push(`/admin/mosque/${mosque.id}`)
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, live && styles.cardLive]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Live Azan</Text>
            <Text style={styles.mosqueName} numberOfLines={1}>
              {placeName(mosque.name)}
            </Text>
            {mosqueCount > 1 ? (
              <Text style={styles.meta}>{mosqueCount} mosques · showing first · tap Go Live to pick</Text>
            ) : (
              <Text style={styles.meta}>{live ? 'Azan is LIVE now' : 'Offline · start azan when ready'}</Text>
            )}
          </View>
          <View style={[styles.dot, live && styles.dotOn]} />
        </View>

        <Pressable style={[styles.btn, styles.btnAzan, live && styles.btnAzanLive]} onPress={openAzan}>
          <Text style={styles.btnAzanText}>{live ? 'Manage Live Azan' : 'Go Live (Azan)'}</Text>
        </Pressable>
      </View>

      <MosqueAdminTimingsTable mosque={mosque} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: 12, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardLive: { borderColor: colors.success, backgroundColor: colors.successBg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mosqueName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textMuted, marginTop: 4 },
  dotOn: { backgroundColor: colors.success },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnAzan: { backgroundColor: colors.success },
  btnAzanLive: { backgroundColor: '#15803d' },
  btnAzanText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  linkBtn: { paddingVertical: 6 },
  linkText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
}))
