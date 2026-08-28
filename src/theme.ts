// Central design tokens so the whole app reads as one system.
// Saviour is a dark-only app (see app.json `userInterfaceStyle`), so the palette
// is tuned for low-light glanceability with high-contrast safety accents.

export const colors = {
  // Backgrounds, low → high elevation
  bg: '#0A0F1C',
  bgElevated: '#0F1728',
  surface: '#141D30',
  surfaceAlt: '#1B2740',
  surfaceHi: '#243352',

  // Lines
  border: '#2A3752',
  borderSoft: '#212C44',

  // Text
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textFaint: '#64748B',

  // Brand / actions
  primary: '#3B82F6',
  primaryHi: '#60A5FA',
  primarySoft: '#152238',
  primaryText: '#FFFFFF',

  // Semantic states
  safe: '#10B981',
  safeHi: '#34D399',
  safeSoft: '#0E2A23',

  danger: '#EF4444',
  dangerHi: '#F87171',
  dangerSoft: '#2A1620',

  warning: '#F59E0B',
  warningHi: '#FBBF24',
  warningSoft: '#2A2110',

  // Scrims
  overlay: 'rgba(5,8,16,0.94)',
} as const;

/** 8pt spacing scale. `spacing(1.5)` → 12. */
export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

/** Reusable elevation. RN shadows are iOS-only visually; `elevation` covers Android. */
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
} as const;

/** Typography scale — use these instead of ad-hoc fontSize/weight per screen. */
export const type = {
  display: { fontSize: 34, fontWeight: '900' as const, color: colors.text, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '800' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  label: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
};
