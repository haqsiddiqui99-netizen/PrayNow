import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { GradientFill } from '@/src/components/GradientFill'
import { HALAL_GOLD, halalCategory, halalTag, sortHalalTags } from '@/src/constants/halalCategories'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { HalalListing } from '@/src/services/api'

/** Category gradient with its icon, or the shop's own photo when one is set. */
export function HalalArt({
  listing,
  size,
  radius = 16,
  iconSize,
  style,
}: {
  listing: HalalListing
  size: number
  radius?: number
  iconSize?: number
  style?: StyleProp<ViewStyle>
}) {
  const info = halalCategory(listing.category)
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>
      <GradientFill colors={info.colors} vertical steps={16} />
      {listing.photoUrl ? (
        <Image source={{ uri: listing.photoUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={info.icon} size={iconSize ?? Math.round(size * 0.46)} color="rgba(255,255,255,0.92)" />
        </View>
      )}
    </View>
  )
}

export function VerifiedSeal({ compact = false }: { compact?: boolean }) {
  const styles = useStyles()
  const { t } = useLanguage()
  return (
    <View style={[styles.seal, compact && styles.sealCompact]} accessibilityLabel={t('halal.verified')}>
      <MaterialCommunityIcons name="check-decagram" size={compact ? 13 : 14} color="#1E8A55" />
      {compact ? null : <Text style={styles.sealText}>{t('halal.verified')}</Text>}
    </View>
  )
}

export function priceMarks(level: number) {
  return level > 0 ? '₹'.repeat(Math.min(3, level)) : ''
}

export function roundKm(km: number) {
  return km < 10 ? Math.round(km * 10) / 10 : Math.round(km)
}

type Props = {
  listing: HalalListing
  km: number | null
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  onCall: () => void
  onWhatsapp: () => void
  onDirections: () => void
}

export function HalalListingCard({ listing, km, saved, onOpen, onToggleSave, onCall, onWhatsapp, onDirections }: Props) {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t, formatDistance, placeName } = useLanguage()
  const info = halalCategory(listing.category)
  const price = priceMarks(listing.priceLevel)
  const meta = [
    t(info.label),
    listing.area ? placeName(listing.area) : '',
    km != null && Number.isFinite(km) ? formatDistance(roundKm(km)) : '',
  ].filter(Boolean)
  const hasPhone = Boolean(listing.phone || listing.whatsapp)

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, listing.featured && styles.cardFeatured, pressed && styles.pressed]}>
      <View style={styles.top}>
        <HalalArt listing={listing} size={64} />
        <View style={styles.copy}>
          {listing.featured ? (
            <View style={styles.sponsored}>
              <MaterialCommunityIcons name="star-four-points" size={10} color="#8A6A1F" />
              <Text style={styles.sponsoredText}>{t('halal.sponsored')}</Text>
            </View>
          ) : null}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {listing.name}
            </Text>
            {listing.verified ? <VerifiedSeal compact /> : null}
          </View>
          {listing.tagline ? (
            <Text style={styles.tagline} numberOfLines={1}>
              {listing.tagline}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {meta.join(' · ')}
            {price ? `  ${price}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={onToggleSave}
          hitSlop={10}
          accessibilityLabel={saved ? t('halal.unsave') : t('halal.save')}
          style={styles.heart}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#C2321F' : paper.muted} />
        </Pressable>
      </View>

      {listing.tags.length || listing.delivers ? (
        <View style={styles.tags}>
          {listing.delivers ? (
            <View style={[styles.tag, styles.tagDeliver]}>
              <MaterialCommunityIcons name="moped" size={12} color="#1E6F8A" />
              <Text style={[styles.tagText, styles.tagDeliverText]}>{t('halal.deliversYes')}</Text>
            </View>
          ) : null}
          {sortHalalTags(listing.tags).slice(0, 3).map((tag) => {
            const known = halalTag(tag)
            return (
              <View key={tag} style={styles.tag}>
                {known ? <MaterialCommunityIcons name={known.icon} size={12} color={paper.muted} /> : null}
                <Text style={styles.tagText}>{known ? t(known.label) : tag}</Text>
              </View>
            )
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        {hasPhone ? (
          <>
            <Pressable onPress={onCall} style={styles.action} accessibilityLabel={t('halal.call')}>
              <Ionicons name="call-outline" size={15} color={paper.ink} />
              <Text style={styles.actionText}>{t('halal.call')}</Text>
            </Pressable>
            <Pressable onPress={onWhatsapp} style={styles.action} accessibilityLabel={t('halal.whatsapp')}>
              <MaterialCommunityIcons name="whatsapp" size={16} color="#1E9E58" />
              <Text style={styles.actionText}>{t('halal.whatsapp')}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={onDirections} style={[styles.action, styles.actionMain]} accessibilityLabel={t('halal.directions')}>
          <Ionicons name="navigate" size={14} color={paper.onInk} />
          <Text style={[styles.actionText, styles.actionMainText]}>{t('halal.directions')}</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ mode, shadows }) => {
  const paper = paperColors(mode)
  const dark = mode === 'dark'
  return {
    card: {
      marginHorizontal: 14,
      marginBottom: 10,
      padding: 12,
      borderRadius: 22,
      backgroundColor: paper.card,
      borderWidth: 1,
      borderColor: paper.line,
      ...shadows.soft,
    },
    cardFeatured: { borderColor: dark ? 'rgba(231,211,161,0.45)' : '#E2C987', borderWidth: 1.5 },
    pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1, minWidth: 0 },
    sponsored: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(231,211,161,0.16)' : '#FBF3DD',
      marginBottom: 3,
    },
    sponsoredText: { fontFamily: 'Figtree_800ExtraBold', fontSize: 9.5, letterSpacing: 0.6, color: dark ? HALAL_GOLD : '#8A6A1F', textTransform: 'uppercase' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { flexShrink: 1, fontFamily: 'Figtree_700Bold', fontSize: 16, color: paper.ink },
    tagline: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: paper.ink, opacity: 0.85, marginTop: 2 },
    meta: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: paper.muted, marginTop: 3 },
    heart: { alignSelf: 'flex-start', padding: 2 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: paper.chip,
    },
    tagText: { fontFamily: 'Figtree_600SemiBold', fontSize: 11, color: paper.muted, textTransform: 'capitalize' },
    tagDeliver: { backgroundColor: dark ? 'rgba(46,144,169,0.18)' : '#E6F3F7' },
    tagDeliverText: { color: dark ? '#8FD0E2' : '#1E6F8A', textTransform: 'none' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: paper.chip,
    },
    actionText: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: paper.ink },
    actionMain: { backgroundColor: paper.ink },
    actionMainText: { color: paper.onInk },
    seal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: dark ? 'rgba(30,138,85,0.18)' : '#E5F4EC',
    },
    sealCompact: { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent' },
    sealText: { fontFamily: 'Figtree_700Bold', fontSize: 11, color: dark ? '#7FD3A6' : '#1E6F45' },
  }
})
