import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { CorrectionItem } from '@/src/components/MosqueCorrectionsManager'
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { fetchAdminCorrections, type MosqueCorrection } from '@/src/services/api'
import { isAppAdmin } from '@/src/utils/roles'

type Scope = 'unmanaged' | 'all'

export default function CorrectionsScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { user } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const [scope, setScope] = useState<Scope>('unmanaged')
  const [items, setItems] = useState<MosqueCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchAdminCorrections(scope))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('correction.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [scope, t])

  useEffect(() => {
    if (!isAppAdmin(user)) {
      router.replace('/admin')
      return
    }
    void load()
  }, [user, router, load])

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}>
      <Text style={styles.lead}>{t('correction.ownerLead')}</Text>
      <View style={styles.filters}>
        {(['unmanaged', 'all'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setScope(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: scope === key }}
            style={[styles.filter, scope === key && styles.filterOn]}>
            <Text style={[styles.filterText, scope === key && styles.filterTextOn]}>
              {key === 'unmanaged' ? t('correction.scopeUnmanaged') : t('correction.scopeAll')}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>{t('correction.empty')}</Text>
        ) : (
          items.map((item) => (
            <CorrectionItem
              key={item.id}
              item={item}
              showMosque
              onResolved={(done) => setItems((list) => list.filter((x) => x.id !== done.id))}
            />
          ))
        )}
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 32 },
  lead: {fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterOn: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  filterText: {fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  filterTextOn: { color: colors.surface0 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  loader: { marginVertical: 20 },
  empty: {fontSize: 13, color: colors.textMuted, paddingVertical: 16 },
}))
