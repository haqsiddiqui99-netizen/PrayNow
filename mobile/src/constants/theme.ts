export const colors = {
  primary: '#0d47a1',
  primaryLight: '#1565c0',
  primaryDark: '#0a3d8f',
  primarySoft: '#e3f2fd',
  accent: '#c62828',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#ea580c',
  warningBg: '#fff7ed',
  surface0: '#f0f4f8',
  surface1: '#e8eef4',
  surface2: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  heroGradientEnd: '#1976d2',
} as const

export const shadows = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  soft: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const

/** Shared prayer timing text — matches Zawal / START / END on home card */
export const timingTextStyle = {
  fontSize: 10,
  lineHeight: 14,
  fontWeight: '600' as const,
  color: '#000000',
}
