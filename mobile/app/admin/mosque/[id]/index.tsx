import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MosqueAdminTimingsTable } from '@/src/components/MosqueAdminTimingsTable'
import { MosqueStatsCard } from '@/src/components/MosqueStatsCard'
import { useLanguage } from '@/src/context/LanguageContext'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useAzanBroadcast } from '@/src/hooks/useAzanBroadcast'
import { fetchManagerMosques, postMosqueAnnouncement } from '@/src/services/api'
import { subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { BroadcastPrayer, Mosque, PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function MosqueHubScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t, prayerName, placeName } = useLanguage()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const broadcast = useAzanBroadcast(id ? String(id) : undefined)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceBusy, setAnnounceBusy] = useState(false)
  const [announceOk, setAnnounceOk] = useState('')

  const load = useCallback(async () => {
    broadcast.setError('')
    try {
      const list = await fetchManagerMosques()
      const found = list.find((m) => String(m.id) === String(id)) ?? null
      setMosque(found)
      await broadcast.syncLive()
    } catch (e) {
      broadcast.setError(e instanceof Error ? e.message : t('admin.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [broadcast.setError, broadcast.syncLive, id, t])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      void load()
      return subscribeLiveSessions(() => void broadcast.syncLive())
    }, [broadcast.syncLive, load]),
  )

  const onAnnounce = async () => {
    if (!mosque) return
    const title = announceTitle.trim()
    if (!title) {
      broadcast.setError(t('admin.needTitle'))
      return
    }
    setAnnounceBusy(true)
    broadcast.setError('')
    setAnnounceOk('')
    try {
      const result = await postMosqueAnnouncement(mosque.id, {
        title,
        body: announceBody.trim(),
      })
      setAnnounceOk(
        result.notified === 1 ? t('admin.sentOne') : t('admin.sentMany', { count: result.notified }),
      )
      setAnnounceTitle('')
      setAnnounceBody('')
    } catch (e) {
      broadcast.setError(e instanceof Error ? e.message : t('admin.announceFail'))
    } finally {
      setAnnounceBusy(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!mosque) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{broadcast.error || t('admin.notFound')}</Text>
      </View>
    )
  }

  const mm = String(Math.floor(broadcast.elapsed / 60)).padStart(2, '0')
  const ss = String(broadcast.elapsed % 60).padStart(2, '0')
  const elapsed = `${mm}:${ss}`

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{placeName(mosque.name)}</Text>
      <Text style={styles.sub}>{placeName(mosque.area)}</Text>
      {mosque.address ? <Text style={styles.address}>{placeName(mosque.address)}</Text> : null}

      <Pressable
        style={[styles.hero, styles.heroAzan]}
        onPress={() => router.push(`/admin/mosque/${mosque.id}/azan`)}>
        <Text style={styles.heroTitle}>{t('admin.dashboard')}</Text>
        <Text style={styles.heroMeta}>
          {broadcast.live ? t('admin.liveFor', { time: elapsed }) : t('admin.openAzan')}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.hero, styles.heroTime]}
        onPress={() => router.push(`/admin/mosque/${mosque.id}/timings`)}>
        <Text style={styles.heroTitleDark}>{t('admin.editTimes')}</Text>
        <Text style={styles.heroMetaDark}>{t('admin.editTimesSub')}</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>{t('stats.title')}</Text>
      <MosqueStatsCard mosqueId={String(mosque.id)} />

      <Text style={styles.sectionLabel}>{t('admin.giveAzan')}</Text>
      <View style={[styles.card, broadcast.live && styles.cardLive]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, broadcast.live && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{broadcast.live ? t('admin.onAir') : t('admin.offline')}</Text>
            <Text style={styles.statusMeta}>
              {broadcast.live ? t('admin.broadcasting', { time: elapsed }) : t('admin.startWhen')}
            </Text>
          </View>
        </View>

        {!broadcast.live ? (
          <>
            <Text style={styles.chipLabel}>{t('admin.prayerOptional')}</Text>
            <View style={styles.prayerRow}>
              {(mosque.taraweeh?.enabled ? ([...PRAYERS, 'Taraweeh'] as BroadcastPrayer[]) : PRAYERS).map((p) => {
                const on = broadcast.prayer === p
                return (
                  <Pressable
                    key={p}
                    style={[styles.prayerChip, on && styles.prayerChipOn]}
                    onPress={() => broadcast.setPrayer(on ? undefined : p)}>
                    <Text style={[styles.prayerChipText, on && styles.prayerChipTextOn]}>{prayerName(p)}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable
              style={[styles.btn, styles.btnStart]}
              disabled={broadcast.busy}
              onPress={() => void broadcast.onStart()}>
              <Text style={styles.btnText}>{broadcast.busy ? t('admin.starting') : t('admin.goLive')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.btn, styles.btnStop]}
            disabled={broadcast.busy}
            onPress={() => void broadcast.onStop()}>
            <Text style={styles.btnText}>{broadcast.busy ? t('admin.stopping') : t('admin.stopAzan')}</Text>
          </Pressable>
        )}

        {broadcast.hint ? <Text style={styles.hint}>{broadcast.hint}</Text> : null}
        {broadcast.error ? <Text style={styles.errorInline}>{broadcast.error}</Text> : null}
      </View>

      <Text style={styles.sectionLabel}>{t('admin.editMosque')}</Text>
      <Pressable
        style={[styles.btn, styles.btnEdit]}
        onPress={() => router.push({ pathname: '/admin/mosque-form', params: { id: mosque.id } })}>
        <Text style={styles.btnText}>{t('admin.editDetails')}</Text>
      </Pressable>
      <MosqueAdminTimingsTable mosque={mosque} />

      <Text style={styles.sectionLabel}>{t('admin.publish')}</Text>
      <View style={styles.card}>
        <Text style={styles.announceHint}>{t('admin.publishHint')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('admin.announceTitlePh')}
          value={announceTitle}
          onChangeText={setAnnounceTitle}
        />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder={t('admin.announceBodyPh')}
          value={announceBody}
          onChangeText={setAnnounceBody}
          multiline
        />
        <Pressable
          style={[styles.btn, styles.btnAnnounce]}
          disabled={announceBusy}
          onPress={() => void onAnnounce()}>
          <Text style={styles.btnText}>{announceBusy ? t('admin.sending') : t('admin.publish')}</Text>
        </Pressable>
        {announceOk ? <Text style={styles.okInline}>{announceOk}</Text> : null}
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingBottom: 40, gap: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: {fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: {fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 },
  address: {fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  hero: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 10,
  },
  heroAzan: { backgroundColor: colors.success },
  heroTime: { backgroundColor: colors.primary },
  heroTitle: {color: '#fff', fontSize: 18, fontWeight: '800' },
  heroMeta: {color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  heroTitleDark: {color: '#fff', fontSize: 18, fontWeight: '800' },
  heroMetaDark: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  sectionLabel: {marginTop: 12,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  cardLive: { borderColor: colors.success, backgroundColor: colors.successBg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.success },
  statusTitle: {color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  statusMeta: {fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chipLabel: {fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  prayerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  prayerChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface0,
  },
  prayerChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  prayerChipText: {fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  prayerChipTextOn: { color: colors.primary },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnStart: { backgroundColor: colors.success },
  btnStop: { backgroundColor: colors.accent },
  btnText: {color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: {marginTop: 10, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  error: {color: colors.accent, fontWeight: '600', textAlign: 'center' },
  errorInline: {marginTop: 8, color: colors.accent, fontWeight: '600', fontSize: 12 },
  announceHint: {fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 16 },
  input: {color: colors.textPrimary, borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface0,
    marginBottom: 8,
    fontSize: 14,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  btnEdit: { backgroundColor: colors.primary, marginBottom: 12 },
  btnAnnounce: { backgroundColor: colors.primary, marginTop: 4 },
  okInline: {marginTop: 8, color: colors.success, fontWeight: '700', fontSize: 12 },
}))
