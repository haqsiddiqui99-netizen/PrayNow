import { useFocusEffect, useRouter } from 'expo-router'
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
  fetchAdminCityDays,
  fetchAdminCitySettings,
  generateAdminCityYear,
  importAdminCityDaysCsv,
  updateAdminCitySettings,
} from '@/src/services/api'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { isAppAdmin } from '@/src/utils/roles'

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const

export default function CityAdminScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { user } = useAuth()
  const { t, prayerName } = useLanguage()
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
      setError(e instanceof Error ? e.message : t('owner.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [year, t])

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
      setOk(t('owner.citySaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const generateYear = async (source: 'aladhan' | 'defaults' = 'aladhan') => {
    setBusyYear(true)
    setError('')
    setOk('')
    try {
      const y = Number(year) || new Date().getFullYear()
      const res = await generateAdminCityYear(y, city || 'Delhi', source)
      setYearDaysLoaded(res.upserted)
      const via =
        res.source === 'aladhan'
          ? t('owner.viaAladhan', { method: res.method ?? 1 })
          : t('owner.viaDefaults')
      setOk(t('owner.genDone', { count: res.upserted, city: res.city, year: res.year, source: via }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.genFail'))
    } finally {
      setBusyYear(false)
    }
  }

  const importCsv = async () => {
    if (!csvPaste.trim()) {
      setError(t('owner.csvFirst'))
      return
    }
    setBusyYear(true)
    setError('')
    setOk('')
    try {
      const result = await importAdminCityDaysCsv(csvPaste, city)
      setYearDaysLoaded(result.yearDaysLoaded)
      setOk(t('owner.csvDone', { count: result.upserted, total: result.yearDaysLoaded }))
      setCsvPaste('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.csvFail'))
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
      <Field label={t('addMosque.city')} value={city} onChange={setCity} />
      <Field label={t('owner.zawalStart')} value={zawalStart} onChange={setZawalStart} />
      <Field label={t('owner.zawalEnd')} value={zawalEnd} onChange={setZawalEnd} />
      <Field label={t('owner.sunrise')} value={sunrise} onChange={setSunrise} />
      <Field label={t('owner.fajrEnd')} value={fajrEnd} onChange={setFajrEnd} />
      <Field label={t('owner.tahajjudStart')} value={tahajjudStart} onChange={setTahajjudStart} />
      <Field label={t('owner.tahajjudEnd')} value={tahajjudEnd} onChange={setTahajjudEnd} />
      <Field label={t('owner.sehriStart')} value={sehriStart} onChange={setSehriStart} />
      <Field label={t('owner.sehriEnd')} value={sehriEnd} onChange={setSehriEnd} />

      <Text style={styles.section}>{t('owner.windows')}</Text>
      {PRAYERS.map((p) => (
        <View key={p} style={styles.block}>
          <Text style={styles.prayer}>{prayerName(p)}</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>{t('owner.start')}</Text>
              <TextInput
                style={styles.input}
                value={schedule[p]?.start || ''}
                onChangeText={(v) => setSchedule({ ...schedule, [p]: { ...schedule[p], start: v, end: schedule[p]?.end || '' } })}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>{t('owner.end')}</Text>
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
        <Text style={styles.saveText}>{saving ? t('owner.saving') : t('owner.saveCity')}</Text>
      </Pressable>

      <Text style={styles.section}>{t('owner.calendar')}</Text>
      <Text style={styles.hint}>{t('owner.calHint')}</Text>
      <Field label={t('owner.year')} value={year} onChange={setYear} />
      <Text style={styles.hint}>{t('owner.daysLoaded', { count: yearDaysLoaded, total: expectedDays })}</Text>
      <Pressable style={styles.save} disabled={busyYear} onPress={() => void generateYear('aladhan')}>
        <Text style={styles.saveText}>{busyYear ? t('owner.working') : t('owner.genAladhan', { year })}</Text>
      </Pressable>
      <Pressable style={styles.outline} disabled={busyYear} onPress={() => void generateYear('defaults')}>
        <Text style={styles.outlineText}>{busyYear ? t('owner.working') : t('owner.genDefaults', { year })}</Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: 12 }]}>{t('owner.pasteCsv')}</Text>
      <TextInput
        style={[styles.input, styles.csv]}
        value={csvPaste}
        onChangeText={setCsvPaste}
        multiline
        placeholder="date,city,fajr_start,..."
        textAlignVertical="top"
      />
      <Pressable style={styles.outline} disabled={busyYear} onPress={() => void importCsv()}>
        <Text style={styles.outlineText}>{busyYear ? t('owner.working') : t('owner.importCsv')}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const styles = useStyles()
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
}))
