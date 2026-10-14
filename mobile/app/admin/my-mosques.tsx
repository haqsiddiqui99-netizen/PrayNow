import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { fetchLiveAzanSessions, fetchManagerMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { isAppAdmin } from '@/src/utils/roles'

export default function MyMosquesScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t, placeName } = useLanguage()
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
      setError(e instanceof Error ? e.message : t('owner.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

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
        <Text style={styles.redirect}>{t('owner.opening')}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.lead}>
        {isAppAdmin(user) ? t('owner.allLead') : t('owner.assignedLead')}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !mosques.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : mosques.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t('owner.noLink')}</Text>
          <Pressable style={styles.relogin} onPress={() => void onReSignIn()}>
            <Text style={styles.reloginText}>{t('owner.relogin')}</Text>
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
                    {placeName(m.name)}
                  </Text>
                  <View style={[styles.chip, live ? styles.chipLive : styles.chipOff]}>
                    <Text style={[styles.chipText, live && styles.chipTextLive]}>
                      {live ? t('mosque.live').toUpperCase() : t('admin.offline')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta} numberOfLines={2}>
                  {placeName(m.area)}
                  {m.address ? ` · ${m.address}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, styles.actionAzan]}
                  onPress={() => router.push(`/admin/mosque/${m.id}/azan`)}>
                  <Text style={styles.actionText}>{t('admin.dashboard')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.actionTime]}
                  onPress={() => router.push(`/admin/mosque/${m.id}/timings`)}>
                  <Text style={styles.actionText}>{t('admin.editTimes')}</Text>
                </Pressable>
              </View>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAzan: { backgroundColor: colors.success },
  actionTime: { backgroundColor: colors.primary },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' },
}))
