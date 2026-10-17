import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native'
import { showToast } from '@/src/components/AppToast'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { TranslationKey } from '@/src/i18n/translations'
import {
  createNeed,
  deleteNeed,
  fetchManagerNeeds,
  fetchMosqueNeeds,
  updateNeed,
  type MosqueNeed,
  type NeedKind,
} from '@/src/services/api'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
} as const

const KINDS: { id: NeedKind; label: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'volunteers', label: 'needs.kindVolunteers', icon: 'people-outline' },
  { id: 'fundraising', label: 'needs.kindFundraising', icon: 'heart-outline' },
  { id: 'items', label: 'needs.kindItems', icon: 'cube-outline' },
  { id: 'other', label: 'needs.kindOther', icon: 'hand-left-outline' },
]
const kindOf = (id: NeedKind) => KINDS.find((k) => k.id === id) ?? KINDS[3]

/** Opens a need's link in the browser; only https links are ever stored. */
function openLink(link: string) {
  if (!/^https:\/\//i.test(link)) return
  void Linking.openURL(link)
}

/** "How you can help" on the mosque page. Renders nothing when the mosque has no open needs. */
export function MosqueNeedsSection({ mosqueId }: { mosqueId: string }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t } = useLanguage()
  const [needs, setNeeds] = useState<MosqueNeed[]>([])
  const ink = mode === 'dark' ? '#EAF3F0' : '#0F1F2E'

  useEffect(() => {
    let alive = true
    fetchMosqueNeeds(mosqueId)
      .then((list) => alive && setNeeds(list))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mosqueId])

  if (!needs.length) return null

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t('needs.title')}</Text>
      {needs.map((need) => {
        const kind = kindOf(need.kind)
        return (
          <View key={need.id} style={styles.item}>
            <View style={styles.icon}>
              <Ionicons name={kind.icon} size={15} color={ink} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.kind}>{t(kind.label)}</Text>
              <Text style={styles.name}>{need.title}</Text>
              {need.details ? <Text style={styles.details}>{need.details}</Text> : null}
              {need.link ? (
                <Pressable onPress={() => openLink(need.link)} accessibilityRole="link" style={styles.linkBtn}>
                  <Text style={styles.linkText}>{need.kind === 'fundraising' ? t('needs.donate') : t('needs.openLink')}</Text>
                  <Ionicons name="open-outline" size={13} color={ink} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )
      })}
      <Text style={styles.footnote}>{t('needs.footnote')}</Text>
    </View>
  )
}

/** Mosque admin panel: add, close, reopen and remove needs. */
export function MosqueNeedsManager({ mosqueId }: { mosqueId: string }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t } = useLanguage()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'

  const [needs, setNeeds] = useState<MosqueNeed[]>([])
  const [kind, setKind] = useState<NeedKind>('volunteers')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      setNeeds(await fetchManagerNeeds(mosqueId))
    } catch {}
  }, [mosqueId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = async () => {
    if (!title.trim()) {
      setMessage(t('needs.needTitle'))
      return
    }
    const cleanLink = link.trim()
    if (cleanLink && !/^https:\/\//i.test(cleanLink)) {
      setMessage(t('needs.httpsOnly'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await createNeed(mosqueId, { kind, title: title.trim(), details: details.trim(), link: cleanLink })
      setTitle('')
      setDetails('')
      setLink('')
      showToast(t('needs.added'), 'checkmark-circle')
      await refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('needs.saveFail'))
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (need: MosqueNeed, status: 'open' | 'closed') => {
    try {
      await updateNeed(mosqueId, need.id, { status })
      await refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('needs.saveFail'))
    }
  }

  const remove = async (need: MosqueNeed) => {
    try {
      await deleteNeed(mosqueId, need.id)
      await refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('needs.saveFail'))
    }
  }

  return (
    <View>
      <Text style={styles.title}>{t('needs.manageTitle')}</Text>
      <Text style={styles.sub}>{t('needs.manageSub')}</Text>

      {needs.map((need) => {
        const open = need.status === 'open'
        return (
          <View key={need.id} style={[styles.row, !open && styles.dim]}>
            <View style={styles.icon}>
              <Ionicons name={kindOf(need.kind).icon} size={15} color={ink} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>
                {need.title}
              </Text>
              <Text style={styles.kind}>{open ? t(kindOf(need.kind).label) : t('needs.closed')}</Text>
            </View>
            <Pressable
              onPress={() => void setStatus(need, open ? 'closed' : 'open')}
              accessibilityRole="button"
              style={styles.smallBtn}>
              <Text style={styles.smallText}>{open ? t('needs.close') : t('needs.reopen')}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => void remove(need)} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
              <Ionicons name="trash-outline" size={17} color="#C2321F" />
            </Pressable>
          </View>
        )
      })}

      <View style={[styles.chips, styles.chipsGap]}>
        {KINDS.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => setKind(k.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k.id }}
            style={[styles.chip, kind === k.id && styles.chipOn]}>
            <Ionicons name={k.icon} size={14} color={kind === k.id ? (dark ? '#0F1F2E' : '#FFFFFF') : ink} />
            <Text style={[styles.chipText, kind === k.id && styles.chipTextOn]}>{t(k.label)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('needs.titlePh')}
        placeholderTextColor={muted}
        maxLength={160}
      />
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={details}
        onChangeText={setDetails}
        placeholder={t('needs.detailsPh')}
        placeholderTextColor={muted}
        multiline
        maxLength={1000}
      />
      <TextInput
        style={styles.input}
        value={link}
        onChangeText={setLink}
        placeholder={t('needs.linkPh')}
        placeholderTextColor={muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />
      <Pressable style={[styles.addBtn, busy && styles.dim]} disabled={busy} onPress={() => void add()}>
        {busy ? (
          <ActivityIndicator color={dark ? '#0F1F2E' : '#FFFFFF'} />
        ) : (
          <>
            <Ionicons name="add" size={17} color={dark ? '#0F1F2E' : '#FFFFFF'} />
            <Text style={styles.addText}>{t('needs.add')}</Text>
          </>
        )}
      </Pressable>
      {message ? <Text style={styles.note}>{message}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ mode, colors }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)'
  return {
    card: { backgroundColor: colors.surface2, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
    kicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: muted },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    kind: { fontFamily: F.semi, fontSize: 11.5, color: muted },
    name: { fontFamily: F.bold, fontSize: 14, color: ink },
    details: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: muted },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: chip,
    },
    linkText: { fontFamily: F.bold, fontSize: 12.5, color: ink },
    footnote: { fontFamily: F.medium, fontSize: 11, lineHeight: 15, color: muted },
    title: { fontFamily: F.display, fontSize: 21, lineHeight: 25, color: ink, letterSpacing: -0.3 },
    sub: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
    smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: chip },
    smallText: { fontFamily: F.semi, fontSize: 12, color: ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipsGap: { marginTop: 12 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: ink },
    chipText: { fontFamily: F.semi, fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    input: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: chip,
      fontFamily: F.medium,
      fontSize: 14,
      color: ink,
    },
    inputMulti: { minHeight: 60, textAlignVertical: 'top' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 46,
      marginTop: 16,
      borderRadius: 23,
      backgroundColor: ink,
    },
    addText: { fontFamily: F.bold, fontSize: 15, color: dark ? '#0F1F2E' : '#FFFFFF' },
    dim: { opacity: 0.6 },
    note: { fontFamily: F.semi, fontSize: 12.5, lineHeight: 17, color: ink, marginTop: 10 },
  }
})
