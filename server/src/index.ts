import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { auth, authOptions } from './auth.js';
import { assertConnection, migrateAppTables } from './db.js';
import { verifyEmailTransport } from './email.js';
import { env, emailEnabled, googleEnabled } from './env.js';
import { dataRouter } from './routes/data.js';

const app = express();

// Fail fast and loudly if Neon is unreachable — better than serving 500s.
await assertConnection();

// Better Auth's own tables (user, session, account, verification), then ours.
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions);
if (toBeCreated.length || toBeAdded.length) {
  await runMigrations();
  console.log(
    `[auth] migrated: ${toBeCreated.length} table(s) created, ${toBeAdded.length} altered`
  );
}
await migrateAppTables();
await verifyEmailTransport();

// The app calls this from a phone on the LAN and from Expo Go's exp:// origin.
app.use(cors({ origin: true, credentials: true }));

// Better Auth owns /api/auth/*. Mount BEFORE express.json() — the handler
// needs the raw body stream.
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json({ limit: '1mb' }));

app.use('/api/data', dataRouter);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'saviour-auth',
    google: googleEnabled,
    email: emailEnabled,
  });
});

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT}`);
  console.log(`[server] public URL: ${env.BETTER_AUTH_URL}`);
  if (!emailEnabled) {
    console.warn('[server] email verification is REQUIRED but SMTP is unset — nobody can sign in.');
  }
});
