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

  // --- Email (verification links) ---------------------------------------
  SMTP_HOST: optional('SMTP_HOST'),
  SMTP_PORT: Number(optional('SMTP_PORT', '587')),
  SMTP_USER: optional('SMTP_USER'),
  SMTP_PASS: optional('SMTP_PASS'),
  /** true for port 465 (implicit TLS), false for 587 (STARTTLS). */
  SMTP_SECURE: optional('SMTP_SECURE', 'false') === 'true',
  EMAIL_FROM: optional('EMAIL_FROM', 'Saviour <no-reply@saviour.app>'),
} as const;

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const emailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
