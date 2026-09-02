import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { pool } from './db.js';
import { env, googleEnabled } from './env.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './email.js';

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
 * Verification is **link-based**: Better Auth mails a URL, the user taps it,
 * and the address is confirmed. There is deliberately no `emailOTP` plugin —
 * no codes to type in anywhere.
 */
export const authOptions = {
  appName: 'Saviour',
  database: pool,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    /** Sign-in is refused until the address is confirmed. */
    requireEmailVerification: true,
    /** Nothing to auto-sign-in to yet — the user must verify first. */
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },

  emailVerification: {
    /** The mail goes out as part of sign-up, unprompted. */
    sendOnSignUp: true,
    /** Tapping the link also signs them in, so there's no second step. */
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // one hour
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url, user.name);
    },
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},

  // Google already proves the address, so those accounts skip verification.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  // OAuth and verification links come back into the app through its custom
  // scheme; Expo Go instead serves everything under exp://.
  trustedOrigins: [`${env.APP_SCHEME}://`, 'exp://', 'exp://*'],

  plugins: [expo()],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
