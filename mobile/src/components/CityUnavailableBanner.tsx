import { StyleSheet, Text, View } from 'react-native'
import { supportedCityNames } from '@/src/constants/cities'

export function CityUnavailableBanner({
  detectedCity,
  country,
}: {
  detectedCity: string
  country?: string
}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>City not covered yet</Text>
      <Text style={styles.body}>
        We detected {detectedCity}{country ? `, ${country}` : ''}, but PrayNow does not have mosques
        listed there yet.
      </Text>
      <Text style={styles.body}>
        Available now: <Text style={styles.strong}>{supportedCityNames()}</Text>. More cities coming soon.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#0a0a0a', marginBottom: 6 },
  body: { fontSize: 12, color: '#525252', lineHeight: 18, marginTop: 4 },
  strong: { fontWeight: '800', color: '#0a0a0a' },
})
