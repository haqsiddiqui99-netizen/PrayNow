import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
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
import { fetchManagerMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { useAuth } from '@/src/context/AuthContext'
import { isAppAdmin } from '@/src/utils/roles'

export default function AdminMosquesScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setMosques(await fetchManagerMosques())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!isAppAdmin(user)) {
        router.replace('/admin')
        return
      }
      setLoading(true)
      void load()
    }, [load, user, router]),
  )

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Pressable style={styles.add} onPress={() => router.push('/admin/mosque-form')}>
        <Text style={styles.addText}>+ Add Mosque</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !mosques.length ? <ActivityIndicator color={colors.primary} /> : null}
      {mosques.map((m) => (
        <Pressable
          key={m.id}
          style={styles.card}
          onPress={() => router.push({ pathname: '/admin/mosque-form', params: { id: m.id } })}>
          <Text style={styles.name}>{m.name}</Text>
          <Text style={styles.meta}>{m.area}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addText: { color: '#fff', fontWeight: '800' },
  error: { color: colors.accent, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  name: { fontWeight: '800', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
})
