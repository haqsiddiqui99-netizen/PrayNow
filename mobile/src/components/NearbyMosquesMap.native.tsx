import { useEffect, useMemo, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { colors, radius, shadows } from '@/src/constants/theme'
import type { Mosque } from '@/src/types'

type Props = {
  mosques: Mosque[]
  userLat: number
  userLng: number
  selectedId?: string | null
  onSelectMosque: (mosque: Mosque) => void
  onOpenInGoogleMaps?: () => void
}

function regionForMosques(mosques: Mosque[], userLat: number, userLng: number): Region {
  const coords = [
    { lat: userLat, lng: userLng },
    ...mosques
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .map((m) => ({ lat: m.lat, lng: m.lng })),
  ]
  const lats = coords.map((c) => c.lat)
  const lngs = coords.map((c) => c.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latDelta = Math.max((maxLat - minLat) * 1.4, 0.03)
  const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.03)
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }
}

export function NearbyMosquesMap({
  mosques,
  userLat,
  userLng,
  selectedId,
  onSelectMosque,
  onOpenInGoogleMaps,
}: Props) {
  const mapRef = useRef<MapView>(null)

  const region = useMemo(
    () => regionForMosques(mosques, userLat, userLng),
    [mosques, userLat, userLng],
  )

  const pinMosques = useMemo(
    () => mosques.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
    [mosques],
  )

  useEffect(() => {
    if (!mapRef.current || pinMosques.length === 0) return
    const coords = [
      { latitude: userLat, longitude: userLng },
      ...pinMosques.map((m) => ({ latitude: m.lat, longitude: m.lng })),
    ]
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 48, right: 36, bottom: 48, left: 36 },
        animated: true,
      })
    }, 250)
    return () => clearTimeout(t)
  }, [pinMosques, userLat, userLng])

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsMyLocationButton
        toolbarEnabled={false}>
        {pinMosques.map((m) => {
          const selected = m.id === selectedId
          return (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={m.name}
              description={m.area || m.address}
              pinColor={selected ? colors.accent : colors.primary}
              onPress={() => onSelectMosque(m)}
            />
          )
        })}
      </MapView>

      {onOpenInGoogleMaps && pinMosques.length > 0 ? (
        <View style={styles.googleBtnWrap}>
          <GoogleMapsButton
            variant="chip"
            label="Open in Google Maps"
            onPress={onOpenInGoogleMaps}
          />
        </View>
      ) : null}

      {pinMosques.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>No mosques to show on the map</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface1,
    ...shadows.soft,
  },
  map: { flex: 1 },
  googleBtnWrap: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  emptyText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
})
