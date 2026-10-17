import { Text, View } from 'react-native'
import { supportedCityNames } from '@/src/constants/cities'
import { paperColors } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'

export function CityUnavailableBanner({
  detectedCity,
  country,
}: {
  detectedCity: string
  country?: string
}) {
  const styles = useStyles()
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

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
    banner: {
      backgroundColor: paper.card,
      borderWidth: 1,
      borderColor: paper.line,
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
    },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, color: paper.ink, marginBottom: 6 },
    body: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: paper.muted, lineHeight: 18, marginTop: 4 },
    strong: { fontFamily: 'Figtree_700Bold', color: paper.ink },
  }
})
