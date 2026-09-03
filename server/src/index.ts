import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { auth, authOptions } from './auth.js';
import { assertConnection, migrateAppTables } from './db.js';
import { env, googleEnabled } from './env.js';
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
    emailVerification: false,
  });
});

// Last-resort error handler. Express only routes 4-arity middleware here, and
// without it a throw from a route ends as a hung request.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled route error:', err instanceof Error ? err.message : err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal error.' });
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT}`);
  console.log(`[server] public URL: ${env.BETTER_AUTH_URL}`);
});

// A port clash is the most common startup failure and node's default output
// for it is a wall of stack trace. Say what actually went wrong.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[server] Port ${env.PORT} is already in use — something else is running there.\n` +
        `         Free it, or set PORT (and BETTER_AUTH_URL) in server/.env to another port.\n` +
        `         Remember to update EXPO_PUBLIC_AUTH_URL in the app's .env and the Google\n` +
        `         redirect URI to match.\n`
    );
    process.exit(1);
  }
  console.error('[server] listen error:', err.message);
  process.exit(1);
});

// Node terminates on an unhandled rejection by default. For a service whose
// whole job is to be reachable, staying up and logging beats vanishing.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err.message);
});
