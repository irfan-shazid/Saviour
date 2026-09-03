import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';

/**
 * Where the Better Auth server lives. Set EXPO_PUBLIC_AUTH_URL in `.env` —
 * on a physical phone this must be your machine's LAN IP, since the phone
 * cannot reach your laptop's localhost.
 */
export const AUTH_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? '';

/** Accounts are optional: with no server configured the app runs local-only. */
export const authConfigured = AUTH_BASE_URL.length > 0;

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [
    expoClient({
      scheme: 'saviour',
      storagePrefix: 'saviour',
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Where an OAuth round-trip should land the user back.
 *
 * On native this is the app's registered scheme. In a browser that scheme
 * resolves to nothing, so the page's own origin is used instead — otherwise
 * Google returns to a URL the browser cannot open.
 */
export function oauthCallbackURL(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'saviour://';
}

/** Turn Better Auth's error shapes into something worth showing a user. */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: string; statusText?: string; status?: number };
    if (e.message) return e.message;
    if (e.status === 401) return 'That email and password don’t match.';
    if (e.statusText) return e.statusText;
  }
  return fallback;
}
