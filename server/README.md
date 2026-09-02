# Saviour auth server

A [Better Auth](https://better-auth.com) server providing Google and
email/password sign-in for the Saviour app. SQLite for storage, Express for
transport. Tables are created automatically on first boot.

**No verification emails.** Sign-up creates the account and signs the user in
immediately. Better Auth only sends a verification mail when
`emailVerification.sendVerificationEmail` is configured, and it deliberately
isn't — see [`src/auth.ts`](src/auth.ts).

Accounts are optional in the app. Saviour's fall detection, SOS and contacts
are entirely on-device, so the app runs fine with no server at all.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Then edit `.env`:

| Variable | What it's for |
| --- | --- |
| `BETTER_AUTH_SECRET` | Session signing key. Generate with `openssl rand -base64 32`. **Required.** |
| `BETTER_AUTH_URL` | Public URL the server is reachable at. For a phone on your Wi-Fi this must be your machine's **LAN IP**, not `localhost`. |
| `PORT` | Defaults to `8787`. |
| `DATABASE_PATH` | SQLite file. Defaults to `./saviour-auth.db`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Leave blank for email/password only. |

Run it:

```bash
npm run dev     # watch mode
npm start       # once
```

You should see:

```
[auth] migrated: 4 table(s) created, 0 altered
[auth] listening on http://0.0.0.0:8787
```

Check it: `curl http://localhost:8787/health`

## Point the app at it

In the **project root** (not `server/`):

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_AUTH_URL` to the same address as `BETTER_AUTH_URL`, then
restart Metro with `npx expo start -c` — `EXPO_PUBLIC_*` values are inlined at
bundle time, so a plain reload won't pick up a change.

Leave it blank to disable the account screen entirely.

## Google sign-in

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. **Create credentials → OAuth client ID → Web application.**
3. Add an authorised redirect URI of exactly:
   `<BETTER_AUTH_URL>/api/auth/callback/google`
   e.g. `http://192.168.0.100:8787/api/auth/callback/google`
4. Put the client ID and secret in `server/.env` and restart the server.

> **Expo Go caveat.** Google sign-in redirects back through the app's custom
> `saviour://` scheme, which Expo Go does not own — it serves everything under
> `exp://`. Expect Google sign-in to work in a **development build** but not
> reliably in Expo Go. Email/password works in both, since it is a plain HTTP
> request with no redirect.

## Deploying

Nothing here is tied to localhost. Set the same environment variables on your
host, point `BETTER_AUTH_URL` at the public HTTPS URL, add that URL's
`/api/auth/callback/google` to the Google credentials, and update
`EXPO_PUBLIC_AUTH_URL` in the app. For anything beyond a handful of users,
swap SQLite for Postgres — Better Auth takes any Kysely dialect.
