import type { ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { TabBarIcon, type TabBarIconName } from '@/src/components/TabBarIcon'
import { UserMenu } from '@/src/components/UserMenu'
import { HEADER_CONTROL_HEIGHT } from '@/src/constants/layout'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

/** Breathing room between the status bar and the first header row. */
const HEADER_TOP_GAP = 6

/** Vertical space between the brand row and the identity row. */
const HEADER_ROW_GAP = 8

/** Space below the last header row, before the divider. */
const HEADER_BOTTOM_PAD = 10

/** Height of the home header's brand line, fixed so the content height stays predictable. */
const HEADER_BRAND_HEIGHT = 26

/** Fallback height of the home header content (without the status-bar inset). */
export const APP_HEADER_CONTENT_HEIGHT =
  HEADER_TOP_GAP + HEADER_BRAND_HEIGHT + HEADER_ROW_GAP + HEADER_CONTROL_HEIGHT + HEADER_BOTTOM_PAD

type HeaderShellProps = {
  topInset: number
  onMeasureHeight?: (height: number) => void
  children: ReactNode
}

function HeaderShell({ topInset, onMeasureHeight, children }: HeaderShellProps) {
  const styles = useStyles()

  return (
    <View
      style={[styles.shell, { paddingTop: topInset + HEADER_TOP_GAP }]}
      onLayout={(event) => onMeasureHeight?.(event.nativeEvent.layout.height)}>
      {children}
    </View>
  )
}

/** Blue pill that shows the active city and opens the city picker. */
export function LocationPill({
  text,
  onPress,
  style,
}: {
  text: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const styles = useStyles()
  const { colors } = useTheme()

  return (
    <Pressable
      style={[styles.locationPill, style]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Location ${text}. Tap to change`}>
      <Ionicons name="location-sharp" size={14} color={colors.primary} />
      <Text style={styles.locationText} numberOfLines={1}>
        {text}
      </Text>
      <Ionicons name="chevron-down" size={13} color={colors.primary} />
    </Pressable>
  )
}

type AppHeaderProps = {
  greetingName: string
  locationText: string
  onPressLocation: () => void
  topInset: number
  onMeasureHeight?: (height: number) => void
}

/**
 * Home header in two lines: the brand alone on top, then account on the left and
 * city on the right. Appearance, language and messages live inside the account
 * menu rather than as separate header controls.
 */
export function AppHeader({
  greetingName,
  locationText,
  onPressLocation,
  topInset,
  onMeasureHeight,
}: AppHeaderProps) {
  const styles = useStyles()

  return (
    <HeaderShell topInset={topInset} onMeasureHeight={onMeasureHeight}>
      <View style={styles.brandLine}>
        <Text style={styles.brandName} numberOfLines={1}>
          PrayNow
        </Text>
      </View>
      <View style={styles.identityRow}>
        <UserMenu greetingName={greetingName} />
        <LocationPill text={locationText} onPress={onPressLocation} />
      </View>
    </HeaderShell>
  )
}

type ScreenHeaderProps = {
  /** Reuses the tab icon so the header mark matches the active tab. Omit to hide the mark. */
  icon?: TabBarIconName
  title: string
  subtitle?: string
  locationText?: string
  onPressLocation?: () => void
  topInset: number
  /** Set false to drop the account menu and centre the title/subtitle instead. */
  showAccountMenu?: boolean
}

/** Header for the non-home tabs, sharing the home header's structure. */
export function ScreenHeader({
  icon,
  title,
  subtitle,
  locationText,
  onPressLocation,
  topInset,
  showAccountMenu = true,
}: ScreenHeaderProps) {
  const styles = useStyles()

  return (
    <HeaderShell topInset={topInset}>
      <View style={styles.topRow}>
        {/*
         * Equal-flex flanks (same trick as the home header's brand row) keep the
         * title/subtitle block optically centred once the account menu is gone,
         * without needing a separate layout for that case.
         */}
        <View style={styles.topRowZoneStart}>
          {icon ? (
            <View style={styles.mark}>
              <TabBarIcon name={icon} focused color="#fff" size={18} />
            </View>
          ) : null}
        </View>
        <View style={showAccountMenu ? styles.topRowText : styles.topRowTextCentered}>
          <Text
            style={[styles.screenTitle, !showAccountMenu && styles.screenTitleCentered]}
            numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, !showAccountMenu && styles.subtitleCentered]}
              numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.topRowZoneEnd}>{showAccountMenu ? <UserMenu /> : null}</View>
      </View>

      {locationText && onPressLocation ? (
        <View style={styles.identityRow}>
          <LocationPill text={locationText} onPress={onPressLocation} />
        </View>
      ) : null}
    </HeaderShell>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  shell: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 16,
    paddingBottom: HEADER_BOTTOM_PAD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadows.soft,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: HEADER_CONTROL_HEIGHT,
  },
  topRowZoneStart: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topRowZoneEnd: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  brandLine: {
    height: HEADER_BRAND_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: HEADER_CONTROL_HEIGHT,
    height: HEADER_CONTROL_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRowText: {
    flex: 1,
    minWidth: 0,
  },
  topRowTextCentered: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  screenTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenTitleCentered: { textAlign: 'center' },
  subtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  subtitleCentered: { textAlign: 'center' },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: HEADER_CONTROL_HEIGHT,
    marginTop: HEADER_ROW_GAP,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
    height: HEADER_CONTROL_HEIGHT,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.pillBorder,
  },
  locationText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
}))
