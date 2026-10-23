import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GradientFill } from '@/src/components/GradientFill'
import { HalalArt, priceMarks, roundKm } from '@/src/components/halal/HalalListingCard'
import { HALAL_GOLD, halalCategory, halalTag, sortHalalTags } from '@/src/constants/halalCategories'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { HalalListing } from '@/src/services/api'

function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function readableDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  return Number.isNaN(date.getTime()) ? ymd : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  listing: HalalListing | null
  km: number | null
  saved: boolean
  onClose: () => void
  onToggleSave: () => void
  onCall: () => void
  onWhatsapp: () => void
  onDirections: () => void
  onWebsite: () => void
}

export function HalalDetailSheet({ listing, km, saved, onClose, onToggleSave, onCall, onWhatsapp, onDirections, onWebsite }: Props) {
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t, formatDistance, placeName } = useLanguage()

  if (!listing) return null
  const info = halalCategory(listing.category)
  const price = priceMarks(listing.priceLevel)
  const certLapsed = Boolean(listing.certValidUntil) && listing.certValidUntil < todayYmd()
  const hasPhone = Boolean(listing.phone || listing.whatsapp)
  const place = [listing.area ? placeName(listing.area) : '', listing.city ? placeName(listing.city) : ''].filter(Boolean).join(', ')

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.hero}>
          <GradientFill colors={info.colors} steps={24} />
          <View style={styles.heroGlyph} pointerEvents="none">
            <MaterialCommunityIcons name={info.icon} size={150} color="rgba(255,255,255,0.10)" />
          </View>
          <View style={styles.grabber} />
          <View style={styles.heroTop}>
            <View style={styles.heroChip}>
              <MaterialCommunityIcons name={info.icon} size={12} color="#FFFFFF" />
              <Text style={styles.heroChipText}>{t(info.label)}</Text>
            </View>
            <View style={styles.heroButtons}>
              <Pressable onPress={onToggleSave} hitSlop={8} style={styles.heroBtn} accessibilityLabel={saved ? t('halal.unsave') : t('halal.save')}>
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#FF8A7A' : '#FFFFFF'} />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8} style={styles.heroBtn} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          <View style={styles.heroBody}>
            {listing.photoUrl ? <HalalArt listing={listing} size={58} radius={16} style={styles.heroPhoto} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              {listing.featured ? <Text style={styles.heroSponsored}>{t('halal.sponsored')}</Text> : null}
              <Text style={styles.heroName} numberOfLines={2}>
                {listing.name}
              </Text>
              {listing.tagline ? (
                <Text style={styles.heroTagline} numberOfLines={2}>
                  {listing.tagline}
                </Text>
              ) : null}
              <Text style={styles.heroMeta} numberOfLines={1}>
                {[place, km != null && Number.isFinite(km) ? formatDistance(roundKm(km)) : '', price].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.cert, listing.verified && !certLapsed ? styles.certOk : styles.certWarn]}>
            <MaterialCommunityIcons
              name={listing.verified ? 'shield-check' : 'shield-alert-outline'}
              size={26}
              color={listing.verified && !certLapsed ? '#1E8A55' : '#B07A16'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.certTitle}>{listing.verified ? t('halal.verified') : t('halal.unverified')}</Text>
              {listing.verified ? (
                <>
                  {listing.certBody ? <Text style={styles.certLine}>{t('halal.certBy', { body: listing.certBody })}</Text> : null}
                  {listing.certNumber ? <Text style={styles.certLine}>{t('halal.certNo', { number: listing.certNumber })}</Text> : null}
                  {listing.certValidUntil ? (
                    <Text style={[styles.certLine, certLapsed && styles.certLapsed]}>
                      {certLapsed
                        ? t('halal.certExpired', { date: readableDate(listing.certValidUntil) })
                        : t('halal.certUntil', { date: readableDate(listing.certValidUntil) })}
                    </Text>
                  ) : null}
                  {!listing.certBody && !listing.certNumber && !listing.certValidUntil ? (
                    <Text style={styles.certLine}>{t('halal.verifiedSub')}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.certLine}>{t('halal.unverifiedSub')}</Text>
              )}
            </View>
          </View>

          <View style={styles.bigActions}>
            {hasPhone ? (
              <>
                <Pressable onPress={onCall} style={styles.bigAction}>
                  <View style={[styles.bigIcon, { backgroundColor: paper.chip }]}>
                    <Ionicons name="call" size={18} color={paper.ink} />
                  </View>
                  <Text style={styles.bigLabel}>{t('halal.call')}</Text>
                </Pressable>
                <Pressable onPress={onWhatsapp} style={styles.bigAction}>
                  <View style={[styles.bigIcon, { backgroundColor: '#1E9E58' }]}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.bigLabel}>{t('halal.whatsapp')}</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={onDirections} style={styles.bigAction}>
              <View style={[styles.bigIcon, { backgroundColor: paper.ink }]}>
                <Ionicons name="navigate" size={18} color={paper.onInk} />
              </View>
              <Text style={styles.bigLabel}>{t('halal.directions')}</Text>
            </Pressable>
            {listing.website ? (
              <Pressable onPress={onWebsite} style={styles.bigAction}>
                <View style={[styles.bigIcon, { backgroundColor: paper.chip }]}>
                  <Ionicons name="globe-outline" size={18} color={paper.ink} />
                </View>
                <Text style={styles.bigLabel}>{t('halal.website')}</Text>
              </Pressable>
            ) : null}
          </View>
          {!hasPhone ? <Text style={styles.muted}>{t('halal.noContact')}</Text> : null}

          {listing.description ? (
            <>
              <Text style={styles.section}>{t('halal.about')}</Text>
              <Text style={styles.paragraph}>{listing.description}</Text>
            </>
          ) : null}

          {listing.tags.length || listing.delivers ? (
            <View style={styles.tags}>
              {listing.delivers ? (
                <View style={[styles.tag, styles.tagDeliver]}>
                  <MaterialCommunityIcons name="moped" size={13} color="#1E6F8A" />
                  <Text style={[styles.tagText, { color: '#1E6F8A', textTransform: 'none' }]}>{t('halal.deliversYes')}</Text>
                </View>
              ) : null}
              {sortHalalTags(listing.tags).map((tag) => {
                const known = halalTag(tag)
                return (
                  <View key={tag} style={styles.tag}>
                    {known ? <MaterialCommunityIcons name={known.icon} size={13} color={paper.muted} /> : null}
                    <Text style={styles.tagText}>{known ? t(known.label) : tag}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          {listing.address || place ? (
            <>
              <Text style={styles.section}>{t('halal.address')}</Text>
              <Pressable onPress={onDirections} style={styles.addressRow}>
                <Ionicons name="location-outline" size={18} color={paper.muted} />
                <Text style={styles.paragraph}>{[listing.address, place].filter(Boolean).join(', ')}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  const dark = mode === 'dark'
  return {
    scrim: { flex: 1, backgroundColor: 'rgba(5,12,14,0.55)' },
    sheet: {
      maxHeight: '88%',
      backgroundColor: paper.page,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    hero: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, overflow: 'hidden' },
    heroGlyph: { position: 'absolute', right: -24, bottom: -30 },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)', marginBottom: 10 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroChipText: { fontFamily: 'Figtree_700Bold', fontSize: 11.5, color: '#FFFFFF' },
    heroButtons: { flexDirection: 'row', gap: 8 },
    heroBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    heroBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 18 },
    heroPhoto: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
    heroSponsored: { fontFamily: 'Figtree_800ExtraBold', fontSize: 10, letterSpacing: 0.9, color: HALAL_GOLD, textTransform: 'uppercase', marginBottom: 2 },
    heroName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 28, lineHeight: 32, color: '#FFFFFF', letterSpacing: -0.3 },
    heroTagline: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.88)', marginTop: 3 },
    heroMeta: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
    body: { paddingHorizontal: 16, paddingTop: 14 },
    cert: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
    certOk: { backgroundColor: dark ? 'rgba(30,138,85,0.14)' : '#EEF8F2', borderColor: dark ? 'rgba(30,138,85,0.35)' : '#CBE9D7' },
    certWarn: { backgroundColor: dark ? 'rgba(176,122,22,0.14)' : '#FDF6E7', borderColor: dark ? 'rgba(176,122,22,0.35)' : '#F0DDB2' },
    certTitle: { fontFamily: 'Figtree_800ExtraBold', fontSize: 14.5, color: paper.ink },
    certLine: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, lineHeight: 18, color: paper.muted, marginTop: 2 },
    certLapsed: { color: '#B5541E' },
    bigActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, marginBottom: 4 },
    bigAction: { alignItems: 'center', gap: 6, minWidth: 64 },
    bigIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    bigLabel: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: paper.ink },
    muted: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, color: paper.muted, textAlign: 'center', marginTop: 6 },
    section: {
      marginTop: 18,
      marginBottom: 6,
      fontFamily: 'Figtree_700Bold',
      fontSize: 11.5,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: paper.muted,
    },
    paragraph: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 14, lineHeight: 21, color: paper.ink },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: paper.chip },
    tagDeliver: { backgroundColor: dark ? 'rgba(46,144,169,0.18)' : '#E6F3F7' },
    tagText: { fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: paper.muted, textTransform: 'capitalize' },
    addressRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  }
})
