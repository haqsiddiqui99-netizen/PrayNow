import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { AFTER_SALAH, DHIKR, DUAS, DUA_CATEGORIES, type Dua, type DhikrId } from '@/src/data/duas'
import { countOnce, loadTasbih, resetRound, saveTasbih, type TasbihStore } from '@/src/services/tasbih'

type Tab = 'tasbih' | 'duas'

function tap(kind: 'count' | 'done') {
  if (Platform.OS === 'web') return
  if (kind === 'done') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  else void Haptics.selectionAsync().catch(() => {})
}

export default function DuasScreen() {
  const styles = useStyles()
  const { t } = useLanguage()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const ink = mode === 'dark' ? '#EAF3F0' : '#0F1F2E'
  const [tab, setTab] = useState<Tab>('tasbih')

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('more.duas')}</Text>
      </View>
      <View style={styles.seg} accessibilityRole="tablist">
        {(['tasbih', 'duas'] as const).map((key) => {
          const on = tab === key
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segBtn, on && styles.segBtnOn]}>
              <Text style={[styles.segText, on && styles.segTextOn]}>
                {key === 'tasbih' ? t('duas.tabTasbih') : t('duas.tabDuas')}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        {tab === 'tasbih' ? <TasbihPanel /> : <DuaList />}
      </ScrollView>
    </View>
  )
}

