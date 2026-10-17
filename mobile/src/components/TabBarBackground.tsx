import { Platform, StyleSheet, View } from 'react-native'
import { paperColors } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'

/** Opaque tab bar backdrop, so scrolling content never bleeds through it. */
export function TabBarBackground() {
  const styles = useStyles()
  return <View style={styles.shell} />
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: paper.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.line,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -3px 10px rgba(15, 23, 42, 0.06)' }
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
  }
})
