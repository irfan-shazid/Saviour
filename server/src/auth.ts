import 'dotenv/config';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';

const {
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL = 'http://localhost:8787',
  DATABASE_PATH = './saviour-auth.db',
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  APP_SCHEME = 'saviour',
} = process.env;

if (!BETTER_AUTH_SECRET) {
  throw new Error(
    'BETTER_AUTH_SECRET is required. Copy server/.env.example to server/.env and set one ' +
      '(`openssl rand -base64 32`).'
  );
}

const googleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
if (!googleConfigured) {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in is disabled. ' +
      'Email and password still work.'
  );
}

/**
 * Kept separate from the `auth` instance because `getMigrations()` (run at
 * server boot) takes the options object, not the built instance.
 */
export const authOptions = {
  appName: 'Saviour',
  database: new Database(DATABASE_PATH),
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    // No verification email anywhere in this config: sign-up creates the
    // account and signs the user straight in. Better Auth only sends a
    // verification mail when `emailVerification.sendVerificationEmail` is
    // provided, and it deliberately is not.
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
  },

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: GOOGLE_CLIENT_ID!,
          clientSecret: GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  // The app opens OAuth in a browser and is handed back through its custom
  // scheme; Expo Go instead uses an exp:// URL, so both are trusted.
  trustedOrigins: [`${APP_SCHEME}://`, 'exp://', 'exp://*'],

  plugins: [expo()],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
