import 'dotenv/config';

/**
 * One place that reads every environment variable, so a misconfigured
 * deployment fails at boot with a clear message rather than at 3am when
 * somebody actually falls over.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Copy server/.env.example to server/.env and fill it in.`
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  // --- Database ---------------------------------------------------------
  /** Neon Postgres connection string (use the POOLED one for a server). */
  DATABASE_URL: required('DATABASE_URL'),

  // --- Auth -------------------------------------------------------------
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  /** Public URL this server answers on. Must be reachable from the phone. */
  BETTER_AUTH_URL: optional('BETTER_AUTH_URL', 'http://localhost:8787'),
  PORT: Number(optional('PORT', '8787')),
  /** Matches `expo.scheme` in app.json — used for OAuth + verification returns. */
  APP_SCHEME: optional('APP_SCHEME', 'saviour'),

  // --- Google OAuth -----------------------------------------------------
  GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),

  /** Extra allowed origins, comma-separated. See `trustedOrigins` below. */
  TRUSTED_ORIGINS: optional('TRUSTED_ORIGINS'),

  NODE_ENV: optional('NODE_ENV', 'development'),
} as const;

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const isProduction = env.NODE_ENV === 'production';

/**
 * Origins Better Auth will accept a request from.
 *
 * Matching is exact for http(s) patterns unless the pattern contains `*`, in
 * which case it is glob-matched against the origin. So the Expo dev server —
 * which lands on an arbitrary localhost port — needs a wildcard, and that
 * wildcard is confined to development.
 */
export const trustedOrigins: string[] = (() => {
  const origins = [
    `${env.APP_SCHEME}://`, // the app's own scheme, for OAuth returns
    'exp://', // Expo Go
    'exp://*',
    env.BETTER_AUTH_URL,
  ];

  if (!isProduction) {
    // Expo web picks its own port (8081, 19006, …) and Metro may shift it.
    origins.push('http://localhost:*', 'http://127.0.0.1:*');
  }

  origins.push(
    ...env.TRUSTED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return [...new Set(origins)];
})();
