import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader, pageBackground } from '@/src/components/PageHeader'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { renderFacilityIcon } from '@/src/utils/facilities'
import { useLocation } from '@/src/context/LocationContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  fetchMyMosqueRequests,
  submitMosqueRequest,
  type MosqueRequest,
  type MosqueRequestStatus,
} from '@/src/services/api'
import {
  MAX_REQUEST_PHOTOS,
  captureMosquePhoto,
  pickMosquePhotos,
  type PickedPhoto,
} from '@/src/utils/mosquePhotos'

const FACILITIES = [
  'Wudu Area',
  'Washroom',
  'Two-wheeler parking',
  'Four-wheeler parking',
  'WiFi',
  'Wheelchair access',
  'Chairs available',
  'Drinking water',
  'Women section',
  'Library',
  'AC',
] as const

const CLOCK_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Isha'] as const
type SlotName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'
type PrayerSlot = { azan: string; jamat: string }

function blankSlots(): Record<SlotName, PrayerSlot> {
  return {
    Fajr: { azan: '', jamat: '' },
    Dhuhr: { azan: '', jamat: '' },
    Asr: { azan: '', jamat: '' },
    Maghrib: { azan: '', jamat: '' },
    Isha: { azan: '', jamat: '' },
  }
}

function previewClock(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  if (digits.length === 3) return `${digits[0]}:${digits.slice(1)}`
  return `${Number(digits.slice(0, 2))}:${digits.slice(2)}`
}

function commitClock(raw: string, period: 'AM' | 'PM') {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''
  let hourDigits = digits
  let minuteDigits = '00'
  if (digits.length >= 3) {
    hourDigits = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2)
    minuteDigits = digits.slice(hourDigits.length).padEnd(2, '0').slice(0, 2)
  }
  const hour = Number(hourDigits)
  const minute = Number(minuteDigits)
  if (hour < 1 || hour > 12 || minute > 59) return ''
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}

function partsOf(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) return null
  return { hour, minute, period: match[3].toUpperCase() as 'AM' | 'PM' }
}

function clockOf(hour: number, minute: number, period: 'AM' | 'PM') {
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}

/** Hours are 1–12. A second digit is kept only when the pair is still a real hour. */
function hourDigits(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 2)
  if (!digits || digits[0] === '0') return ''
  if (digits.length === 1) return digits
  return Number(digits) <= 12 ? digits : digits[0]
}

/** Minutes are 00–59, so the first digit can only be 0–5. */
function minuteDigits(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 2)
  if (!digits || Number(digits[0]) > 5) return ''
  if (digits.length === 1) return digits
  return Number(digits) <= 59 ? digits : digits[0]
}

function CompactTime({
  value,
  onChange,
  periodHint,
}: {
  value: string
  onChange: (next: string) => void
  periodHint: 'AM' | 'PM'
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const ink = inkColor(mode)
  const parsed = partsOf(value)
  const [hourText, setHourText] = useState(parsed ? String(parsed.hour) : '')
  const [minuteText, setMinuteText] = useState(parsed ? String(parsed.minute).padStart(2, '0') : '')
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed?.period ?? periodHint)
  const placeholder = mode === 'dark' ? '#6F8A86' : '#9AA3AE'

  useEffect(() => {
    const next = partsOf(value)
    setHourText(next ? String(next.hour) : '')
    setMinuteText(next ? String(next.minute).padStart(2, '0') : '')
    if (next) setPeriod(next.period)
  }, [value])

  const revert = () => {
    const saved = partsOf(value)
    setHourText(saved ? String(saved.hour) : '')
    setMinuteText(saved ? String(saved.minute).padStart(2, '0') : '')
  }

  const finish = (nextHour: string, nextMinute: string, nextPeriod: 'AM' | 'PM') => {
    const hour = hourDigits(nextHour)
    const minute = minuteDigits(nextMinute)
    setHourText(hour)
    setMinuteText(minute)
    if (!hour && !minute) {
      onChange('')
      return
    }
    const hourNumber = Number(hour)
    const minuteNumber = minute === '' ? NaN : Number(minute)
    if (hourNumber >= 1 && hourNumber <= 12 && minuteNumber >= 0 && minuteNumber <= 59) {
      onChange(clockOf(hourNumber, minuteNumber, nextPeriod))
      return
    }
    revert()
  }

  return (
    <View style={styles.compact}>
      <TextInput
        value={hourText}
        onChangeText={(text) => setHourText(hourDigits(text))}
        onBlur={() => finish(hourText, minuteText, period)}
        keyboardType="number-pad"
        placeholder="5"
        placeholderTextColor={placeholder}
        style={[styles.compactHour, { color: ink }]}
      />
      <Text style={[styles.compactColon, { color: ink }]}>:</Text>
      <TextInput
        value={minuteText}
        onChangeText={(text) => setMinuteText(minuteDigits(text))}
        onBlur={() => finish(hourText, minuteText, period)}
        keyboardType="number-pad"
        placeholder="00"
        placeholderTextColor={placeholder}
        style={[styles.compactMinute, { color: ink }]}
      />
      <Pressable
        hitSlop={6}
        onPress={() => {
          const next = period === 'AM' ? 'PM' : 'AM'
          setPeriod(next)
          finish(hourText, minuteText, next)
        }}
        style={styles.compactPeriod}>
        <Text style={[styles.compactPeriodText, { color: ink }]}>{period}</Text>
      </Pressable>
    </View>
  )
}

