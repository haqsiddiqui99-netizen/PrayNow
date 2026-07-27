import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { TimePickerField } from '@/src/components/TimePickerField'
import { colors, radius } from '@/src/constants/theme'
import { fetchManagerMosques, updateManagerMosqueTimings } from '@/src/services/api'
import type { JumaSession, Mosque, MosqueTimings, PrayerName } from '@/src/types'
import { getJumaSessions, toJumaTimingsPayload } from '@/src/utils/jumaTimings'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function EditTimingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [timings, setTimings] = useState<MosqueTimings | null>(null)
  const [jumaSessions, setJumaSessions] = useState<JumaSession[]>([
    { azan: '', khutba: '', namaz: '' },
  ])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchManagerMosques()
        const found = list.find((m) => String(m.id) === String(id)) ?? null
        setMosque(found)
        if (found) {
          setTimings(found.timings)
          setJumaSessions(
            getJumaSessions(found.jumaTimings, found.timings?.Dhuhr?.azan || ''),
          )
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const updateJuma = (index: number, field: keyof JumaSession, value: string) => {
    setJumaSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const addJumaRow = () => {
    setJumaSessions((prev) => [...prev, { azan: '', khutba: '', namaz: '' }])
  }

  const removeJumaRow = (index: number) => {
    setJumaSessions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const save = async () => {
    if (!mosque || !timings) return
    setSaving(true)
    setError('')
    setOk('')
    try {
      await updateManagerMosqueTimings(mosque.id, {
        timings,
        jumaTimings: toJumaTimingsPayload(jumaSessions),
      })
      setOk('Saved')
      setTimeout(() => router.back(), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!mosque || !timings) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Mosque not found.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} numberOfLines={1}>
        {mosque.name}
      </Text>

      <View style={styles.card}>
        <View style={styles.colHead}>
          <Text style={[styles.colLabel, styles.nameCol]}>Prayer</Text>
          <Text style={styles.colLabel}>Azan</Text>
          <Text style={styles.colLabel}>Jamat</Text>
        </View>

        {PRAYERS.map((p, index) => (
          <View key={p} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
            <Text style={[styles.prayerName, styles.nameCol]} numberOfLines={1}>
              {p}
            </Text>
            <TimePickerField
              label={`${p} Azan`}
              layout="inline"
              hideLabel
              value={timings[p].azan}
              onChange={(v) =>
                setTimings({
                  ...timings,
                  [p]: { ...timings[p], azan: v, start: v },
                })
              }
            />
            <TimePickerField
              label={`${p} Jamat`}
              layout="inline"
              hideLabel
              value={timings[p].jamat}
              onChange={(v) =>
                setTimings({
                  ...timings,
                  [p]: { ...timings[p], jamat: v },
                })
              }
            />
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Juma (Friday)</Text>
      <View style={[styles.card, styles.jumaCard]}>
        <View style={styles.colHead}>
          <Text style={[styles.colLabel, styles.nameCol]}>Sitting</Text>
          <Text style={styles.colLabel}>Azan</Text>
          <Text style={styles.colLabel}>Khutba</Text>
          <Text style={styles.colLabel}>Jamat</Text>
          <View style={styles.removeSlot} />
        </View>

        {jumaSessions.map((session, index) => (
          <View key={`juma-edit-${index}`} style={[styles.row, styles.jumaRow]}>
            <Text style={[styles.prayerName, styles.nameCol]} numberOfLines={1}>
              {jumaSessions.length > 1 ? `${index + 1}` : 'Juma'}
            </Text>
            <TimePickerField
              label="Juma Azan"
              layout="inline"
              hideLabel
              value={session.azan}
              onChange={(v) => updateJuma(index, 'azan', v)}
            />
            <TimePickerField
              label="Juma Khutba"
              layout="inline"
              hideLabel
              value={session.khutba}
              onChange={(v) => updateJuma(index, 'khutba', v)}
            />
            <TimePickerField
              label="Juma Jamat"
              layout="inline"
              hideLabel
              value={session.namaz}
              onChange={(v) => updateJuma(index, 'namaz', v)}
            />
            {jumaSessions.length > 1 ? (
              <Pressable style={styles.removeBtn} onPress={() => removeJumaRow(index)} hitSlop={6}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            ) : (
              <View style={styles.removeSlot} />
            )}
          </View>
        ))}

        <Pressable style={styles.addJuma} onPress={addJumaRow}>
          <Text style={styles.addJumaText}>+ Add Juma sitting</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}

      <Pressable style={styles.save} disabled={saving} onPress={() => void save()}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save timings'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 12, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: colors.textPrimary },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jumaCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  colLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  nameCol: { flex: 0.85, textAlign: 'left' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  rowAlt: { backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 8 },
  jumaRow: { backgroundColor: 'transparent' },
  prayerName: {
    flex: 0.85,
    fontWeight: '800',
    color: colors.primary,
    fontSize: 13,
  },
  removeSlot: { width: 22 },
  removeBtn: {
    width: 22,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.accent, fontWeight: '800', fontSize: 18, lineHeight: 20 },
  addJuma: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  addJumaText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  save: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800' },
  error: { color: colors.accent, fontWeight: '600', marginTop: 8 },
  ok: { color: colors.success, fontWeight: '700', marginTop: 8 },
})
