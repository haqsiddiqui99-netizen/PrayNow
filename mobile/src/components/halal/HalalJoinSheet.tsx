import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { HALAL_CATEGORIES } from '@/src/constants/halalCategories'
import { paperColors } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { submitHalalListingRequest, type HalalCategory } from '@/src/services/api'

type Props = {
  visible: boolean
  city: string
  initialCategory: HalalCategory | null
  initialFeatured: boolean
  onClose: () => void
}

export function HalalJoinSheet({ visible, city, initialCategory, initialFeatured, onClose }: Props) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t } = useLanguage()
  const { user } = useAuth()
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState<HalalCategory>('restaurant')
  const [cityText, setCityText] = useState(city)
  const [area, setArea] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [wantsFeatured, setWantsFeatured] = useState(initialFeatured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setCategory(initialCategory ?? 'restaurant')
    setWantsFeatured(initialFeatured)
    setCityText((current) => current || city)
    setContactName((current) => current || user?.name || '')
    setPhone((current) => current || user?.mobile || '')
    setError('')
  }, [visible, initialCategory, initialFeatured, city, user?.name, user?.mobile])

  const send = async () => {
    if (!businessName.trim()) return setError(t('halal.needName'))
    if (phone.replace(/\D/g, '').length < 8) return setError(t('halal.needPhone'))
    setBusy(true)
    setError('')
    try {
      await submitHalalListingRequest({
        businessName: businessName.trim(),
        category,
        city: cityText.trim(),
        area: area.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        note: note.trim(),
        wantsFeatured,
      })
      setBusinessName('')
      setArea('')
      setNote('')
      onClose()
      showToast(t('halal.sent'))
    } catch {
      setError(t('halal.sendFail'))
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, value: string, onChange: (text: string) => void, extra?: object) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholderTextColor={paper.faint}
        {...extra}
      />
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <MaterialCommunityIcons name="store-plus-outline" size={22} color="#1C140C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('halal.joinTitle')}</Text>
              <Text style={styles.sub}>{t('halal.joinSub')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={paper.muted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
            {field(t('halal.fBusiness'), businessName, setBusinessName, { maxLength: 160 })}
            <Text style={styles.label}>{t('halal.fCategory')}</Text>
            <View style={styles.cats}>
              {HALAL_CATEGORIES.map((item) => {
                const on = item.id === category
                return (
                  <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.cat, on && styles.catOn]}>
                    <MaterialCommunityIcons name={item.icon} size={14} color={on ? paper.onInk : paper.ink} />
                    <Text style={[styles.catText, on && styles.catTextOn]}>{t(item.label)}</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>{field(t('halal.fCity'), cityText, setCityText, { maxLength: 80 })}</View>
              <View style={{ flex: 1 }}>{field(t('halal.fArea'), area, setArea, { maxLength: 120 })}</View>
            </View>
            {field(t('halal.fContact'), contactName, setContactName, { maxLength: 120 })}
            {field(t('halal.fPhone'), phone, setPhone, { keyboardType: 'phone-pad', maxLength: 20 })}
            {field(t('halal.fNote'), note, setNote, { multiline: true, maxLength: 1000, style: [styles.input, styles.multi] })}

            <Pressable onPress={() => setWantsFeatured((on) => !on)} style={[styles.featured, wantsFeatured && styles.featuredOn]}>
              <MaterialCommunityIcons name="crown" size={20} color={wantsFeatured ? '#8A6A1F' : paper.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.featuredTitle}>{t('halal.fFeatured')}</Text>
                <Text style={styles.featuredSub}>{t('halal.fFeaturedSub')}</Text>
              </View>
              <Switch value={wantsFeatured} onValueChange={setWantsFeatured} />
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void send()} disabled={busy} style={[styles.send, busy && { opacity: 0.7 }]}>
              {busy ? <ActivityIndicator color={paper.onInk} /> : null}
              <Text style={styles.sendText}>{busy ? t('halal.sending') : t('halal.send')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  const dark = mode === 'dark'
  return {
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,12,14,0.55)' },
    wrap: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '92%',
      paddingHorizontal: 16,
      paddingTop: 16,
      backgroundColor: paper.page,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    headIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7D3A1' },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 24, color: paper.ink },
    sub: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, lineHeight: 17, color: paper.muted, marginTop: 2 },
    field: { marginBottom: 10 },
    label: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: paper.muted, marginBottom: 5 },
    input: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 14.5,
      color: paper.ink,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: paper.line,
      backgroundColor: paper.card,
    },
    multi: { minHeight: 70, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10 },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    cat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: paper.chip,
    },
    catOn: { backgroundColor: paper.ink },
    catText: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: paper.ink },
    catTextOn: { color: paper.onInk },
    featured: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: paper.line,
      backgroundColor: paper.card,
      marginTop: 4,
    },
    featuredOn: { borderColor: dark ? 'rgba(231,211,161,0.5)' : '#E2C987', backgroundColor: dark ? 'rgba(231,211,161,0.08)' : '#FFFBF0' },
    featuredTitle: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: paper.ink },
    featuredSub: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: paper.muted, marginTop: 1 },
    error: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: '#C2321F', marginTop: 10 },
    send: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: paper.ink,
    },
    sendText: { fontFamily: 'Figtree_800ExtraBold', fontSize: 15, color: paper.onInk },
  }
})
