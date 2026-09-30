import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
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

export default function SubmitMosqueScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
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
  const [photos, setPhotos] = useState<PickedPhoto[]>([])

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
    setPhotos([])
    setSubmitted(false)
    setError('')
  }

  if (!user) {
    return (
      <View style={styles.gate}>
        <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
        <Text style={styles.gateTitle}>{t('addMosque.signInTitle')}</Text>
        <Text style={styles.gateBody}>{t('addMosque.signInBody')}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryBtnText}>{t('addMosque.signInCta')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {submitted ? (
        <View style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={30} color={colors.primary} />
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
            <Ionicons name="locate" size={16} color={colors.primary} />
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

          <Text style={styles.section}>{t('addMosque.sectionPhotos')}</Text>
          <Text style={styles.hint}>{t('addMosque.photosHint', { max: MAX_REQUEST_PHOTOS })}</Text>
          <View style={styles.photoActions}>
            <Pressable
              style={[styles.photoBtn, remaining <= 0 && styles.photoBtnDisabled]}
              disabled={remaining <= 0 || busyPhotos}
              onPress={() => void addPhotos('gallery')}>
              <Ionicons name="images-outline" size={16} color={colors.primary} />
              <Text style={styles.photoBtnText}>{t('addMosque.gallery')}</Text>
            </Pressable>
            <Pressable
              style={[styles.photoBtn, remaining <= 0 && styles.photoBtnDisabled]}
              disabled={remaining <= 0 || busyPhotos}
              onPress={() => void addPhotos('camera')}>
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.photoBtnText}>{t('addMosque.camera')}</Text>
            </Pressable>
            {busyPhotos ? <ActivityIndicator color={colors.primary} /> : null}
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
  const { colors } = useTheme()
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
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
    backgroundColor: colors.surface0,
  },
  gateTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  gateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  lead: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 4 },
  section: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  field: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  requiredMark: { color: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 68, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  hint: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    marginBottom: 6,
  },
  locationBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBtnDisabled: { opacity: 0.45 },
  photoBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  photoCount: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: colors.textMuted },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.surface1,
  },
  thumbRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryBtnBusy: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  error: { color: colors.accent, fontWeight: '600', fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  successCard: {
    alignItems: 'center',
    gap: 6,
    padding: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  successBody: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  requestCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  requestMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  requestNote: { fontSize: 11.5, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  statusPill: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    backgroundColor: colors.surface1,
  },
  statusApproved: { color: colors.primary, backgroundColor: colors.primarySoft },
  statusRejected: { color: colors.accent, backgroundColor: colors.warningBg },
}))
