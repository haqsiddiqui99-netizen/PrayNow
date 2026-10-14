import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { localeOf } from '@/src/hooks/useMosqueEvents'
import { dateKey } from '@/src/services/prayerTracker'
import {
  JUZ_PAGES,
  QURAN_PAGES,
  daysLeft,
  juzOf,
  loadQuran,
  pagesInLastDays,
  readPages,
  readingStreak,
  setQuranGoal,
  setQuranPage,
  type QuranGoal,
  type QuranStore,
} from '@/src/services/quranTracker'
import { gregorianOf, hijriOf, monthLength } from '@/src/utils/hijriCalendar'

const GOALS: QuranGoal[] = ['ramadan', 'month', 'twoMonths']

function goalDate(kind: QuranGoal, today = new Date()): Date {
  if (kind === 'ramadan') {
    const hijri = hijriOf(today)
    const year = hijri.month <= 9 ? hijri.year : hijri.year + 1
    return gregorianOf({ year, month: 9, day: monthLength(year, 9) })
  }
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  date.setDate(date.getDate() + (kind === 'month' ? 29 : 59))
  return date
}

function fromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export default function QuranScreen() {
  const styles = useStyles()
  const { t, digits, language } = useLanguage()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const onInk = dark ? '#0F1F2E' : '#FFFFFF'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const [store, setStore] = useState<QuranStore | null>(null)
  const [pageDraft, setPageDraft] = useState('')

  useFocusEffect(
    useCallback(() => {
      void loadQuran().then(setStore)
    }, []),
  )

  const today = new Date()
  const page = store?.page ?? 0
  const todayPages = store?.log[dateKey(today)] ?? 0
  const streak = store ? readingStreak(store, today) : 0
  const week = store ? pagesInLastDays(store, 7, today) : 0
  const percent = Math.round((page / QURAN_PAGES) * 100)
  const goal = store?.goal ?? null
  const left = goal ? daysLeft(goal.by, today) : 0
  const perDay = goal && left > 0 ? Math.ceil((QURAN_PAGES - page) / left) : 0
  const prettyDate = useMemo(
    () => (date: Date) => digits(date.toLocaleDateString(localeOf(language), { day: 'numeric', month: 'long' })),
    [digits, language],
  )

  const afterRead = (finished: boolean, next: QuranStore) => {
    setStore(next)
    if (finished) showToast(t('quran.khatamDone'), 'checkmark-circle')
  }

  const add = async (pages: number) => {
    const { store: next, finished } = await readPages(pages)
    afterRead(finished, next)
  }

  const jump = async () => {
    const target = Number(pageDraft.replace(/[^\d]/g, ''))
    if (!pageDraft.trim() || !Number.isFinite(target) || target < 0 || target > QURAN_PAGES) {
      showToast(t('quran.pageRange', { max: QURAN_PAGES }), 'information-circle-outline')
      return
    }
    const { store: next, finished } = await setQuranPage(target)
    setPageDraft('')
    afterRead(finished, next)
  }

  const chooseGoal = async (kind: QuranGoal | null) => {
    const next = await setQuranGoal(kind ? { kind, by: dateKey(goalDate(kind)) } : null)
    setStore(next)
  }

  const goalLabel = (kind: QuranGoal) =>
    kind === 'ramadan' ? t('quran.goalRamadan') : kind === 'month' ? t('quran.goalMonth') : t('quran.goalTwoMonths')

  const goalLine = !goal
    ? t('quran.goalNone')
    : left <= 0
      ? t('quran.goalPassed')
      : t('quran.goalPace', { pages: perDay, date: prettyDate(fromKey(goal.by)) })

  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('quran.title')}</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>{t('quran.juz', { n: juzOf(Math.max(1, page)) })}</Text>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroCount}>
              {digits(page)}
              <Text style={styles.heroOf}> / {digits(QURAN_PAGES)}</Text>
            </Text>
            <Text style={styles.heroSub}>{t('quran.pagesRead', { percent })}</Text>
          </View>
          <View style={styles.streak}>
            <Text style={styles.streakNum}>{digits(streak)}</Text>
            <Text style={styles.streakLabel}>{t('track.streak')}</Text>
          </View>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>{t('quran.today', { n: todayPages })}</Text>
          <Text style={styles.stat}>{t('quran.week', { n: week })}</Text>
          {store?.khatams ? <Text style={styles.stat}>{t('quran.khatams', { n: store.khatams })}</Text> : null}
        </View>
      </View>

      <Text style={styles.section}>{t('quran.log')}</Text>
      <View style={styles.card}>
        <View style={styles.steps}>
          {[
            { pages: 1, label: t('quran.addPage') },
            { pages: 5, label: t('quran.addPages', { n: 5 }) },
            { pages: JUZ_PAGES, label: t('quran.addJuz') },
          ].map((step) => (
            <Pressable
              key={step.pages}
              onPress={() => void add(step.pages)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
              <Ionicons name="add" size={16} color={onInk} />
              <Text style={styles.stepText}>{step.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.jumpRow}>
          <TextInput
            style={styles.input}
            value={pageDraft}
            onChangeText={setPageDraft}
            placeholder={t('quran.pagePh')}
            placeholderTextColor={muted}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => void jump()}
            maxLength={3}
          />
          <Pressable onPress={() => void jump()} style={styles.jumpBtn} accessibilityRole="button">
            <Text style={styles.jumpText}>{t('quran.setPage')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void add(-1)}
            disabled={page === 0}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('quran.undoA11y')}
            style={[styles.undo, page === 0 && styles.off]}>
            <Ionicons name="arrow-undo" size={16} color={ink} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>{t('quran.goal')}</Text>
      <View style={styles.card}>
        <View style={styles.chips}>
          {GOALS.map((kind) => {
            const on = goal?.kind === kind
            return (
              <Pressable
                key={kind}
                onPress={() => void chooseGoal(on ? null : kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{goalLabel(kind)}</Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={styles.goalLine}>{goalLine}</Text>
      </View>
      <Text style={styles.footnote}>{t('quran.footnote')}</Text>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const onInk = dark ? '#0F1F2E' : '#FFFFFF'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const card = dark ? '#122027' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const chip = dark ? '#1C3330' : '#F3F1EC'
  return {
    page: { flex: 1, backgroundColor: dark ? '#0C1818' : '#F6F4F0' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: card },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: ink, letterSpacing: -0.3 },
    hero: { marginHorizontal: 12, padding: 18, borderRadius: 26, backgroundColor: card, borderWidth: 1, borderColor: line },
    kicker: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: muted },
    heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
    heroCount: { fontFamily: 'Newsreader_600SemiBold', fontSize: 48, lineHeight: 52, color: ink },
    heroOf: { fontFamily: 'Newsreader_500Medium', fontSize: 22, color: muted },
    heroSub: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, marginTop: 2 },
    streak: { alignItems: 'flex-end', paddingBottom: 6 },
    streakNum: { fontFamily: 'Newsreader_600SemiBold', fontSize: 32, lineHeight: 36, color: ink },
    streakLabel: { fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: muted },
    bar: { height: 8, borderRadius: 4, backgroundColor: chip, marginTop: 16, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4, backgroundColor: ink },
    stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 12 },
    stat: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: ink },
    section: {
      marginTop: 18,
      marginBottom: 8,
      marginHorizontal: 16,
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
    },
    card: { marginHorizontal: 12, padding: 14, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line },
    steps: { flexDirection: 'row', gap: 8 },
    stepBtn: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: ink,
    },
    stepText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: onInk },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    jumpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    input: {
      flex: 1,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: chip,
      fontFamily: 'Figtree_600SemiBold',
      fontSize: 15,
      color: ink,
    },
    jumpBtn: { height: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    jumpText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    undo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    off: { opacity: 0.35 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: ink },
    chipText: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: ink },
    chipTextOn: { color: onInk },
    goalLine: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, lineHeight: 20, color: ink, marginTop: 12 },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 12 },
  }
})
