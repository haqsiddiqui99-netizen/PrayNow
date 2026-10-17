import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  createMosqueManager,
  fetchAdminUsers,
  fetchManagerMosques,
  type AdminUserRow,
} from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { useRouter } from 'expo-router'
import { isAppAdmin } from '@/src/utils/roles'

export default function ManagersScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { user } = useAuth()
  const { t, placeName } = useLanguage()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [selectedMosqueIds, setSelectedMosqueIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([fetchAdminUsers(), fetchManagerMosques()])
      setUsers(u.filter((x) => x.role === 'mosque_manager'))
      setMosques(m)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

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

  const toggleMosque = (id: string) => {
    setSelectedMosqueIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const create = async () => {
    const digits = mobile.replace(/\D/g, '')
    if (!fullName.trim() || digits.length < 10 || password.length < 6) {
      setError(t('owner.adminsRequired'))
      return
    }
    if (!selectedMosqueIds.length) {
      setError(t('owner.assignOne'))
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createMosqueManager({
        fullName: fullName.trim(),
        mobile: digits,
        password,
        mosqueIds: selectedMosqueIds,
      })
      setFullName('')
      setMobile('')
      setPassword('')
      setSelectedMosqueIds([])
      setShowForm(false)
      setMessage(t('owner.adminCreated'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.createFail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>{t('owner.adminsLead')}</Text>

      <Pressable style={styles.add} onPress={() => setShowForm((v) => !v)}>
        <Text style={styles.addText}>{showForm ? t('admin.cancel') : t('owner.addAdmin')}</Text>
      </Pressable>

      {showForm ? (
        <View style={styles.form}>
          <Text style={styles.label}>{t('owner.fullName')}</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>{t('owner.mobileLogin')}</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder={t('owner.mobilePh')}
          />
          <Text style={styles.label}>{t('owner.password')}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
          <Text style={styles.label}>{t('owner.assignMosque')}</Text>
          {mosques.map((m) => {
            const on = selectedMosqueIds.includes(m.id)
            return (
              <Pressable key={m.id} style={styles.checkRow} onPress={() => toggleMosque(m.id)}>
                <View style={[styles.check, on && styles.checkOn]} />
                <Text style={styles.checkLabel}>{placeName(m.name)}</Text>
              </Pressable>
            )
          })}
          <Pressable style={styles.save} disabled={saving} onPress={() => void create()}>
            <Text style={styles.saveText}>{saving ? t('owner.creating') : t('owner.createAdmin')}</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {users.map((u) => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.name}>{u.full_name}</Text>
          <Text style={styles.meta}>{t('owner.mobileIs', { mobile: u.mobile || '—' })}</Text>
          <Text style={styles.meta}>
            {t('owner.mosquesIs', {
              list: u.assignments?.length
                ? u.assignments.map((a) => placeName(a.mosque_name)).join(', ')
                : t('owner.noneAssigned'),
            })}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  lead: {fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addText: {color: '#fff', fontWeight: '800' },
  form: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  label: {fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4, marginTop: 8 },
  input: {color: colors.textPrimary, borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface0,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface0,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: {color: colors.textPrimary, flex: 1, fontSize: 13, fontWeight: '600' },
  save: {
    marginTop: 12,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {color: '#fff', fontWeight: '800' },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  name: {color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  meta: {color: colors.textMuted, fontSize: 12, marginTop: 4 },
  error: {color: colors.accent, fontWeight: '600', marginBottom: 8 },
  ok: {color: colors.success, fontWeight: '700', marginBottom: 8 },
}))
