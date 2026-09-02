// Central design tokens so the whole app reads as one system.
//
// Saviour ships a dark and a light palette with identical keys, so every
// component styles against roles ("surface", "danger") rather than literal
// colours and swaps themes without touching a single style rule.

export type Scheme = 'light' | 'dark';

/** How the user wants the theme picked — persisted in Settings. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Palette {
  // Backgrounds, low → high elevation
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceHi: string;

  // Lines
  border: string;
  borderSoft: string;

  // Text
  text: string;
  textMuted: string;
  textFaint: string;

  // Brand / actions
  primary: string;
  primaryHi: string;
  primarySoft: string;

  // Semantic states
  safe: string;
  safeHi: string;
  safeSoft: string;
  danger: string;
  dangerHi: string;
  dangerSoft: string;
  warning: string;
  warningHi: string;
  warningSoft: string;

  /** Text that sits on top of a filled primary/danger button. */
  onAccent: string;
  /** Text that sits on top of a filled `safe` button. */
  onSafe: string;

  // Scrims
  overlay: string;
}

/** Tuned for low-light glanceability with high-contrast safety accents. */
export const darkPalette: Palette = {
  bg: '#0A0F1C',
  bgElevated: '#0F1728',
  surface: '#141D30',
  surfaceAlt: '#1B2740',
  surfaceHi: '#243352',

  border: '#2A3752',
  borderSoft: '#212C44',

  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textFaint: '#64748B',

  primary: '#3B82F6',
  primaryHi: '#60A5FA',
  primarySoft: '#152238',

  safe: '#10B981',
  safeHi: '#34D399',
  safeSoft: '#0E2A23',

  danger: '#EF4444',
  dangerHi: '#F87171',
  dangerSoft: '#2A1620',

  warning: '#F59E0B',
  warningHi: '#FBBF24',
  warningSoft: '#2A2110',

  onAccent: '#FFFFFF',
  onSafe: '#05231B',

  overlay: 'rgba(5,8,16,0.94)',
};

/**
 * Daylight counterpart. The `*Hi` accents go *darker* than their base here —
 * "Hi" means higher emphasis against the current background, not lighter.
 */
export const lightPalette: Palette = {
  bg: '#F4F7FB',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F8',
  surfaceHi: '#DFE6F1',

  border: '#CFD9E7',
  borderSoft: '#E3EAF4',

  text: '#0D1526',
  textMuted: '#4E5D75',
  textFaint: '#78859A',

  primary: '#2563EB',
  primaryHi: '#1D4ED8',
  primarySoft: '#E3EDFE',

  safe: '#059669',
  safeHi: '#047857',
  safeSoft: '#D7F5E7',

  danger: '#DC2626',
  dangerHi: '#B91C1C',
  dangerSoft: '#FDE4E4',

  warning: '#C2740A',
  warningHi: '#9A5B08',
  warningSoft: '#FCF0D6',

  onAccent: '#FFFFFF',
  onSafe: '#FFFFFF',

  overlay: 'rgba(12,20,35,0.72)',
};

export const palettes: Record<Scheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

/** 8pt spacing scale. `spacing(1.5)` → 12. */
export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

export interface Shadows {
  card: object;
  float: object;
}

/**
 * Elevation. Dark UIs need a heavy shadow to separate near-black surfaces;
 * on white, the same values look like soot, so light mode goes much softer.
 */
export function makeShadows(scheme: Scheme): Shadows {
  const dark = scheme === 'dark';
  return {
    card: {
      shadowColor: '#000',
      shadowOpacity: dark ? 0.35 : 0.08,
      shadowRadius: dark ? 14 : 10,
      shadowOffset: { width: 0, height: dark ? 8 : 4 },
      elevation: dark ? 6 : 2,
    },
    float: {
      shadowColor: '#000',
      shadowOpacity: dark ? 0.45 : 0.14,
      shadowRadius: dark ? 24 : 18,
      shadowOffset: { width: 0, height: dark ? 14 : 8 },
      elevation: dark ? 14 : 6,
    },
  };
}

/** Typography scale — use these instead of ad-hoc fontSize/weight per screen. */
export function makeType(c: Palette) {
  return {
    display: { fontSize: 34, fontWeight: '900' as const, color: c.text, letterSpacing: -0.5 },
    h1: { fontSize: 26, fontWeight: '800' as const, color: c.text, letterSpacing: -0.3 },
    h2: { fontSize: 20, fontWeight: '800' as const, color: c.text },
    h3: { fontSize: 16, fontWeight: '700' as const, color: c.text },
    body: { fontSize: 15, fontWeight: '500' as const, color: c.text },
    bodyStrong: { fontSize: 15, fontWeight: '700' as const, color: c.text },
    caption: { fontSize: 13, fontWeight: '500' as const, color: c.textMuted },
    label: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: c.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    },
  };
}

export type Typography = ReturnType<typeof makeType>;

/**
 * Translucent tint of an accent, for badge/banner fills. Keeping this in one
 * place stops every component from hard-coding its own hex-alpha suffix.
 */
export function tint(hex: string, scheme: Scheme, strength: 'fill' | 'edge' = 'fill'): string {
  const alpha =
    strength === 'edge' ? (scheme === 'dark' ? 0x55 : 0x66) : scheme === 'dark' ? 0x22 : 0x1f;
  return hex + alpha.toString(16).padStart(2, '0');
}
