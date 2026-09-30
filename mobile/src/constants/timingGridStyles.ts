import { radius, timingTextStyle } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'

/** Shared 5-column prayer grid — daily timings and Friday Juma use the same layout. */
export const PRAYER_GRID_COLUMNS = 5

/** Dhuhr / Zohr column index (0-based) where Juma sessions align. */
export const JUMA_GRID_START_COLUMN = 1

export const useTimingGridStyles = makeStyles(({ colors }) => ({
  grid: {
    backgroundColor: colors.pageAccentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gridBorder,
    padding: 6,
    gap: 2,
  },
  gridCompact: {
    padding: 5,
    gap: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cornerCell: {
    width: 34,
    flexShrink: 0,
  },
  colHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  colHeaderText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.pageAccent,
    textTransform: 'capitalize',
  },
  colActive: {
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.pageAccent,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rowLabelCell: {
    width: 34,
    flexShrink: 0,
    alignItems: 'flex-start',
    paddingLeft: 2,
  },
  rowLabel: {
    ...timingTextStyle(colors),
    textTransform: 'capitalize',
  },
  timeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  timeValue: timingTextStyle(colors),
}))