function TimeChip({
  value,
  onChange,
  periodHint,
  onLive,
}: {
  value: string
  onChange: (next: string) => void
  periodHint: 'AM' | 'PM'
  onLive: (shown: string, period: 'AM' | 'PM') => void
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const ink = inkColor(mode)
  const parsed = value.match(/^(.*?)\s+(AM|PM)$/i)
  const [draft, setDraft] = useState(parsed ? parsed[1] : '')
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed ? (parsed[2].toUpperCase() as 'AM' | 'PM') : periodHint)

  useEffect(() => {
    const next = value.match(/^(.*?)\s+(AM|PM)$/i)
    setDraft(next ? next[1] : '')
    if (next) setPeriod(next[2].toUpperCase() as 'AM' | 'PM')
  }, [value])

  const publish = (shown: string, nextPeriod: 'AM' | 'PM', force: boolean) => {
    onLive(shown, nextPeriod)
    const digits = shown.replace(/\D/g, '')
    if (!digits) {
      onChange('')
      return
    }
    if (!force && digits.length < 3) return
    const committed = commitClock(shown, nextPeriod)
    if (committed) {
      onChange(committed)
      if (force) setDraft(committed.replace(new RegExp(` ${nextPeriod}$`), ''))
      return
    }
    if (force) {
      onLive('', nextPeriod)
      setDraft('')
      onChange('')
    }
  }

  return (
    <View style={styles.timeChip}>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          const shown = previewClock(text)
          setDraft(shown)
          publish(shown, period, false)
        }}
        onBlur={() => publish(draft, period, true)}
        keyboardType="number-pad"
        placeholder="5:12"
        placeholderTextColor={mode === 'dark' ? '#6F8A86' : '#9AA3AE'}
        style={[styles.timeInput, { color: ink }]}
      />
      <Pressable
        onPress={() => {
          const next = period === 'AM' ? 'PM' : 'AM'
          setPeriod(next)
          publish(draft, next, draft.replace(/\D/g, '').length > 0)
        }}
        hitSlop={8}
        style={styles.periodBtn}>
        <Text style={[styles.periodText, { color: ink }]}>{period}</Text>
      </Pressable>
    </View>
  )
}

