/**
 * One-command health check for a fresh deployment:  npm run verify
 *
 * Connects to Neon, runs every migration, lists the resulting tables and
 * reports which optional features are configured. Safe to re-run — the
 * migrations are idempotent and nothing is deleted.
 */
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from './auth.js';
import { assertConnection, migrateAppTables, pool } from './db.js';
import { env, googleEnabled } from './env.js';

const EXPECTED = [
  'user',
  'session',
  'account',
  'verification',
  'app_settings',
  'app_contact',
  'app_incident',
];

function tick(ok: boolean) {
  return ok ? '[32m✓[0m' : '[31m✗[0m';
}

async function main() {
  console.log('\n— Saviour server verification —\n');

  console.log('1. Database');
  await assertConnection();

  console.log('\n2. Migrations');
  const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions);
  if (toBeCreated.length || toBeAdded.length) {
    await runMigrations();
    console.log(`   ${tick(true)} auth: ${toBeCreated.length} created, ${toBeAdded.length} altered`);
  } else {
    console.log(`   ${tick(true)} auth tables already up to date`);
  }
  await migrateAppTables();

  console.log('\n3. Tables');
  const { rows } = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`
  );
  const present = new Set(rows.map((r) => r.table_name));
  let allPresent = true;
  for (const t of EXPECTED) {
    const ok = present.has(t);
    if (!ok) allPresent = false;
    console.log(`   ${tick(ok)} ${t}`);
  }

  console.log('\n4. Features');
  console.log(
    `   ${tick(googleEnabled)} Google sign-in${googleEnabled ? '' : '  (GOOGLE_CLIENT_ID / _SECRET unset)'}`
  );
  console.log('   • email verification: OFF (no SMTP needed, no codes, no links)');

  console.log('\n5. Reachability');
  console.log(`   public URL: ${env.BETTER_AUTH_URL}`);
  console.log(`   Google callback must be registered as:`);
  console.log(`     ${env.BETTER_AUTH_URL}/api/auth/callback/google`);
  console.log(`   The app's EXPO_PUBLIC_AUTH_URL must equal ${env.BETTER_AUTH_URL}`);

  console.log(`\n${allPresent ? 'All expected tables present.' : 'Some tables are MISSING.'}\n`);
  await pool.end();
  process.exit(allPresent ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n[31mVerification failed:[0m ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
