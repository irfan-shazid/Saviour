import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { pool } from './db.js';
import { env, googleEnabled, trustedOrigins } from './env.js';

if (!googleEnabled) {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in is disabled. ' +
      'Email and password still work.'
  );
}

/**
 * Kept separate from the built instance because `getMigrations()` takes the
 * options object, not the instance.
 *
 * There is **no email verification of any kind** — no link, no OTP code, no
 * outbound mail at all. Sign-up creates the account and signs the user
 * straight in. Better Auth only mails anything when a `sendVerificationEmail`
 * / `sendResetPassword` handler is supplied, and deliberately none is, so the
 * server needs no SMTP configuration.
 */
export const authOptions = {
  appName: 'Saviour',
  database: pool,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    /** Straight into a session — there is nothing to confirm first. */
    autoSignIn: true,
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},

  // Signing in with Google on an address that already has a password account
  // attaches to it rather than creating a second user.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  // Built in env.ts: the app scheme, Expo Go, this server, plus localhost
  // wildcards in development for the Expo web dev server.
  trustedOrigins,

  plugins: [expo()],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
