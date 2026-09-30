import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
import { createAdminMosque, fetchManagerMosques, updateAdminMosque } from '@/src/services/api'
import type { Mosque, MosqueTimings, PrayerName } from '@/src/types'
import { useAuth } from '@/src/context/AuthContext'
import { isAppAdmin } from '@/src/utils/roles'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const DEFAULT_TIMINGS: MosqueTimings = {
  Fajr: { start: '4:55 AM', azan: '4:55 AM', jamat: '5:10 AM', end: '5:40 AM' },
  Dhuhr: { start: '12:15 PM', azan: '12:15 PM', jamat: '12:30 PM', end: '3:30 PM' },
  Asr: { start: '3:30 PM', azan: '3:30 PM', jamat: '3:45 PM', end: '6:45 PM' },
  Maghrib: { start: '6:45 PM', azan: '6:45 PM', jamat: '6:50 PM', end: '8:00 PM' },
  Isha: { start: '8:00 PM', azan: '8:00 PM', jamat: '8:15 PM', end: '4:55 AM' },
}

export default function MosqueFormScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const editing = Boolean(id)

  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [sect, setSect] = useState('Hanafi')
  const [lat, setLat] = useState('28.6139')
  const [lng, setLng] = useState('77.2090')
  const [capacity, setCapacity] = useState('500')
  const [timings, setTimings] = useState<MosqueTimings>(DEFAULT_TIMINGS)

  useEffect(() => {
    if (!isAppAdmin(user)) {
      router.replace('/admin')
      return
    }
    if (!id) return
    void (async () => {
      try {
        const list = await fetchManagerMosques()
        const m = list.find((x) => String(x.id) === String(id))
        if (!m) {
          setError('Mosque not found')
          return
        }
        fill(m)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user, router])

  const fill = (m: Mosque) => {
    setName(m.name)
    setAddress(m.address)
    setArea(m.area)
    setPhone(m.phone || '')
    setSect(m.sect || 'Hanafi')
    setLat(String(m.lat))
    setLng(String(m.lng))
    setCapacity(String(m.capacity || 500))
    setTimings(m.timings || DEFAULT_TIMINGS)
  }

  const save = async () => {
    if (!name.trim() || !address.trim() || !area.trim()) {
      setError('Name, address and area are required')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      name: name.trim(),
      address: address.trim(),
      area: area.trim(),
      phone: phone.trim(),
      sect: sect.trim(),
      lat: Number(lat) || 28.6139,
      lng: Number(lng) || 77.2090,
      capacity: Number(capacity) || 500,
      timings,
      nightTimings: {
        tahajjud: { start: '12:30 AM', end: '4:40 AM' },
        sehri: { start: '3:10 AM', end: '4:50 AM' },
      },
      jumaTimings: { khutba: '12:15 PM', namaz: '12:30 PM' },
      facilities: [],
      events: [],
      photos: [],
    }
    try {
      if (editing && id) await updateAdminMosque(id, payload)
      else await createAdminMosque(payload)
      router.back()
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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="Mosque name" value={name} onChange={setName} />
      <Field label="Address" value={address} onChange={setAddress} />
      <Field label="Area" value={area} onChange={setArea} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Madhab (school)" value={sect} onChange={setSect} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Latitude" value={lat} onChange={setLat} />
        </View>
        <View style={styles.half}>
          <Field label="Longitude" value={lng} onChange={setLng} />
        </View>
      </View>
      <Field label="Capacity" value={capacity} onChange={setCapacity} />

      <Text style={styles.section}>Azan / Namaz (quick)</Text>
      {PRAYERS.map((p) => (
        <View key={p} style={styles.timingRow}>
          <Text style={styles.prayer}>{p}</Text>
          <TextInput
            style={[styles.input, styles.timingInput]}
            value={timings[p].azan}
            placeholder="Azan"
            onChangeText={(v) => setTimings({ ...timings, [p]: { ...timings[p], azan: v, start: v } })}
          />
          <TextInput
            style={[styles.input, styles.timingInput]}
            value={timings[p].jamat}
            placeholder="Namaz"
            onChangeText={(v) => setTimings({ ...timings, [p]: { ...timings[p], jamat: v } })}
          />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.save} disabled={saving} onPress={() => void save()}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : editing ? 'Update mosque' : 'Create mosque'}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const styles = useStyles()
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface2,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  section: { fontWeight: '800', marginTop: 8, marginBottom: 8, color: colors.primary },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  prayer: { width: 64, fontWeight: '700', fontSize: 12 },
  timingInput: { flex: 1, paddingVertical: 8 },
  save: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800' },
  error: { color: colors.accent, fontWeight: '600', marginTop: 8 },
}))
