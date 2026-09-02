import pg from 'pg';
import { env } from './env.js';

/**
 * Postgres pool, pointed at Neon.
 *
 * Neon terminates TLS at its proxy and issues certs its own way, so
 * `rejectUnauthorized: false` is the connection style Neon documents for
 * node-postgres. The connection is still encrypted; what's skipped is chain
 * verification against the local CA bundle.
 *
 * Use Neon's **pooled** connection string (the host with `-pooler` in it) —
 * a long-lived server should not hold a direct compute connection open.
 */
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // A pooled client dying in the background must not take the process down.
  console.error('[db] idle client error:', err.message);
});

/** Fails fast at boot with a useful message rather than on first request. */
export async function assertConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ version: string }>('select version()');
    console.log(`[db] connected — ${rows[0]?.version?.split(',')[0] ?? 'postgres'}`);
  } finally {
    client.release();
  }
}

/**
 * Application tables. Better Auth manages its own (user, session, account,
 * verification) through its migrator; these are Saviour's, and every row is
 * owned by a user so a signed-in phone only ever sees its own data.
 *
 * Written idempotently so boot is safe to repeat.
 */
export async function migrateAppTables(): Promise<void> {
  await pool.query(`
    create table if not exists app_settings (
      user_id text primary key references "user"(id) on delete cascade,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists app_contact (
      id text primary key,
      user_id text not null references "user"(id) on delete cascade,
      name text not null,
      phone text not null,
      relationship text,
      priority integer not null default 1,
      updated_at timestamptz not null default now()
    );
    create index if not exists app_contact_user_idx
      on app_contact (user_id, priority);

    create table if not exists app_incident (
      id text primary key,
      user_id text not null references "user"(id) on delete cascade,
      data jsonb not null,
      detected_at timestamptz not null,
      updated_at timestamptz not null default now()
    );
    create index if not exists app_incident_user_idx
      on app_incident (user_id, detected_at desc);
  `);
  console.log('[db] application tables ready');
}
