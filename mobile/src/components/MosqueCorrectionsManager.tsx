import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { showToast } from '@/src/components/AppToast'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { localeOf } from '@/src/hooks/useMosqueEvents'
import type { TranslationKey } from '@/src/i18n/translations'
import {
  fetchMosqueCorrections,
  resolveCorrection,
  type CorrectionTopic,
  type MosqueCorrection,
} from '@/src/services/api'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

const TOPIC_LABEL: Record<CorrectionTopic, TranslationKey> = {
  jamaat: 'correction.topicJamaat',
  juma: 'correction.topicJuma',
  address: 'correction.topicAddress',
  phone: 'correction.topicPhone',
  facilities: 'correction.topicFacilities',
  other: 'correction.topicOther',
}

/** One report with Fixed / Dismiss actions. `showMosque` is for the app owner's list across mosques. */
export function CorrectionItem({
  item,
  showMosque = false,
  onResolved,
}: {
  item: MosqueCorrection
  showMosque?: boolean
  onResolved: (item: MosqueCorrection) => void
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t, prayerName, placeName, language, digits } = useLanguage()
  const [busy, setBusy] = useState<'fixed' | 'dismissed' | null>(null)
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'

  const topic = item.topic === 'jamaat' && item.prayer
    ? `${prayerName(item.prayer)} · ${t('correction.topicJamaat')}`
    : t(TOPIC_LABEL[item.topic])
  const when = digits(
    new Date(item.createdAt).toLocaleDateString(localeOf(language), { day: 'numeric', month: 'short' }),
  )
  const by = item.reporterName ? t('correction.by', { name: item.reporterName, when }) : when

  const resolve = async (status: 'fixed' | 'dismissed') => {
    setBusy(status)
    try {
      const updated = await resolveCorrection(item.id, status)
      showToast(status === 'fixed' ? t('correction.markedFixed') : t('correction.markedDismissed'), 'checkmark-circle')
      onResolved(updated)
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : t('correction.failed'), 'cloud-offline-outline')
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.item}>
      {showMosque ? (
        <Text style={styles.mosque} numberOfLines={1}>
          {placeName(item.mosqueName)}
        </Text>
      ) : null}
      <Text style={styles.topic}>{topic}</Text>
      {item.suggestion ? <Text style={styles.suggestion}>{item.suggestion}</Text> : null}
      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
      <Text style={styles.meta}>{by}</Text>
      {item.status === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => void resolve('fixed')}
            disabled={busy !== null}
            accessibilityRole="button"
            style={[styles.fixBtn, busy !== null && styles.dim]}>
            {busy === 'fixed' ? (
              <ActivityIndicator size="small" color={dark ? '#0F1F2E' : '#FFFFFF'} />
            ) : (
              <>
                <Ionicons name="checkmark" size={15} color={dark ? '#0F1F2E' : '#FFFFFF'} />
                <Text style={styles.fixText}>{t('correction.fixed')}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => void resolve('dismissed')}
            disabled={busy !== null}
            accessibilityRole="button"
            style={[styles.dismissBtn, busy !== null && styles.dim]}>
            {busy === 'dismissed' ? (
              <ActivityIndicator size="small" color={ink} />
            ) : (
              <Text style={styles.dismissText}>{t('correction.dismiss')}</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.status}>
          {item.status === 'fixed' ? t('correction.statusFixed') : t('correction.statusDismissed')}
        </Text>
      )}
    </View>
  )
}

/** "Reports from followers" for one mosque, shown in My Mosque. */
export function MosqueCorrectionsManager({ mosqueId }: { mosqueId: string }) {
  const styles = useStyles()
  const { t } = useLanguage()
  const [items, setItems] = useState<MosqueCorrection[] | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchMosqueCorrections(mosqueId))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('correction.loadFail'))
      setItems([])
    }
  }, [mosqueId, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <View>
      <Text style={styles.title}>{t('correction.panelTitle')}</Text>
      <Text style={styles.sub}>{t('correction.panelSub')}</Text>
      {items === null ? (
        <ActivityIndicator style={styles.loader} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{error || t('correction.empty')}</Text>
      ) : (
        items.map((item) => (
          <CorrectionItem
            key={item.id}
            item={item}
            onResolved={(done) => setItems((list) => (list ?? []).filter((x) => x.id !== done.id))}
          />
        ))
      )}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)'
  return {
    title: { fontFamily: F.display, fontSize: 21, lineHeight: 25, color: ink, letterSpacing: -0.3 },
    sub: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2, marginBottom: 6 },
    loader: { marginVertical: 12 },
    empty: { fontFamily: F.medium, fontSize: 13, color: muted, paddingVertical: 10 },
    item: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: line, gap: 3 },
    mosque: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: muted },
    topic: { fontFamily: F.bold, fontSize: 14, color: ink },
    suggestion: { fontFamily: F.semi, fontSize: 14, color: ink },
    note: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: muted },
    meta: { fontFamily: F.medium, fontSize: 11.5, color: muted, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    fixBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: ink,
    },
    fixText: { fontFamily: F.bold, fontSize: 13, color: dark ? '#0F1F2E' : '#FFFFFF' },
    dismissBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: chip,
    },
    dismissText: { fontFamily: F.semi, fontSize: 13, color: ink },
    status: { fontFamily: F.semi, fontSize: 12, color: muted, marginTop: 4 },
    dim: { opacity: 0.6 },
  }
})
