import React, { createContext, useContext, useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useSettings } from './SettingsContext';
import {
  makeShadows,
  makeType,
  palettes,
  tint as tintFn,
  type Palette,
  type Scheme,
  type Shadows,
  type Typography,
} from '../theme';

export interface ThemeState {
  /** The palette actually in use, after resolving "system". */
  scheme: Scheme;
  colors: Palette;
  type: Typography;
  shadow: Shadows;
  /** Translucent accent tint for badge/banner fills, alpha-tuned per scheme. */
  tint: (hex: string, strength?: 'fill' | 'edge') => string;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const system = useColorScheme();
  const pref = settings.themePreference;

  const scheme: Scheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;

  const value = useMemo<ThemeState>(() => {
    const colors = palettes[scheme];
    return {
      scheme,
      colors,
      type: makeType(colors),
      shadow: makeShadows(scheme),
      tint: (hex, strength) => tintFn(hex, scheme, strength),
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Build a theme without any React context — for the crash screen, which
 *  renders above the providers and must never throw itself. */
export function themeFor(scheme: Scheme): ThemeState {
  const colors = palettes[scheme];
  return {
    scheme,
    colors,
    type: makeType(colors),
    shadow: makeShadows(scheme),
    tint: (hex, strength) => tintFn(hex, scheme, strength),
  };
}

/**
 * Falls back to the OS scheme rather than throwing when no provider is above
 * it. Saviour is a safety tool: a missing provider must never blank the screen.
 */
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  const system = Appearance.getColorScheme();
  const fallback = useMemo(() => themeFor(system === 'light' ? 'light' : 'dark'), [system]);
  return ctx ?? fallback;
}

/**
 * Build a StyleSheet from the active theme. Pass a module-level factory so the
 * sheet is only rebuilt when the palette actually changes:
 *
 *   const makeStyles = ({ colors }: ThemeState) => StyleSheet.create({ … });
 *   const s = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (theme: ThemeState) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
