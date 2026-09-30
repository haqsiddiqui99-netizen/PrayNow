import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { isAppAdmin } from '@/src/utils/roles'
import {
  approveMosqueRequest,
  fetchAdminMosqueRequests,
  rejectMosqueRequest,
  resolveApiUrl,
  type MosqueRequest,
  type MosqueRequestStatus,
} from '@/src/services/api'

const FILTERS: { key: MosqueRequestStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

export default function MosqueRequestsScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { user } = useAuth()
  const router = useRouter()

  const [filter, setFilter] = useState<MosqueRequestStatus | 'all'>('pending')
  const [requests, setRequests] = useState<MosqueRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [actingOn, setActingOn] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await fetchAdminMosqueRequests(filter))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (!isAppAdmin(user)) {
      router.replace('/admin')
      return
    }
    void load()
  }, [user, router, load])

  const review = async (request: MosqueRequest, action: 'approve' | 'reject') => {
    setActingOn(request.id)
    setError('')
    try {
      const note = notes[request.id]?.trim() ?? ''
      if (action === 'approve') {
        const mosque = await approveMosqueRequest(request.id, note)
        Alert.alert(
          'Mosque created',
          `${mosque.name} was added as inactive. Set its prayer timings, then activate it so users can see it.`,
        )
      } else {
        await rejectMosqueRequest(request.id, note)
      }
      setNotes((prev) => ({ ...prev, [request.id]: '' }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setActingOn('')
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>
        Requests sent by app users. Approving creates the mosque as inactive so you can add timings
        before it goes live.
      </Text>

      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.filterChip, filter === option.key && styles.filterChipActive]}
            onPress={() => setFilter(option.key)}>
            <Text
              style={[styles.filterText, filter === option.key && styles.filterTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : requests.length === 0 ? (
        <Text style={styles.empty}>No {filter === 'all' ? '' : filter} requests.</Text>
      ) : (
        requests.map((request) => (
          <View key={request.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.name} numberOfLines={2}>
                {request.name}
              </Text>
              <Text
                style={[
                  styles.statusPill,
                  request.status === 'approved' && styles.statusApproved,
                  request.status === 'rejected' && styles.statusRejected,
                ]}>
                {request.status}
              </Text>
            </View>

            <Text style={styles.address}>{request.address}</Text>
            <Text style={styles.meta}>
              {[request.area, request.city].filter(Boolean).join(' · ') || 'Area not given'}
              {request.lat != null && request.lng != null
                ? `  ·  ${request.lat.toFixed(4)}, ${request.lng.toFixed(4)}`
                : '  ·  no coordinates'}
            </Text>

            {request.photoUrls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {request.photoUrls.map((url) => (
                  <Image key={url} source={{ uri: resolveApiUrl(url) }} style={styles.photo} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.meta}>No photos attached</Text>
            )}

            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>Owner</Text>
              <Text style={styles.contactValue}>{request.ownerName}</Text>
              <View style={styles.contactActions}>
                <Pressable
                  style={styles.contactBtn}
                  onPress={() => void Linking.openURL(`tel:${request.ownerMobile}`)}>
                  <Ionicons name="call-outline" size={14} color={colors.primary} />
                  <Text style={styles.contactBtnText}>{request.ownerMobile}</Text>
                </Pressable>
                {request.ownerEmail ? (
                  <Pressable
                    style={styles.contactBtn}
                    onPress={() => void Linking.openURL(`mailto:${request.ownerEmail}`)}>
                    <Ionicons name="mail-outline" size={14} color={colors.primary} />
                    <Text style={styles.contactBtnText}>{request.ownerEmail}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {request.notes ? <Text style={styles.notes}>“{request.notes}”</Text> : null}

            <Text style={styles.submitter}>
              Sent by {request.submittedByName || 'unknown'}
              {request.submittedByMobile ? ` (${request.submittedByMobile})` : ''}
            </Text>

            {request.status === 'pending' ? (
              <>
                <TextInput
                  style={styles.noteInput}
                  value={notes[request.id] ?? ''}
                  onChangeText={(text) => setNotes((prev) => ({ ...prev, [request.id]: text }))}
                  placeholder="Review note (shown to the submitter)"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.approveBtn, actingOn === request.id && styles.btnBusy]}
                    disabled={actingOn === request.id}
                    onPress={() => void review(request, 'approve')}>
                    <Text style={styles.approveText}>
                      {actingOn === request.id ? 'Working…' : 'Approve & create'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectBtn, actingOn === request.id && styles.btnBusy]}
                    disabled={actingOn === request.id}
                    onPress={() => void review(request, 'reject')}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>
                </View>
              </>
            ) : request.reviewNote ? (
              <Text style={styles.reviewNote}>Review note: {request.reviewNote}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40 },
  lead: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.pillBorder },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: colors.primary },
  loader: { marginTop: 24 },
  empty: { fontSize: 13, color: colors.textMuted, marginTop: 16 },
  error: { color: colors.accent, fontWeight: '600', fontSize: 12.5, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  statusPill: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.textSecondary,
    backgroundColor: colors.surface1,
  },
  statusApproved: { color: colors.primary, backgroundColor: colors.primarySoft },
  statusRejected: { color: colors.accent, backgroundColor: colors.warningBg },
  address: { fontSize: 12.5, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  photoRow: { marginTop: 10 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: colors.surface1,
  },
  contactBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  contactValue: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, marginTop: 3 },
  contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.pillBorder,
  },
  contactBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  notes: { fontSize: 12, color: colors.textSecondary, marginTop: 10, fontStyle: 'italic', lineHeight: 17 },
  submitter: { fontSize: 10.5, color: colors.textMuted, marginTop: 10 },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 12,
    backgroundColor: colors.surface0,
    color: colors.textPrimary,
    fontSize: 12.5,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnBusy: { opacity: 0.6 },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rejectBtn: {
    paddingHorizontal: 18,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  reviewNote: { fontSize: 11.5, color: colors.textSecondary, marginTop: 10, fontStyle: 'italic' },
}))
