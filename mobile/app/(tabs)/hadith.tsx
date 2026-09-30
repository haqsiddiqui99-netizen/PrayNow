import { ScrollView, Text, View } from 'react-native'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { AppIcon } from '@/src/components/AppIcon'
import { makeStyles } from '@/src/context/ThemeContext'
import { DAILY_HADITH, HADITH_COLLECTION } from '@/src/data/mockData'

export default function HadithScreen() {
  const styles = useStyles()
  const tabBarHeight = useBottomTabBarHeight()
  const moreHadiths = HADITH_COLLECTION.filter((h) => h !== DAILY_HADITH)

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
      <View style={styles.titleRow}>
        <AppIcon name="hadees" size={36} variant="menu" />
        <View>
          <Text style={styles.title}>Hadith</Text>
          <Text style={styles.desc}>Daily wisdom from the Sunnah</Text>
        </View>
      </View>

      <View style={styles.featured}>
        <Text style={styles.label}>Hadith of the Day</Text>
        <Text style={styles.quote}>"{DAILY_HADITH.text}"</Text>
        <Text style={styles.source}>— {DAILY_HADITH.source}</Text>
      </View>

      <Text style={styles.sectionTitle}>More Hadiths</Text>
      {moreHadiths.map((hadith) => (
        <View key={hadith.source} style={styles.card}>
          <Text style={styles.quote}>"{hadith.text}"</Text>
          <Text style={styles.source}>— {hadith.source}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16, paddingTop: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  desc: { color: colors.textSecondary, marginTop: 2 },
  featured: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  label: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  quote: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  source: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '600' },
}))