function TasbihPanel() {
  const styles = useStyles()
  const { t, digits } = useLanguage()
  const { mode } = useTheme()
  const muted = mode === 'dark' ? '#9DBAB4' : '#5A6676'
  const inkInverse = mode === 'dark' ? '#0F1F2E' : '#FFFFFF'
  const [store, setStore] = useState<TasbihStore | null>(null)

  useFocusEffect(
    useCallback(() => {
      void loadTasbih().then(setStore)
    }, []),
  )

  const current = DHIKR.find((d) => d.id === store?.current) ?? DHIKR[0]
  const count = store?.counts[current.id] ?? 0
  const complete = count >= current.target
  const progress = Math.min(1, count / current.target)
  const nextId = AFTER_SALAH[AFTER_SALAH.indexOf(current.id) + 1]
  const next = complete && nextId ? DHIKR.find((d) => d.id === nextId) : undefined

  const update = (nextStore: TasbihStore) => {
    setStore(nextStore)
    saveTasbih(nextStore)
  }
  const choose = (id: DhikrId) => store && update({ ...store, current: id })
  const onCount = () => {
    if (!store) return
    const updated = countOnce(store, current.id)
    tap((updated.counts[current.id] ?? 0) === current.target ? 'done' : 'count')
    update(updated)
  }
  const onReset = () => store && update(resetRound(store, current.id))

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {DHIKR.map((item) => {
          const on = item.id === current.id
          return (
            <Pressable
              key={item.id}
              onPress={() => choose(item.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(item.name)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.arabicBig}>{current.arabic}</Text>
        <Text style={styles.meaning}>{t(current.meaning)}</Text>

        <Pressable
          onPress={onCount}
          accessibilityRole="button"
          accessibilityLabel={t('tasbih.countA11y', { name: t(current.name), count, target: current.target })}
          style={({ pressed }) => [styles.counter, complete && styles.counterDone, pressed && styles.counterPressed]}>
          <Text style={[styles.count, complete && styles.countDone]}>{digits(count)}</Text>
          <Text style={[styles.countOf, complete && styles.countDone]}>{t('tasbih.of', { target: current.target })}</Text>
        </Pressable>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.hint}>{complete ? t('tasbih.done', { name: t(current.name) }) : t('tasbih.tap')}</Text>

        {next ? (
          <Pressable onPress={() => choose(next.id)} accessibilityRole="button" style={styles.nextBtn}>
            <Text style={styles.nextText}>{t('tasbih.next', { name: t(next.name) })}</Text>
            <Ionicons name="arrow-forward" size={16} color={inkInverse} />
          </Pressable>
        ) : null}

        <View style={styles.statsRow}>
          <Text style={styles.stat}>{t('tasbih.today', { count: store?.today ?? 0 })}</Text>
          <Text style={styles.stat}>{t('tasbih.total', { count: store?.total ?? 0 })}</Text>
          <Pressable
            onPress={onReset}
            disabled={count === 0}
            accessibilityRole="button"
            accessibilityLabel={t('tasbih.resetA11y', { name: t(current.name) })}
            hitSlop={8}
            style={[styles.reset, count === 0 && styles.resetOff]}>
            <Ionicons name="refresh" size={14} color={muted} />
            <Text style={styles.stat}>{t('tasbih.reset')}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.footnote}>{t('tasbih.afterSalah')}</Text>
    </View>
  )
}

function DuaList() {
  const styles = useStyles()
  const { t, language } = useLanguage()
  const { mode } = useTheme()
  const muted = mode === 'dark' ? '#9DBAB4' : '#5A6676'
  // Urdu and Arabic readers read the Arabic script directly.
  const showLatin = language === 'en' || language === 'hi'
  const groups = useMemo(
    () => DUA_CATEGORIES.map((cat) => ({ ...cat, items: DUAS.filter((d) => d.category === cat.id) })),
    [],
  )

  const sourceOf = (dua: Dua) => t(`src.${dua.source.book}` as const, { n: dua.source.ref })
  const share = (dua: Dua) => {
    const meaning = t(dua.meaning)
    const parts = [t(dua.title), dua.arabic, showLatin ? dua.transliteration : '', meaning, sourceOf(dua)]
    void Share.share({ message: parts.filter(Boolean).join('\n\n') }).catch(() => {})
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.id}>
          <Text style={styles.section}>{t(group.label)}</Text>
          {group.items.map((dua) => {
            const meaning = t(dua.meaning)
            return (
              <View key={dua.id} style={styles.duaCard}>
                <View style={styles.duaHead}>
                  <Text style={styles.duaTitle}>{t(dua.title)}</Text>
                  <Pressable
                    onPress={() => share(dua)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('duas.shareA11y', { name: t(dua.title) })}>
                    <Ionicons name="share-outline" size={18} color={muted} />
                  </Pressable>
                </View>
                <Text style={styles.arabic}>{dua.arabic}</Text>
                {showLatin ? <Text style={styles.latin}>{dua.transliteration}</Text> : null}
                {meaning ? <Text style={styles.duaMeaning}>{meaning}</Text> : null}
                <Text style={styles.source}>{sourceOf(dua)}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const inkInverse = dark ? '#0F1F2E' : '#FFFFFF'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const card = dark ? '#122027' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const chip = dark ? '#1C3330' : '#F3F1EC'
  return {
    page: { flex: 1, backgroundColor: dark ? '#0C1818' : '#F6F4F0' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: card },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: ink, letterSpacing: -0.3 },
    seg: { flexDirection: 'row', marginHorizontal: 12, padding: 4, borderRadius: 16, backgroundColor: chip, marginBottom: 12 },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
    segBtnOn: { backgroundColor: card },
    segText: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: muted },
    segTextOn: { color: ink },
    chips: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: card, borderWidth: 1, borderColor: line },
    chipOn: { backgroundColor: ink, borderColor: ink },
    chipText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    chipTextOn: { color: inkInverse },
    card: {
      marginHorizontal: 12,
      padding: 18,
      borderRadius: 26,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
    },
    arabicBig: { fontSize: 34, lineHeight: 54, color: ink, textAlign: 'center', writingDirection: 'rtl' },
    meaning: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted, textAlign: 'center', marginTop: 2 },
    counter: {
      width: 208,
      height: 208,
      borderRadius: 104,
      marginTop: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
      borderWidth: 2,
      borderColor: line,
    },
    counterDone: { backgroundColor: ink, borderColor: ink },
    counterPressed: { transform: [{ scale: 0.97 }] },
    count: { fontFamily: 'Newsreader_600SemiBold', fontSize: 64, lineHeight: 70, color: ink },
    countOf: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: muted },
    countDone: { color: inkInverse },
    bar: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: chip, marginTop: 20, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: ink },
    hint: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: muted, marginTop: 10 },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: ink,
    },
    nextText: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: inkInverse },
    statsRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: line,
    },
    stat: { fontFamily: 'Figtree_600SemiBold', fontSize: 12.5, color: muted },
    reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    resetOff: { opacity: 0.4 },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 12 },
    section: {
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.4,
      color: muted,
      textTransform: 'uppercase',
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 8,
    },
    duaCard: { marginHorizontal: 12, marginBottom: 10, padding: 16, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line },
    duaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    duaTitle: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 15, color: ink },
    arabic: { fontSize: 24, lineHeight: 42, color: ink, textAlign: 'right', writingDirection: 'rtl', marginTop: 10 },
    latin: { fontFamily: 'Figtree_500Medium', fontStyle: 'italic', fontSize: 13, lineHeight: 19, color: muted, marginTop: 6 },
    duaMeaning: { fontFamily: 'Figtree_500Medium', fontSize: 14, lineHeight: 20, color: ink, marginTop: 8 },
    source: { fontFamily: 'Figtree_600SemiBold', fontSize: 11.5, color: muted, marginTop: 10 },
  }
})
