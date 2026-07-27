import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/constants/theme'

export default function LiveAzanScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Live Azan</Text>
      <Text style={styles.desc}>Hear azan from wired mosque microphones</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>🔊 Live streaming coming soon</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 48 },
  desc: { color: colors.textSecondary, marginTop: 6, marginBottom: 20 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: { fontWeight: '600', textAlign: 'center' },
})
