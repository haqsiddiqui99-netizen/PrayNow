import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, radius } from '@/src/constants/theme'
import { fetchLiveAzanSessions, fetchManagerMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { useAuth } from '@/src/context/AuthContext'
import { isAppAdmin } from '@/src/utils/roles'

export default function MyMosquesScreen() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [list, sessions] = await Promise.all([fetchManagerMosques(), fetchLiveAzanSessions()])
      setMosques(Array.isArray(list) ? list.filter(Boolean) : [])
      setLiveIds(new Set(sessions.map((s) => String(s.mosqueId))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      void load()
    }, [load]),
  )

  // Single-mosque admins (e.g. Khairul) go straight to Azan + Timings dashboards
  useEffect(() => {
    if (loading || isAppAdmin(user)) return
    if (mosques.length === 1) {
      router.replace(`/admin/mosque/${mosques[0].id}`)
    }
  }, [loading, mosques, user, router])

  const onReSignIn = async () => {
    await logout()
    router.replace('/login')
  }

  if (!loading && !isAppAdmin(user) && mosques.length === 1) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.redirect}>Opening mosque dashboards…</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.lead}>
        {isAppAdmin(user)
          ? 'All mosques — open one for Azan & Prayer Timings dashboards.'
          : 'Your mosques — open Azan or Timings for each mosque.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !mosques.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : mosques.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>
            No mosque linked to this session. Sign out and sign in again with your mosque-admin
            mobile + password.
          </Text>
          <Pressable style={styles.relogin} onPress={() => void onReSignIn()}>
            <Text style={styles.reloginText}>Sign out & sign in again</Text>
          </Pressable>
        </View>
      ) : (
        mosques.map((m) => {
          const live = liveIds.has(String(m.id))
          return (
            <View key={m.id} style={styles.card}>
              <Pressable onPress={() => router.push(`/admin/mosque/${m.id}`)}>
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <View style={[styles.chip, live ? styles.chipLive : styles.chipOff]}>
                    <Text style={[styles.chipText, live && styles.chipTextLive]}>
                      {live ? 'LIVE' : 'Offline'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta} numberOfLines={2}>
                  {m.area}
                  {m.address ? ` · ${m.address}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/admin/mosque/${m.id}/azan`)}>
                  <Text style={styles.actionText}>Azan Dashboard</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => router.push(`/admin/mosque/${m.id}/timings`)}>
                  <Text style={[styles.actionText, styles.actionTextSecondary]}>Prayer Timings</Text>
                </Pressable>
              </View>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.surface0 },
  redirect: { color: colors.textMuted, fontSize: 13 },
  lead: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  error: { color: colors.accent, marginBottom: 10, fontWeight: '600' },
  emptyBox: { marginTop: 28, paddingHorizontal: 12, alignItems: 'center', gap: 14 },
  empty: { textAlign: 'center', color: colors.textSecondary, lineHeight: 20 },
  relogin: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  reloginText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLive: { backgroundColor: colors.successBg, borderColor: colors.success },
  chipOff: { backgroundColor: 'rgba(148,163,184,0.15)', borderColor: colors.border },
  chipText: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.4 },
  chipTextLive: { color: colors.success },
  meta: { marginTop: 6, fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  actionTextSecondary: { color: colors.primary },
})
