import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

export default function IndexScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { isReady, isAuthenticated } = useAuth()

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/login" />
}

const useStyles = makeStyles(({ colors }) => ({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface0,
  },
}))
