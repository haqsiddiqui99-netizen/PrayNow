import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, radius } from '@/src/constants/theme'
import {
  fetchAdminCityDays,
  fetchAdminCitySettings,
  generateAdminCityYear,
  importAdminCityDaysCsv,
  updateAdminCitySettings,
} from '@/src/services/api'
import { useAuth } from '@/src/context/AuthContext'
import { isAppAdmin } from '@/src/utils/roles'

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const

export default function CityAdminScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyYear, setBusyYear] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [city, setCity] = useState('Delhi')
  const [zawalStart, setZawalStart] = useState('11:20 AM')
  const [zawalEnd, setZawalEnd] = useState('11:55 AM')
  const [sunrise, setSunrise] = useState('5:45 AM')
  const [fajrEnd, setFajrEnd] = useState('5:40 AM')
  const [tahajjudStart, setTahajjudStart] = useState('12:30 AM')
  const [tahajjudEnd, setTahajjudEnd] = useState('4:40 AM')
  const [sehriStart, setSehriStart] = useState('3:10 AM')
  const [sehriEnd, setSehriEnd] = useState('4:50 AM')
  const [schedule, setSchedule] = useState<Record<string, { start: string; end: string }>>({})
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [yearDaysLoaded, setYearDaysLoaded] = useState(0)
  const [csvPaste, setCsvPaste] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminCitySettings()
      const s = data.settings || {}
      setCity(String(s.city || 'Delhi'))
      setZawalStart(String(s.zawal_start || '11:20 AM'))
      setZawalEnd(String(s.zawal_end || '11:55 AM'))
      setSunrise(String(s.sunrise || '5:45 AM'))
      setFajrEnd(String(s.fajr_namaz_end || '5:40 AM'))
      setTahajjudStart(String(s.tahajjud_start || '12:30 AM'))
      setTahajjudEnd(String(s.tahajjud_end || '4:40 AM'))
      setSehriStart(String(s.sehri_start || '3:10 AM'))
      setSehriEnd(String(s.sehri_end || '4:50 AM'))
      const map: Record<string, { start: string; end: string }> = {}
      for (const row of data.schedule || []) {
        map[row.prayer_name] = { start: row.start_time, end: row.end_time }
      }
      for (const p of PRAYERS) {
        if (!map[p]) map[p] = { start: '', end: '' }
      }
      setSchedule(map)
      const y = Number(year) || new Date().getFullYear()
      const days = await fetchAdminCityDays(y)
      setYearDaysLoaded(days.yearDaysLoaded)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [year])

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

  const save = async () => {
    setSaving(true)
    setError('')
    setOk('')
    try {
      await updateAdminCitySettings({
        settings: {
          city,
          zawal_start: zawalStart,
          zawal_end: zawalEnd,
          sunrise,
          fajr_namaz_end: fajrEnd,
          tahajjud_start: tahajjudStart,
          tahajjud_end: tahajjudEnd,
          sehri_start: sehriStart,
          sehri_end: sehriEnd,
        },
        schedule: PRAYERS.map((p) => ({
          prayer_name: p,
          start_time: schedule[p]?.start || '',
          end_time: schedule[p]?.end || '',
        })),
      })
      setOk('City defaults saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const generateYear = async () => {
    setBusyYear(true)
    setError('')
    setOk('')
    try {
      const y = Number(year) || new Date().getFullYear()
      const res = await generateAdminCityYear(y, city)
      setYearDaysLoaded(res.upserted)
      setOk(`Generated ${res.upserted} days for ${res.city} ${res.year}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setBusyYear(false)
    }
  }

  const importCsv = async () => {
    if (!csvPaste.trim()) {
      setError('Paste CSV content first (header + rows)')
      return
    }
    setBusyYear(true)
    setError('')
    setOk('')
    try {
      const result = await importAdminCityDaysCsv(csvPaste, city)
      setYearDaysLoaded(result.yearDaysLoaded)
      setOk(`Imported ${result.upserted} days (${result.yearDaysLoaded} in year)`)
      setCsvPaste('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV import failed')
    } finally {
      setBusyYear(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const yNum = Number(year) || new Date().getFullYear()
  const expectedDays = yNum % 4 === 0 && (yNum % 100 !== 0 || yNum % 400 === 0) ? 366 : 365

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="City" value={city} onChange={setCity} />
      <Field label="Zawal start" value={zawalStart} onChange={setZawalStart} />
      <Field label="Zawal end" value={zawalEnd} onChange={setZawalEnd} />
      <Field label="Sunrise" value={sunrise} onChange={setSunrise} />
      <Field label="Fajr namaz end" value={fajrEnd} onChange={setFajrEnd} />
      <Field label="Tahajjud start" value={tahajjudStart} onChange={setTahajjudStart} />
      <Field label="Tahajjud end" value={tahajjudEnd} onChange={setTahajjudEnd} />
      <Field label="Sehri start" value={sehriStart} onChange={setSehriStart} />
      <Field label="Sehri end" value={sehriEnd} onChange={setSehriEnd} />

      <Text style={styles.section}>Default prayer windows</Text>
      {PRAYERS.map((p) => (
        <View key={p} style={styles.block}>
          <Text style={styles.prayer}>{p}</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Start</Text>
              <TextInput
                style={styles.input}
                value={schedule[p]?.start || ''}
                onChangeText={(v) => setSchedule({ ...schedule, [p]: { ...schedule[p], start: v, end: schedule[p]?.end || '' } })}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>End</Text>
              <TextInput
                style={styles.input}
                value={schedule[p]?.end || ''}
                onChangeText={(v) => setSchedule({ ...schedule, [p]: { start: schedule[p]?.start || '', end: v } })}
              />
            </View>
          </View>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}
      <Pressable style={styles.save} disabled={saving} onPress={() => void save()}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save city defaults'}</Text>
      </Pressable>

      <Text style={styles.section}>365-day calendar</Text>
      <Text style={styles.hint}>
        Home uses today’s row. Generate a starter year from defaults, or paste a CSV (one row per date).
      </Text>
      <Field label="Year" value={year} onChange={setYear} />
      <Text style={styles.hint}>
        Days loaded: {yearDaysLoaded} / {expectedDays}
      </Text>
      <Pressable style={styles.outline} disabled={busyYear} onPress={() => void generateYear()}>
        <Text style={styles.outlineText}>{busyYear ? 'Working…' : `Generate ${year} from defaults`}</Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: 12 }]}>Paste CSV</Text>
      <TextInput
        style={[styles.input, styles.csv]}
        value={csvPaste}
        onChangeText={setCsvPaste}
        multiline
        placeholder="date,city,fajr_start,..."
        textAlignVertical="top"
      />
      <Pressable style={styles.outline} disabled={busyYear} onPress={() => void importCsv()}>
        <Text style={styles.outlineText}>{busyYear ? 'Working…' : 'Import pasted CSV'}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface2,
  },
  csv: { minHeight: 120, fontSize: 12 },
  section: { fontWeight: '800', color: colors.primary, marginTop: 8, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
  block: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  prayer: { fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  save: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800' },
  outline: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineText: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.accent, fontWeight: '600', marginTop: 8 },
  ok: { color: colors.success, fontWeight: '700', marginTop: 8 },
})
