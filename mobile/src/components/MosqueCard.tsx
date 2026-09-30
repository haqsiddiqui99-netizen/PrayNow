import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { FacilitiesLine } from '@/src/components/FacilitiesLine'
import { MosqueAnnouncementsSection } from '@/src/components/MosqueAnnouncementsSection'
import { MosqueFridaySection } from '@/src/components/MosqueFridaySection'
import { MosqueStaffContactsRow } from '@/src/components/MosqueStaffContactsRow'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { MosqueNotifyToggle } from '@/src/components/MosqueNotifyToggle'
import { MosqueTimingsGrid } from '@/src/components/MosqueTimingsGrid'
import { useLongPress } from '@/src/hooks/useLongPress'
import type { Mosque, TravelMode } from '@/src/types'
import { getCurrentPrayerForMosques, getLivePrayerInfo } from '@/src/utils/prayerSchedule'
import { formatCapacity } from '@/src/utils/mosqueSort'
import { getArrivalInfoForMosque, getTravelMinutes } from '@/src/utils/travelTime'

export function MosqueCard({
  mosque,
  travelMode,
  onPress,
  onPeek,
  isPeekActive = false,
  showContact = false,
  showStaffContacts = false,
  hideStaff = false,
  homeCompact = false,
  explore = false,
  compact: compactProp,
  static: staticCard = false,
}: {
  mosque: Mosque
  travelMode: TravelMode
  onPress?: () => void
  onPeek?: () => void
  isPeekActive?: boolean
  showContact?: boolean
  showStaffContacts?: boolean
  hideStaff?: boolean
  homeCompact?: boolean
  explore?: boolean
  compact?: boolean
  static?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const statusAccent = { early: colors.success, 'on-time': colors.warning, late: colors.accent } as const
  const compact = compactProp ?? homeCompact
  const { t, formatDistance, placeName } = useLanguage()
  const { delayLongPress, onLongPress, consumePress } = useLongPress(() => onPeek?.(), 420)
  const currentPrayer = getCurrentPrayerForMosques()
  const nextPrayer = getLivePrayerInfo().next.name
  const travelMinutes = getTravelMinutes(mosque, travelMode)
  const arrival = currentPrayer ? getArrivalInfoForMosque(mosque, travelMinutes, currentPrayer.name) : null
  const accentColor = arrival ? statusAccent[arrival.status] : colors.pageAccent

  const cardStyle = ({ pressed }: { pressed: boolean }) => [
    styles.card,
    homeCompact && styles.cardHomeCompact,
    compact && styles.cardCompact,
    staticCard && styles.cardStatic,
    !staticCard && onPress && pressed && styles.cardPressed,
    isPeekActive && styles.cardPeekOrigin,
  ]

  const body = (
    <>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={[styles.body, compact && styles.bodyCompact]}>
        {explore ? (
          <>
            <View style={styles.exploreHeader}>
              <View style={styles.exploreTitleBlock}>
                <Text style={styles.name} numberOfLines={2}>
                  {placeName(mosque.name)}
                </Text>
                <Text style={[styles.address, styles.addressCompact]} numberOfLines={2}>
                  {placeName(mosque.address)}
                </Text>
                {/* Wrapped rather than the single scrolling line elsewhere, so every
                 * facility shows at once instead of needing a horizontal swipe. */}
                <View
                  {...(Platform.OS === 'web'
                    ? { onMouseDown: (e: { stopPropagation?: () => void }) => e.stopPropagation?.() }
                    : {})}>
                  <FacilitiesLine
                    facilities={mosque.facilities}
                    capacity={mosque.capacity}
                    hintBackgroundColor={colors.surface2}
                    multiline
                    bare
                  />
                </View>
              </View>
              <View style={styles.exploreNotify}>
                <MosqueNotifyToggle mosqueId={mosque.id} />
                <GoogleMapsButton
                  mosque={mosque}
                  travelMode={travelMode}
                  caption={formatDistance(mosque.distance)}
                  light
                  style={styles.exploreMapsBtn}
                />
              </View>
            </View>
            <MosqueTimingsGrid
              mosque={mosque}
              currentPrayer={currentPrayer?.name ?? null}
              compact
              dense
            />
            <MosqueFridaySection mosque={mosque} />
            <MosqueAnnouncementsSection mosque={mosque} />
          </>
        ) : (
          <View style={styles.topRow}>
            {!compact && (
              <View style={styles.avatar}>
                <Ionicons name="moon" size={22} color={colors.pageAccent} />
              </View>
            )}

            <View style={styles.titleBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={staticCard ? 3 : 1}>
                  {placeName(mosque.name)}
                </Text>
              </View>
              <Text
                style={[styles.address, compact && styles.addressCompact]}
                numberOfLines={staticCard ? 3 : compact ? 1 : 2}>
                {placeName(mosque.address)}
              </Text>
              {compact && (
                <MosqueTimingsGrid
                  mosque={mosque}
                  currentPrayer={currentPrayer?.name ?? null}
                  nextPrayer={nextPrayer}
                  currentAndNext
                />
              )}
            </View>

            <View style={[styles.sideCol, compact && styles.sideColCompact]}>
              <View style={styles.notifyBlock}>
                <MosqueNotifyToggle mosqueId={mosque.id} />
              </View>
              <View style={[styles.sideDivider, compact && styles.sideDividerCompact]} />
              <GoogleMapsButton
                mosque={mosque}
                travelMode={travelMode}
                caption={
                  compact
                    ? formatDistance(mosque.distance)
                    : `${travelMinutes} ${t('units.min')}`
                }
                light={compact}
              />
            </View>
          </View>
        )}

        {explore ? null : compact ? (
          <View
            style={styles.facilitiesWrap}
            {...(Platform.OS === 'web'
              ? { onMouseDown: (e: { stopPropagation?: () => void }) => e.stopPropagation?.() }
              : {})}>
            <FacilitiesLine
              facilities={mosque.facilities}
              capacity={mosque.capacity}
              hintBackgroundColor={colors.surface2}
            />
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.statText}>{formatDistance(mosque.distance)}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.statText}>
                  {formatCapacity(mosque.capacity)} {t('mosque.capacity')}
                </Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.statText} numberOfLines={1}>
                  {mosque.area}
                </Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {[
                mosque.sect,
                mosque.reviewCount > 0
                  ? t('mosque.reviews', { count: mosque.reviewCount.toLocaleString() })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('mosque.detailsPending')}
            </Text>
          </>
        )}

        {showStaffContacts && <MosqueStaffContactsRow mosque={mosque} />}

        {showContact && !showStaffContacts && (
          <View style={[styles.contactRow, compact && styles.contactRowCompact]}>
            {!hideStaff && mosque.imam ? (
              <View style={styles.imamRow}>
                <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.contactImam} numberOfLines={1}>
                  {t('mosque.imam')}: {mosque.imam}
                </Text>
              </View>
            ) : null}
            {mosque.sermonLanguage ? (
              <View style={styles.imamRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.contactImam} numberOfLines={1}>
                  {t('mosque.khutbah')}: {mosque.sermonLanguage}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {!compact && !staticCard && <FacilitiesLine facilities={mosque.facilities} />}

        {!compact && !staticCard && (
          <MosqueTimingsGrid
            mosque={mosque}
            currentPrayer={currentPrayer?.name ?? null}
            compact
          />
        )}
      </View>
    </>
  )

  if (staticCard) {
    return <View style={cardStyle({ pressed: false })}>{body}</View>
  }

  return (
    <Pressable
      style={cardStyle}
      delayLongPress={onPeek ? delayLongPress : undefined}
      onLongPress={onPeek ? onLongPress : undefined}
      onPress={
        onPress
          ? () => {
              if (consumePress()) return
              onPress()
            }
          : undefined
      }>
      {body}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignSelf: 'stretch',
    ...shadows.card,
  },
  cardHomeCompact: { marginBottom: 10 },
  cardCompact: { marginBottom: 8 },
  cardStatic: { marginBottom: 0 },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.992 }] },
  cardPeekOrigin: Platform.select({
    web: {
      transform: [{ scale: 0.98 }],
      borderColor: colors.pageAccent,
      boxShadow: `0 0 14px rgba(51, 65, 85, 0.22)`,
    },
    default: {
      transform: [{ scale: 0.98 }],
      borderColor: colors.pageAccent,
      shadowColor: colors.pageAccent,
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 6,
    },
  }),
  facilitiesWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  accentBar: { width: 4 },
  body: { flex: 1, minWidth: 0, padding: 14, paddingLeft: 12 },
  bodyCompact: { padding: 10, paddingLeft: 10 },
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  exploreTitleBlock: { flex: 1, minWidth: 0 },
  exploreNotify: {
    alignItems: 'center',
    gap: 4,
    width: 72,
    flexShrink: 0,
  },
  exploreNotifyLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 10,
  },
  exploreMapsBtn: {
    alignSelf: 'center',
    minWidth: 44,
  },
  topRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.pageAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.12)',
  },
  titleBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  sideCol: { alignItems: 'center', gap: 6, width: 76 },
  sideColCompact: { gap: 4, width: 72 },
  notifyBlock: { alignItems: 'center', gap: 4 },
  notifyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 11,
    letterSpacing: -0.1,
  },
  notifyLabelCompact: { fontSize: 8, lineHeight: 10 },
  sideDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  sideDividerCompact: { marginVertical: 1 },
  // Same family/weight as the home card's "Fajr"-style prayer name (nextName in
  // HomePrayerCard.tsx) — Poppins_500Medium rather than the app-wide Inter set.
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
    minWidth: 0,
  },
  // Same family/weight as the mosque name header above it, per the request to
  // match the card body's font style to the header.
  address: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  addressCompact: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, maxWidth: 110 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 8, fontWeight: '600' },
  contactRow: { marginTop: 8, gap: 6 },
  contactRowCompact: { marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.pageAccentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  contactText: { fontSize: 12, fontWeight: '700', color: colors.pageAccent },
  imamRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  contactImam: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  ratingText: { fontSize: 11, fontWeight: '800', color: colors.warningText },
}))
