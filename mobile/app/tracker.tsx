import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  TRACKED_PRAYERS,
  adjustQaza,
  countDone,
  loadQaza,
  qazaBalance,
  type QazaStore,
  dateKey,
  isComplete,
  loadTracker,
  streakOf,
  toggleTrackedPrayer,
  type TrackerStore,
  weekSummary,
} from '@/src/services/prayerTracker'
import { loadQuran, pagesInLastDays } from '@/src/services/quranTracker'
import type { PrayerName } from '@/src/types'

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export default function TrackerScreen() {
  const styles = useStyles()
  const { t, prayerName, language, digits } = useLanguage()
  const locale = language === 'hi' ? 'hi-IN' : language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar' : 'en-US'
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { config } = useCityPrayer()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const [store, setStore] = useState<TrackerStore>({})
  const today = useMemo(() => new Date(), [])
  const todayLog = store[dateKey(today)]
  const done = countDone(todayLog)
  const streak = streakOf(store, today)
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)), [today])

  const [qaza, setQaza] = useState<QazaStore>({ added: {}, madeUp: {} })
  const balance = useMemo(() => qazaBalance(store, qaza, today), [store, qaza, today])
  const qazaTotal = TRACKED_PRAYERS.reduce((sum, name) => sum + balance[name], 0)
  const summary = useMemo(() => weekSummary(store, qaza, today), [store, qaza, today])
  const [quranWeek, setQuranWeek] = useState(0)
  const delta = summary.offered - summary.previous
  const trendIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'remove'
  const trendText =
    delta > 0 ? t('week.up', { n: delta }) : delta < 0 ? t('week.down', { n: -delta }) : t('week.same')

  useFocusEffect(
    useCallback(() => {
      void loadTracker().then(setStore)
      void loadQaza().then(setQaza)
      void loadQuran().then((quran) => setQuranWeek(pagesInLastDays(quran, 7)))
    }, []),
  )

  const onQaza = async (name: PrayerName, action: 'made' | 'add') => {
    setQaza(await adjustQaza(name, action))
    showToast(
      t(action === 'made' ? 'qaza.madeToast' : 'qaza.addedToast', { name: prayerName(name) }),
      action === 'made' ? 'checkmark-circle' : 'information-circle-outline',
    )
  }

  const times = useMemo(() => {
    const map = new Map<PrayerName, string>()
    for (const slot of config.prayerSchedule) map.set(slot.name, slot.start)
    return map
  }, [config])

  const toggle = async (name: PrayerName) => {
    const next = await toggleTrackedPrayer(name, today)
    setStore(next)
    const on = Boolean(next[dateKey(today)]?.[name])
    showToast(on ? t('track.marked', { name: prayerName(name) }) : t('track.cleared', { name: prayerName(name) }), on ? 'checkmark-circle' : 'information-circle-outline')
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('track.title')}</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>
          {digits(today.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))}
        </Text>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroCount}>
              {digits(done)}
              <Text style={styles.heroOf}> / {digits(5)}</Text>
            </Text>
            <Text style={styles.heroSub}>{done === 5 ? t('track.allFive') : t('track.offered')}</Text>
          </View>
          <View style={styles.streak}>
            <Text style={styles.streakNum}>{digits(streak)}</Text>
            <Text style={styles.streakLabel}>{t('track.streak')}</Text>
          </View>
        </View>
        <View style={styles.pips}>
          {TRACKED_PRAYERS.map((name) => (
            <View key={name} style={[styles.pip, todayLog?.[name] && styles.pipOn]} />
          ))}
        </View>
      </View>

      <View style={styles.week}>
        {week.map((day) => {
          const key = dateKey(day)
          const complete = isComplete(store[key])
          const partial = countDone(store[key]) > 0 && !complete
          const isToday = key === dateKey(today)
          return (
            <View key={key} style={styles.weekDay}>
              <Text style={[styles.weekLabel, isToday && styles.weekLabelOn]}>
                {day.toLocaleDateString(locale, { weekday: 'narrow' })}
              </Text>
              <View style={[styles.weekDot, complete && styles.weekDotOn, partial && styles.weekDotPartial, isToday && styles.weekDotToday]}>
                <Text style={[styles.weekNum, complete && styles.weekNumOn]}>{digits(day.getDate())}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <View style={styles.list}>
        {TRACKED_PRAYERS.map((name, index) => {
          const on = Boolean(todayLog?.[name])
          return (
            <Pressable
              key={name}
              onPress={() => void toggle(name)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              style={[styles.row, index > 0 && styles.rowLine]}>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Ionicons name="checkmark" size={16} color={dark ? '#0F1F2E' : '#FFFFFF'} /> : null}
              </View>
              <Text style={[styles.prayer, on && styles.prayerOn]}>{prayerName(name)}</Text>
              <Text style={styles.time}>{digits(times.get(name) || '')}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.footnote}>{t('track.footnote')}</Text>

      <View style={styles.qazaHead}>
        <Text style={styles.qazaTitle}>{t('week.title')}</Text>
      </View>
      <View style={styles.summary}>
        {summary.offered === 0 && summary.qazaMade === 0 && quranWeek === 0 ? (
          <Text style={styles.summaryEmpty}>{t('week.empty')}</Text>
        ) : (
          <>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.summaryCount}>
                  {digits(summary.offered)}
                  <Text style={styles.heroOf}> / {digits(35)}</Text>
                </Text>
                <Text style={styles.heroSub}>{t('week.offered')}</Text>
              </View>
              {summary.previous > 0 ? (
                <View style={styles.trend}>
                  <Ionicons name={trendIcon} size={14} color={ink} />
                  <Text style={styles.trendText}>{trendText}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bars}>
              {TRACKED_PRAYERS.map((name) => {
                const count = summary.perPrayer[name]
                return (
                  <View
                    key={name}
                    style={styles.barCol}
                    accessible
                    accessibilityLabel={t('week.prayerA11y', { name: prayerName(name), count })}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${(count / 7) * 100}%` }]} />
                    </View>
                    <Text style={styles.barNum}>{digits(count)}</Text>
                    <Text style={styles.barLabel} numberOfLines={1}>{prayerName(name)}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.facts}>
              {summary.offered === 35 ? (
                <Text style={styles.fact}>{t('week.perfect')}</Text>
              ) : (
                <>
                  {summary.fullDays > 0 ? (
                    <Text style={styles.fact}>
                      {summary.fullDays === 1 ? t('week.fullDay') : t('week.fullDays', { n: summary.fullDays })}
                    </Text>
                  ) : null}
                  {summary.weakest ? (
                    <Text style={styles.fact}>
                      {t('week.focus', { name: prayerName(summary.weakest), count: summary.perPrayer[summary.weakest] })}
                    </Text>
                  ) : null}
                </>
              )}
              {summary.qazaMade > 0 ? <Text style={styles.fact}>{t('week.qaza', { n: summary.qazaMade })}</Text> : null}
              {quranWeek > 0 ? <Text style={styles.fact}>{t('week.quran', { n: quranWeek })}</Text> : null}
            </View>
          </>
        )}
      </View>

      <View style={styles.qazaHead}>
        <Text style={styles.qazaTitle}>{t('qaza.title')}</Text>
        <Text style={styles.qazaTotal}>{t('qaza.total', { n: qazaTotal })}</Text>
      </View>
      <View style={styles.list}>
        {TRACKED_PRAYERS.map((name, index) => {
          const owed = balance[name]
          return (
            <View key={name} style={[styles.row, index > 0 && styles.rowLine]}>
              <Text style={styles.prayer}>{prayerName(name)}</Text>
              <Text style={[styles.qazaCount, owed === 0 && styles.qazaClear]}>{digits(owed)}</Text>
              <Pressable
                onPress={() => void onQaza(name, 'made')}
                disabled={owed === 0}
                accessibilityRole="button"
                accessibilityLabel={t('qaza.madeA11y', { name: prayerName(name) })}
                style={[styles.qazaBtn, styles.qazaBtnMain, owed === 0 && styles.qazaBtnOff]}>
                <Ionicons name="checkmark" size={15} color={dark ? '#0F1F2E' : '#FFFFFF'} />
                <Text style={styles.qazaBtnText}>{t('qaza.made')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void onQaza(name, 'add')}
                accessibilityRole="button"
                accessibilityLabel={t('qaza.addA11y', { name: prayerName(name) })}
                hitSlop={6}
                style={styles.qazaBtn}>
                <Ionicons name="add" size={18} color={ink} />
              </Pressable>
            </View>
          )
        })}
      </View>
      <Text style={styles.footnote}>{t('qaza.footnote')}</Text>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
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
    pips: { flexDirection: 'row', gap: 6, marginTop: 16 },
    pip: { flex: 1, height: 6, borderRadius: 3, backgroundColor: chip },
    pipOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    week: {
      flexDirection: 'row',
      marginHorizontal: 12,
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 22,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
    },
    weekDay: { flex: 1, alignItems: 'center', gap: 6 },
    weekLabel: { fontFamily: 'Figtree_700Bold', fontSize: 11, color: muted },
    weekLabelOn: { color: ink },
    weekDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    weekDotOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    weekDotPartial: { backgroundColor: chip },
    weekDotToday: { borderWidth: 1.5, borderColor: dark ? '#EAF3F0' : '#0F1F2E' },
    weekNum: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: ink },
    weekNumOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    list: { marginHorizontal: 12, marginTop: 12, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
    rowLine: { borderTopWidth: 1, borderTopColor: line },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: dark ? '#3A4E4A' : '#D5DBE3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E', borderColor: dark ? '#EAF3F0' : '#0F1F2E' },
    prayer: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 16, color: ink },
    prayerOn: { color: muted },
    time: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: muted },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 12 },
    qazaHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 26 },
    qazaTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, color: ink, letterSpacing: -0.2 },
    qazaTotal: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: muted },
    qazaCount: { minWidth: 28, textAlign: 'right', fontFamily: 'Figtree_800ExtraBold', fontSize: 16, color: ink },
    qazaClear: { color: muted, fontFamily: 'Figtree_600SemiBold' },
    qazaBtn: {
      height: 32,
      minWidth: 32,
      paddingHorizontal: 8,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: chip,
    },
    summary: { marginHorizontal: 12, marginTop: 12, padding: 18, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line },
    summaryEmpty: { fontFamily: 'Figtree_500Medium', fontSize: 14, lineHeight: 20, color: muted },
    summaryCount: { fontFamily: 'Newsreader_600SemiBold', fontSize: 40, lineHeight: 44, color: ink },
    trend: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: chip, marginBottom: 6, maxWidth: '55%' },
    trendText: { flexShrink: 1, fontFamily: 'Figtree_700Bold', fontSize: 12, color: ink },
    bars: { flexDirection: 'row', gap: 8, marginTop: 18 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barTrack: { width: '100%', height: 56, borderRadius: 8, backgroundColor: chip, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 8, backgroundColor: ink },
    barNum: { fontFamily: 'Figtree_800ExtraBold', fontSize: 13, color: ink, marginTop: 2 },
    barLabel: { fontFamily: 'Figtree_600SemiBold', fontSize: 11, color: muted },
    facts: { marginTop: 14, gap: 6 },
    fact: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, lineHeight: 18, color: ink },
    qazaBtnMain: { paddingHorizontal: 12, backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    qazaBtnOff: { opacity: 0.35 },
    qazaBtnText: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: dark ? '#0F1F2E' : '#FFFFFF' },
  }
})
