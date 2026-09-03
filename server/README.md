# Saviour server

Auth and data backend for the Saviour app.

- **[Better Auth](https://better-auth.com)** — Google sign-in and email/password
- **[Neon](https://neon.tech)** Postgres — auth tables *and* app data (contacts, incidents, settings)
- **No email verification** — no links, no OTP codes, no SMTP
- Express transport, self-migrating on boot

Accounts are optional in the app. Saviour's fall detection, SOS and contacts are
on-device, so it runs fine with no server at all.

## No verification step

Sign-up creates the account and signs the user straight in (`autoSignIn`), and
sign-in never checks `emailVerified`. Better Auth only sends mail when a
`sendVerificationEmail` handler is supplied, and none is — so the server needs
no SMTP configuration and nothing is ever emailed.

The trade-off worth knowing: **email addresses are unproven.** Anyone can sign
up as anyone, and password reset is unavailable, since that would also need
outbound mail. Google accounts are the exception — Google has verified those.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env` — every variable is documented in
[`.env.example`](.env.example). The two that are genuinely required:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Neon console → your project → **Connection Details**. Use the **pooled** string (host contains `-pooler`), keep `?sslmode=require`. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |

Then check everything at once:

```bash
npm run verify
```

That connects to Neon, runs all migrations, lists the tables it created, and
tells you which optional features are configured. Run it before anything else.

Then:

```bash
npm run dev     # watch mode
npm start       # once
```

## Tables

Better Auth owns `user`, `session`, `account`, `verification`. Saviour adds:

| Table | Holds |
| --- | --- |
| `app_settings` | One JSONB row per user |
| `app_contact` | Emergency contacts, ordered by `priority` |
| `app_incident` | Incident history as JSONB, newest first |

Every app row is `references "user"(id) on delete cascade`, and every query in
[`src/routes/data.ts`](src/routes/data.ts) filters on the session's user id —
no endpoint takes a user id from the request body.

## Sync model

The **phone is the source of truth.** Saviour must work with no signal, which
is exactly when someone is most likely to need it, so `/api/data/*` is a sync
target rather than a live backend. The app reads locally, writes locally, and
mirrors up in the background; a failed sync never blocks an alert.

On sign-in, a device with no contacts pulls the server's copy; a device that
already has contacts pushes its own.

## Google sign-in

1. <https://console.cloud.google.com/apis/credentials>
2. **Create credentials → OAuth client ID → Web application**
3. Authorised redirect URI, exactly:
   `<BETTER_AUTH_URL>/api/auth/callback/google`
4. Put the ID and secret in `.env`, restart.

> **Expo Go caveat.** OAuth returns through the app's `saviour://` scheme, which
> Expo Go does not own — it serves everything under `exp://`. Expect Google
> sign-in to work in a **development build** but not reliably in Expo Go.
> Email/password works in both, being a plain HTTP request.

## Deploying

Nothing is tied to localhost. Set the same variables on your host, point
`BETTER_AUTH_URL` at the public HTTPS URL, add that URL's
`/api/auth/callback/google` to the Google credentials, and update
`EXPO_PUBLIC_AUTH_URL` in the app's `.env`.

Neon is already managed Postgres, so it needs no change between development
and production beyond using a separate branch or project.