export default function SubmitMosqueScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const ink = inkColor(mode)
  const { t, facilityName, prayerName } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { location } = useLocation()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [city, setCity] = useState(location.city || '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [ownerMobile, setOwnerMobile] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [facilities, setFacilities] = useState<string[]>([])
  const [slots, setSlots] = useState(blankSlots)
  const [maghribOffset, setMaghribOffset] = useState('')
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const live = useRef<Record<string, { shown: string; period: 'AM' | 'PM' }>>({})

  const [busyPhotos, setBusyPhotos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [mine, setMine] = useState<MosqueRequest[]>([])

  const loadMine = useCallback(async () => {
    if (!user) return
    try {
      setMine(await fetchMyMosqueRequests())
    } catch {
      // The form still works if the history cannot be fetched.
    }
  }, [user])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  const remaining = MAX_REQUEST_PHOTOS - photos.length

  const addPhotos = async (source: 'gallery' | 'camera') => {
    setBusyPhotos(true)
    setError('')
    try {
      if (source === 'camera') {
        const shot = await captureMosquePhoto()
        if (shot) setPhotos((prev) => [...prev, shot].slice(0, MAX_REQUEST_PHOTOS))
      } else {
        const picked = await pickMosquePhotos(remaining)
        if (picked.length) setPhotos((prev) => [...prev, ...picked].slice(0, MAX_REQUEST_PHOTOS))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach that photo')
    } finally {
      setBusyPhotos(false)
    }
  }

  const submit = async () => {
    if (!name.trim() || !address.trim() || !ownerName.trim() || !ownerMobile.trim()) {
      setError(t('addMosque.requiredError'))
      return
    }
    const taken = (id: string, fallback: string) => {
      const item = live.current[id]
      if (!item) return fallback
      const digits = item.shown.replace(/\D/g, '')
      if (!digits) return ''
      return commitClock(item.shown, item.period) || null
    }
    const nextSlots = blankSlots()
    const fields: Array<[SlotName, 'azan' | 'jamat']> = [
      ['Fajr', 'azan'],
      ['Fajr', 'jamat'],
      ['Dhuhr', 'azan'],
      ['Dhuhr', 'jamat'],
      ['Asr', 'azan'],
      ['Asr', 'jamat'],
      ['Maghrib', 'jamat'],
      ['Isha', 'azan'],
      ['Isha', 'jamat'],
    ]
    for (const [prayer, field] of fields) {
      const value = taken(`${prayer}.${field}`, slots[prayer][field])
      if (value == null) {
        setError(t('addMosque.timeInvalid'))
        return
      }
      nextSlots[prayer][field] = value
    }
    const offsetDigits = maghribOffset.replace(/\D/g, '')
    const offset = offsetDigits === '' ? null : Math.min(45, Number(offsetDigits))

    setSubmitting(true)
    setError('')
    try {
      await submitMosqueRequest({
        name: name.trim(),
        address: address.trim(),
        area: area.trim(),
        city: city.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        ownerName: ownerName.trim(),
        ownerMobile: ownerMobile.trim(),
        ownerEmail: ownerEmail.trim(),
        notes: notes.trim(),
        facilities,
        timings: nextSlots,
        nightTimings: { sehriEnd: '', iftar: '' },
        maghribOffsetMinutes: offset,
        photos: photos.map((photo) => photo.dataUrl),
      })
      setSubmitted(true)
      await loadMine()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setName('')
    setAddress('')
    setArea('')
    setCoords(null)
    setOwnerName('')
    setOwnerMobile('')
    setOwnerEmail('')
    setNotes('')
    setFacilities([])
    setSlots(blankSlots())
    setMaghribOffset('')
    live.current = {}
    setPhotos([])
    setSubmitted(false)
    setError('')
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <PageHeader title={t('addMosque.title')} topInset={insets.top} />
        <View style={styles.gate}>
          <Ionicons name="lock-closed-outline" size={34} color={ink} />
          <Text style={styles.gateTitle}>{t('addMosque.signInTitle')}</Text>
          <Text style={styles.gateBody}>{t('addMosque.signInBody')}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.primaryBtnText}>{t('addMosque.signInCta')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerBleed}>
        <PageHeader title={t('addMosque.title')} topInset={insets.top} />
      </View>
      {submitted ? (
        <View style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={30} color={ink} />
          <Text style={styles.successTitle}>{t('addMosque.successTitle')}</Text>
          <Text style={styles.successBody}>{t('addMosque.successBody')}</Text>
          <Pressable style={styles.primaryBtn} onPress={reset}>
            <Text style={styles.primaryBtnText}>{t('addMosque.addAnother')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.lead}>{t('addMosque.subtitle')}</Text>

          <Text style={styles.section}>{t('addMosque.sectionMosque')}</Text>
          <Field
            label={t('addMosque.name')}
            placeholder={t('addMosque.namePlaceholder')}
            value={name}
            onChange={setName}
            required
          />
          <Field
            label={t('addMosque.address')}
            placeholder={t('addMosque.addressPlaceholder')}
            value={address}
            onChange={setAddress}
            multiline
            required
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label={t('addMosque.area')} value={area} onChange={setArea} />
            </View>
            <View style={styles.half}>
              <Field label={t('addMosque.city')} value={city} onChange={setCity} />
            </View>
          </View>

          <Text style={styles.section}>{t('addMosque.sectionLocation')}</Text>
          <Pressable
            style={styles.locationBtn}
            onPress={() => setCoords({ lat: location.lat, lng: location.lng })}>
            <Ionicons name="locate" size={16} color={ink} />
            <Text style={styles.locationBtnText}>{t('addMosque.useCurrentLocation')}</Text>
          </Pressable>
          <Text style={styles.hint}>
            {coords
              ? t('addMosque.coordsSet', {
                  lat: coords.lat.toFixed(5),
                  lng: coords.lng.toFixed(5),
                })
              : t('addMosque.coordsNone')}
          </Text>

          <Text style={styles.section}>{t('addMosque.sectionTimings')}</Text>
          <Text style={styles.hint}>{t('addMosque.timingsHint')}</Text>
          <View style={styles.timeCard}>
            <View style={styles.slotRow}>
              <View style={styles.slotName} />
              <Text style={styles.slotHead}>{t('mosque.azan')}</Text>
              <Text style={styles.slotHead}>{t('mosque.jamat')}</Text>
            </View>
            {CLOCK_PRAYERS.map((prayer) => (
              <View key={prayer} style={styles.slotRow}>
                <Text style={styles.slotName}>{prayerName(prayer)}</Text>
                <View style={styles.slotCell}>
                  <CompactTime
                    value={slots[prayer].azan}
                    periodHint={prayer === 'Fajr' ? 'AM' : 'PM'}
                    onChange={(next) => setSlots((prev) => ({ ...prev, [prayer]: { ...prev[prayer], azan: next } }))}
                  />
                </View>
                <View style={styles.slotCell}>
                  <CompactTime
                    value={slots[prayer].jamat}
                    periodHint={prayer === 'Fajr' ? 'AM' : 'PM'}
                    onChange={(next) => setSlots((prev) => ({ ...prev, [prayer]: { ...prev[prayer], jamat: next } }))}
                  />
                </View>
              </View>
            ))}
            <View style={styles.timeRow}>
              <Text style={styles.maghribName}>{prayerName('Maghrib')}</Text>
              <View style={styles.offsetCell}>
                <TextInput
                  value={maghribOffset}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 2)
                    setMaghribOffset(digits === '' ? '' : String(Math.min(45, Number(digits))))
                  }}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={mode === 'dark' ? '#6F8A86' : '#9AA3AE'}
                  style={[styles.offsetInput, { color: ink }]}
                />
                <Text style={styles.offsetUnit}>{t('addMosque.maghribAfter')}</Text>
              </View>
              <TimeChip
                value={slots.Maghrib.jamat}
                periodHint="PM"
                onChange={(next) => setSlots((prev) => ({ ...prev, Maghrib: { ...prev.Maghrib, jamat: next } }))}
                onLive={(shown, period) => {
                  live.current['Maghrib.jamat'] = { shown, period }
                }}
              />
            </View>
          </View>
          <Text style={styles.hint}>{t('addMosque.maghribHint')}</Text>

          <Text style={styles.section}>{t('addMosque.sectionPhotos')}</Text>
          <Text style={styles.hint}>{t('addMosque.photosHint', { max: MAX_REQUEST_PHOTOS })}</Text>
          <View style={styles.photoActions}>
            <Pressable
              style={[styles.photoBtn, remaining <= 0 && styles.photoBtnDisabled]}
              disabled={remaining <= 0 || busyPhotos}
              onPress={() => void addPhotos('gallery')}>
              <Ionicons name="images-outline" size={16} color={ink} />
              <Text style={styles.photoBtnText}>{t('addMosque.gallery')}</Text>
            </Pressable>
            <Pressable
              style={[styles.photoBtn, remaining <= 0 && styles.photoBtnDisabled]}
              disabled={remaining <= 0 || busyPhotos}
              onPress={() => void addPhotos('camera')}>
              <Ionicons name="camera-outline" size={16} color={ink} />
              <Text style={styles.photoBtnText}>{t('addMosque.camera')}</Text>
            </Pressable>
            {busyPhotos ? <ActivityIndicator color={ink} /> : null}
            <Text style={styles.photoCount}>
              {t('addMosque.photoCount', { count: photos.length, max: MAX_REQUEST_PHOTOS })}
            </Text>
          </View>
          {photos.length > 0 ? (
            <View style={styles.thumbRow}>
              {photos.map((photo, index) => (
                <View key={photo.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  <Pressable
                    style={styles.thumbRemove}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('addMosque.removePhoto')}
                    onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.section}>{t('filter.facilities')}</Text>
          <View style={styles.facilityCard}>
            {FACILITIES.map((name, index) => {
              const on = facilities.includes(name)
              return (
                <View key={name} style={[styles.facilityRow, index === FACILITIES.length - 1 && styles.facilityRowLast]}>
                  <View style={styles.facilityIcon}>{renderFacilityIcon(name, 16, ink)}</View>
                  <Text style={styles.facilityName}>{facilityName(name)}</Text>
                  <Pressable
                    onPress={() =>
                      setFacilities((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]))
                    }
                    hitSlop={8}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={facilityName(name)}
                    style={[styles.sw, on && styles.swOn]}>
                    <View style={[styles.swKnob, on && styles.swKnobOn]} />
                  </Pressable>
                </View>
              )
            })}
          </View>

          <Text style={styles.section}>{t('addMosque.sectionOwner')}</Text>
          <Field
            label={t('addMosque.ownerName')}
            value={ownerName}
            onChange={setOwnerName}
            required
          />
          <Field
            label={t('addMosque.ownerMobile')}
            value={ownerMobile}
            onChange={setOwnerMobile}
            keyboardType="phone-pad"
            required
          />
          <Field
            label={t('addMosque.ownerEmail')}
            value={ownerEmail}
            onChange={setOwnerEmail}
            keyboardType="email-address"
          />
          <Field
            label={t('addMosque.notes')}
            placeholder={t('addMosque.notesPlaceholder')}
            value={notes}
            onChange={setNotes}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.primaryBtn, submitting && styles.primaryBtnBusy]}
            disabled={submitting}
            onPress={() => void submit()}>
            <Text style={styles.primaryBtnText}>
              {submitting ? t('addMosque.submitting') : t('addMosque.submit')}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={styles.section}>{t('addMosque.myRequests')}</Text>
      {mine.length === 0 ? (
        <Text style={styles.hint}>{t('addMosque.emptyRequests')}</Text>
      ) : (
        mine.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.requestHead}>
              <Text style={styles.requestName} numberOfLines={1}>
                {request.name}
              </Text>
              <StatusPill status={request.status} />
            </View>
            <Text style={styles.requestMeta} numberOfLines={2}>
              {request.address}
            </Text>
            {request.reviewNote ? (
              <Text style={styles.requestNote}>{request.reviewNote}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  )
}

function StatusPill({ status }: { status: MosqueRequestStatus }) {
  const styles = useStyles()
  const { t } = useLanguage()
  const label =
    status === 'approved'
      ? t('addMosque.statusApproved')
      : status === 'rejected'
        ? t('addMosque.statusRejected')
        : t('addMosque.statusPending')
  return (
    <Text
      style={[
        styles.statusPill,
        status === 'approved' && styles.statusApproved,
        status === 'rejected' && styles.statusRejected,
      ]}>
      {label}
    </Text>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  required = false,
  keyboardType,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  multiline?: boolean
  required?: boolean
  keyboardType?: KeyboardTypeOptions
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={mode === 'dark' ? '#6F8A86' : '#9AA3AE'}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  )
}

function inkColor(mode: string) {
  return mode === 'dark' ? '#EAF3F0' : '#0F1F2E'
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = inkColor(mode)
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const card = dark ? '#122027' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const chip = dark ? '#1C3330' : '#F3F1EC'
  const alert = dark ? '#F2A7A0' : '#B3261E'
  return {
    page: { flex: 1, backgroundColor: pageBackground(mode) },
    content: { paddingHorizontal: 12 },
    headerBleed: { marginHorizontal: -12, marginBottom: 4 },
    gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
    gateTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, color: ink, marginTop: 4 },
    gateBody: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, textAlign: 'center', lineHeight: 19 },
    lead: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, lineHeight: 19, marginHorizontal: 4, marginBottom: 4 },
    section: {
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
      marginTop: 18,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    field: { marginBottom: 10 },
    label: { fontFamily: 'Figtree_600SemiBold', fontSize: 12.5, color: ink, marginBottom: 5, marginHorizontal: 4 },
    requiredMark: { color: alert },
    input: {
      borderWidth: 1,
      borderColor: line,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: card,
      color: ink,
      fontFamily: 'Figtree_500Medium',
      fontSize: 14,
    },
    inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 8 },
    half: { flex: 1 },
    hint: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: muted, lineHeight: 17, marginHorizontal: 4 },
    locationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: chip,
      marginBottom: 6,
    },
    locationBtnText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    photoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: chip,
    },
    photoBtnDisabled: { opacity: 0.45 },
    photoBtnText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    photoCount: { marginLeft: 'auto', marginRight: 4, fontFamily: 'Figtree_700Bold', fontSize: 12, color: muted },
    thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    thumbWrap: { position: 'relative' },
    thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: chip },
    facilityCard: {
      backgroundColor: card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 12,
    },
    facilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: line,
    },
    facilityRowLast: { borderBottomWidth: 0 },
    facilityIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    timeCard: {
      marginTop: 8,
      backgroundColor: card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 10,
      paddingBottom: 6,
    },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
    slotName: { width: 64, fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    slotCell: { flex: 1 },
    slotHead: {
      flex: 1,
      fontFamily: 'Figtree_700Bold',
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: muted,
    },
    compact: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: dark ? '#0F1A20' : '#F7F5F1',
      paddingLeft: 6,
    },
    compactHour: { width: 26, padding: 0, textAlign: 'center', fontFamily: 'Figtree_700Bold', fontSize: 15 },
    compactMinute: { width: 26, padding: 0, textAlign: 'center', fontFamily: 'Figtree_700Bold', fontSize: 15 },
    compactColon: { fontFamily: 'Figtree_700Bold', fontSize: 15 },
    compactPeriod: { paddingHorizontal: 7, paddingVertical: 8 },
    compactPeriodText: { fontFamily: 'Figtree_700Bold', fontSize: 12 },
    timeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
    maghribName: { width: 72, fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    timeName: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: ink },
    timeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: dark ? '#0F1A20' : '#F7F5F1',
      paddingLeft: 8,
    },
    timeInput: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 14, paddingVertical: 0 },
    periodBtn: { paddingHorizontal: 8, paddingVertical: 8 },
    periodText: { fontFamily: 'Figtree_700Bold', fontSize: 12 },
    offsetCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    offsetInput: {
      width: 42,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: dark ? '#0F1A20' : '#F7F5F1',
      textAlign: 'center',
      fontFamily: 'Figtree_700Bold',
      fontSize: 15,
      paddingVertical: 0,
    },
    offsetUnit: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 11, color: muted, lineHeight: 13 },
    facilityName: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: ink },
    sw: { width: 36, height: 22, borderRadius: 11, backgroundColor: dark ? '#24343A' : '#D5DCE6', padding: 2 },
    swOn: { backgroundColor: ink },
    swKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
    swKnobOn: { marginLeft: 14, backgroundColor: dark ? '#0F1F2E' : '#FFFFFF' },
    thumbRemove: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: ink,
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    primaryBtnBusy: { opacity: 0.7 },
    primaryBtnText: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: dark ? '#0F1F2E' : '#FFFFFF' },
    error: { fontFamily: 'Figtree_600SemiBold', color: alert, fontSize: 12.5, marginTop: 12, lineHeight: 18, marginHorizontal: 4 },
    successCard: {
      alignItems: 'center',
      gap: 6,
      padding: 20,
      borderRadius: 20,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
    },
    successTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, color: ink },
    successBody: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, textAlign: 'center', lineHeight: 18 },
    requestCard: {
      backgroundColor: card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: line,
      padding: 14,
      marginBottom: 8,
    },
    requestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    requestName: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 15, color: ink },
    requestMeta: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, color: muted, marginTop: 2, lineHeight: 17 },
    requestNote: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, color: ink, marginTop: 6, fontStyle: 'italic' },
    statusPill: {
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      fontFamily: 'Figtree_700Bold',
      fontSize: 11,
      color: ink,
      backgroundColor: chip,
    },
    statusApproved: { color: dark ? '#0F1F2E' : '#FFFFFF', backgroundColor: ink },
    statusRejected: { color: alert, backgroundColor: dark ? '#3A1F1D' : '#FBE9E7' },
  }
})
