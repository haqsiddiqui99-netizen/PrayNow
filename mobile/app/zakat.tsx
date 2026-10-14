import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { TranslationKey } from '@/src/i18n/translations'

const KEY = 'praynow.zakat.v1'
/** 52.5 tola of silver and 7.5 tola of gold. */
const NISAB_GRAMS = { silver: 612.36, gold: 87.48 } as const
const RATE = 0.025

type Basis = keyof typeof NISAB_GRAMS
type FieldId =
  | 'goldGrams'
  | 'goldPrice'
  | 'silverGrams'
  | 'silverPrice'
  | 'cash'
  | 'bank'
  | 'business'
  | 'receivable'
  | 'debts'

const SECTIONS: Array<{ title: TranslationKey; fields: Array<{ id: FieldId; label: TranslationKey; unit?: TranslationKey }> }> = [
  {
    title: 'zakat.metals',
    fields: [
      { id: 'goldGrams', label: 'zakat.goldGrams', unit: 'zakat.grams' },
      { id: 'goldPrice', label: 'zakat.goldPrice' },
      { id: 'silverGrams', label: 'zakat.silverGrams', unit: 'zakat.grams' },
      { id: 'silverPrice', label: 'zakat.silverPrice' },
    ],
  },
  {
    title: 'zakat.money',
    fields: [
      { id: 'cash', label: 'zakat.cash' },
      { id: 'bank', label: 'zakat.bank' },
      { id: 'business', label: 'zakat.business' },
      { id: 'receivable', label: 'zakat.receivable' },
    ],
  },
  { title: 'zakat.deduct', fields: [{ id: 'debts', label: 'zakat.debts' }] },
]

const amountOf = (value: string | undefined) => {
  const parsed = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function ZakatScreen() {
  const styles = useStyles()
  const { t, digits } = useLanguage()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const [values, setValues] = useState<Partial<Record<FieldId, string>>>({})
  const [basis, setBasis] = useState<Basis>('silver')
  const loaded = useRef(false)

  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : null
        if (parsed?.values && typeof parsed.values === 'object') setValues(parsed.values)
        if (parsed?.basis === 'gold' || parsed?.basis === 'silver') setBasis(parsed.basis)
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true
      })
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    void AsyncStorage.setItem(KEY, JSON.stringify({ values, basis })).catch(() => {})
  }, [values, basis])

  const money = (amount: number) => digits(Math.round(amount).toLocaleString('en-IN'))
  const v = (id: FieldId) => amountOf(values[id])
  const wealth =
    v('goldGrams') * v('goldPrice') +
    v('silverGrams') * v('silverPrice') +
    v('cash') +
    v('bank') +
    v('business') +
    v('receivable') -
    v('debts')
  const price = basis === 'silver' ? v('silverPrice') : v('goldPrice')
  const nisab = NISAB_GRAMS[basis] * price
  const due = price > 0 && wealth >= nisab ? wealth * RATE : 0
  const metal = basis === 'silver' ? t('zakat.silver') : t('zakat.gold')

  const verdict =
    price <= 0
      ? t('zakat.needPrice', { metal })
      : wealth <= 0
        ? t('zakat.start')
        : wealth >= nisab
          ? t('zakat.due')
          : t('zakat.below')

  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('zakat.title')}</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>{t('zakat.payable')}</Text>
        <Text style={styles.heroCount}>{money(due)}</Text>
        <Text style={styles.verdict}>{verdict}</Text>
        <View style={styles.lines}>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>{t('zakat.wealth')}</Text>
            <Text style={styles.lineValue}>{money(Math.max(0, wealth))}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>{t('zakat.nisab', { grams: digits(NISAB_GRAMS[basis]), metal })}</Text>
            <Text style={styles.lineValue}>{price > 0 ? money(nisab) : '—'}</Text>
          </View>
        </View>
        <View style={styles.basis}>
          {(['silver', 'gold'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setBasis(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: basis === option }}
              style={[styles.chip, basis === option && styles.chipOn]}>
              <Text style={[styles.chipText, basis === option && styles.chipTextOn]}>
                {option === 'silver' ? t('zakat.bySilver') : t('zakat.byGold')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={styles.section}>{t(section.title)}</Text>
          <View style={styles.card}>
            {section.fields.map((field, index) => (
              <View key={field.id} style={[styles.field, index > 0 && styles.fieldLine]}>
                <Text style={styles.fieldLabel}>{t(field.label)}</Text>
                <TextInput
                  style={styles.input}
                  value={values[field.id] ?? ''}
                  onChangeText={(text) => setValues((prev) => ({ ...prev, [field.id]: text.replace(/[^\d.]/g, '') }))}
                  placeholder="0"
                  placeholderTextColor={muted}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t(field.label)}
                />
                <Text style={styles.unit}>{field.unit ? t(field.unit) : ''}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Pressable onPress={() => setValues({})} style={styles.clear} accessibilityRole="button">
        <Ionicons name="refresh" size={14} color={muted} />
        <Text style={styles.clearText}>{t('zakat.clear')}</Text>
      </Pressable>
      <Text style={styles.footnote}>{t('zakat.footnote')}</Text>
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
    kicker: { fontFamily: 'Figtree_700Bold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: muted },
    heroCount: { fontFamily: 'Newsreader_600SemiBold', fontSize: 44, lineHeight: 50, color: ink, marginTop: 4 },
    verdict: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, lineHeight: 20, color: ink, marginTop: 2 },
    lines: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: line, gap: 6 },
    lineRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    lineLabel: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 13, color: muted },
    lineValue: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: ink },
    basis: { flexDirection: 'row', gap: 8, marginTop: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: ink },
    chipText: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: ink },
    chipTextOn: { color: onInk },
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
    card: { marginHorizontal: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: card, borderWidth: 1, borderColor: line },
    field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    fieldLine: { borderTopWidth: 1, borderTopColor: line },
    fieldLabel: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: ink },
    input: {
      width: 130,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: chip,
      textAlign: 'right',
      fontFamily: 'Figtree_700Bold',
      fontSize: 15,
      color: ink,
    },
    unit: { minWidth: 18, fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: muted },
    clear: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 16, padding: 6 },
    clearText: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: muted },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 8 },
  }
})
