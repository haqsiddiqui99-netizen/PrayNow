import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { CityPickerSheet } from '@/src/components/CityPickerSheet'
import { LiveAzanFeed } from '@/src/components/LiveAzanFeed'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import { refreshLiveSessions } from '@/src/store/liveAzanSessions'

export default function LiveAzanScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const {
    location,
    loading: locLoading,
    refresh: refreshLoc,
    selectCity,
    selectSavedLocation,
    removeSavedLocation,
    searchAddress,
    savedLocations,
  } = useLocation()
  const { mosques, allMosques, loading, reload, citySupported, detectedCity } = useMosques(location)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const selectedLocationId =
    savedLocations.find(
      (item) =>
        item.city === location.city &&
        Math.abs(item.lat - location.lat) < 0.02 &&
        Math.abs(item.lng - location.lng) < 0.02,
    )?.id ??
    savedLocations[0]?.id ??
    null

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([reload(), refreshLoc(), refreshLiveSessions()])
    } finally {
      setRefreshing(false)
    }
  }, [reload, refreshLoc])

  return (
    <View style={{ flex: 1 }}>
      <LiveAzanFeed
        nearby={citySupported ? mosques : []}
        catalog={allMosques}
        city={location.supportedCity?.name ?? location.city}
        bottomInset={tabBarHeight}
        loading={loading || locLoading}
        onPressLocation={() => setCityPickerOpen(true)}
        onRefresh={() => void onRefresh()}
        refreshing={refreshing}
        citySupported={citySupported}
        detectedCity={detectedCity}
        country={location.country}
      />
      <CityPickerSheet
        visible={cityPickerOpen}
        selectedLocationId={selectedLocationId}
        selectedCityName={location.supportedCity?.name ?? location.city}
        savedLocations={savedLocations}
        onSelectCity={selectCity}
        onSelectSavedLocation={selectSavedLocation}
        onRemoveSavedLocation={removeSavedLocation}
        onSearchAddress={searchAddress}
        searching={locLoading}
        onUseCurrentLocation={refreshLoc}
        onClose={() => setCityPickerOpen(false)}
      />
    </View>
  )
}
