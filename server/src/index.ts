import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { auth, authOptions } from './auth.js';

const PORT = Number(process.env.PORT ?? 8787);
const app = express();

// Create/patch the auth tables on boot so a fresh clone just runs. Better
// Auth refuses genuinely unsafe changes (a required column on a populated
// table), which surface here rather than silently corrupting the database.
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions);
if (toBeCreated.length || toBeAdded.length) {
  await runMigrations();
  console.log(
    `[auth] migrated: ${toBeCreated.length} table(s) created, ${toBeAdded.length} altered`
  );
}

// The app talks to this from a phone on the LAN (and from Expo Go's exp://
// origin), so credentials must be allowed for whatever origin turns up.
app.use(cors({ origin: true, credentials: true }));

// Better Auth owns everything under /api/auth. Mount it BEFORE express.json():
// the handler needs the raw body stream.
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'saviour-auth' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[auth] listening on http://0.0.0.0:${PORT}`);
  console.log(`[auth] set EXPO_PUBLIC_AUTH_URL in the app's .env to reach this server.`);
});
