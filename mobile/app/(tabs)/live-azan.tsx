import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/src/components/AppHeader'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { MosqueCurrentNextTimings } from '@/src/components/MosqueTimingsGrid'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { MosqueSortBar } from '@/src/components/MosqueSortBar'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  filterMosquesByRadius,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'
import { useLanguage } from '@/src/context/LanguageContext'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import { fetchLiveAzanStatus } from '@/src/services/api'
import { isAgoraNativeAvailable } from '@/src/services/agoraClient'
import {
  isMosqueLive,
  refreshLiveSessions,
  subscribeLiveSessions,
} from '@/src/store/liveAzanSessions'
import type { Mosque } from '@/src/types'
import {
  getCurrentPrayerForMosques,
  getLivePrayerInfo,
  isMosqueAzanLive,
} from '@/src/utils/prayerSchedule'
import { sortMosques, type MosqueSortMode } from '@/src/utils/mosqueSort'

function isMosqueOnLiveFeed(mosque: Mosque, now: Date): boolean {
  if (isMosqueLive(mosque.id)) return true
  const current = getCurrentPrayerForMosques(now)
  if (!current) return false
  return isMosqueAzanLive(mosque, current.name, now)
}

function LiveAzanMosqueCard({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { t, placeName, formatDistance } = useLanguage()
  const currentPrayer = getCurrentPrayerForMosques()
  const nextPrayer = getLivePrayerInfo().next.name

  return (
    <View style={styles.mosqueCard}>
      <View style={styles.mosqueCardTop}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>{t('mosque.live').toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.mosqueName} numberOfLines={2}>
        {placeName(mosque.name)}
      </Text>
      <Text style={styles.mosqueMeta} numberOfLines={1}>
        {placeName(mosque.area)} · {formatDistance(mosque.distance)}
      </Text>
      <MosqueCurrentNextTimings
        mosque={mosque}
        currentPrayer={currentPrayer?.name ?? null}
        nextPrayer={nextPrayer}
      />
    </View>
  )
}

export default function LiveAzanScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { t, formatRadius } = useLanguage()
  const { location, loading: locLoading, refresh: refreshLoc } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity } = useMosques(location)
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [status, setStatus] = useState({ agoraConfigured: false, liveCount: 0 })
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [sessionTick, setSessionTick] = useState(0)

  const filtered = filterMosquesByRadius(sortMosques(mosques, sortMode), radiusKm)
  const liveMosques = useMemo(
    () => filtered.filter((mosque) => isMosqueOnLiveFeed(mosque, now)),
    [filtered, now, sessionTick],
  )

  const emptyRadiusText =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.emptyCity')
      : t('mosques.emptyRadius', { radius: formatRadius(radiusKm) })

  const radiusScope =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.inCity')
      : t('mosques.within', { radius: formatRadius(radiusKm) })

  const locationLine = locLoading
    ? t('common.updating')
    : location.region && location.region !== location.city
      ? `${location.region}, ${location.city}`
      : location.label

  const reloadPage = useCallback(async () => {
    const [nextStatus] = await Promise.all([fetchLiveAzanStatus(), refreshLiveSessions(), reload()])
    setStatus(nextStatus)
  }, [reload])

  useEffect(() => {
    void reloadPage()
  }, [reloadPage])

  useEffect(() => {
    const unsub = subscribeLiveSessions(() => setSessionTick((tick) => tick + 1))
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([reloadPage(), refreshLoc()])
      setNow(new Date())
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <ScrollView
        style={styles.page}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <ScreenHeader
          title={t('screens.azanTitle')}
          subtitle={
            citySupported
              ? liveMosques.length > 0
                ? `${t('mosques.live', { count: liveMosques.length, scope: radiusScope })} · ${locationLine}`
                : `${t('screens.azanSubtitle')} · ${locationLine}`
              : t('mosques.detecting', { location: locationLine })
          }
          topInset={insets.top}
        />

        {liveMosques.length > 0 ? (
          <View style={styles.filtersCard}>
            <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} compact fullWidth />
            <View style={styles.filtersDivider} />
            <MosqueSortBar value={sortMode} onChange={setSortMode} compact hintBackgroundColor={colors.surface2} />
          </View>
        ) : null}

        {!status.agoraConfigured ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Server Agora keys missing — add AGORA_APP_ID to server/.env and restart the API.
            </Text>
          </View>
        ) : null}

        {!isAgoraNativeAvailable() ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Expo Go shows live mosques but cannot play Agora audio. Install a dev build (npm run eas:preview) or
              listen on the web Live Azan page.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {!citySupported && !locLoading && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          {loading && filtered.length === 0 ? (
            <ActivityIndicator color={colors.headerBg} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyRadiusText}</Text>
            </View>
          ) : liveMosques.length === 0 ? (
            <View style={styles.empty}>
              {refreshing ? (
                <ActivityIndicator color={colors.headerBg} />
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No live broadcasts right now</Text>
                  <Text style={styles.emptyDesc}>
                    When azan starts at a mosque in your selected range, it will appear here with Azan and Jamat
                    times.
                  </Text>
                </>
              )}
            </View>
          ) : (
            liveMosques.map((mosque) => <LiveAzanMosqueCard key={mosque.id} mosque={mosque} />)
          )}
        </View>
      </ScrollView>
    </>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  filtersCard: {
    backgroundColor: colors.surface2,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.soft,
  },
  filtersDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  banner: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
  },
  bannerText: { fontSize: 12, color: colors.warningText, lineHeight: 17 },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  loader: { marginVertical: 24 },
  empty: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', color: colors.textPrimary },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
  mosqueCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.soft,
  },
  mosqueCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveBadgeText: { fontSize: 11, fontWeight: '800', color: colors.success },
  mosqueName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  mosqueMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
    fontWeight: '500',
  },
}))
