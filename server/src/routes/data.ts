import { Router, type NextFunction, type Request, type Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { pool } from '../db.js';

/**
 * Saviour's own data, scoped to the signed-in user.
 *
 * The phone stays the source of truth — it has to keep working with no
 * network, since that is exactly when someone is most likely to need it — so
 * these endpoints are a sync target, not a live backend. Every query filters
 * on the session's user id; nothing takes a user id from the request body.
 */
export const dataRouter = Router();

interface AuthedRequest extends Request {
  userId?: string;
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Not signed in.' });
    }
    // No emailVerified gate: verification is switched off, so that flag is
    // false for every password account and gating on it would lock everyone
    // out of their own data.
    req.userId = session.user.id;
    next();
  } catch {
    res.status(401).json({ error: 'Could not verify session.' });
  }
}

dataRouter.use(requireUser);

/* ---------------------------------------------------------------- Settings */

dataRouter.get('/settings', async (req: AuthedRequest, res) => {
  const { rows } = await pool.query<{ data: unknown }>(
    'select data from app_settings where user_id = $1',
    [req.userId]
  );
  res.json({ settings: rows[0]?.data ?? null });
});

dataRouter.put('/settings', async (req: AuthedRequest, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Body must be { settings: object }.' });
  }
  await pool.query(
    `insert into app_settings (user_id, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
    [req.userId, JSON.stringify(settings)]
  );
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- Contacts */

dataRouter.get('/contacts', async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `select id, name, phone, relationship, priority
       from app_contact where user_id = $1 order by priority asc`,
    [req.userId]
  );
  res.json({ contacts: rows });
});

/**
 * Full replace. The client owns the ordering and the ids, so mirroring the
 * whole list is both simpler and less racy than diffing individual rows.
 */
dataRouter.put('/contacts', async (req: AuthedRequest, res) => {
  const contacts = req.body?.contacts;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Body must be { contacts: array }.' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from app_contact where user_id = $1', [req.userId]);
    for (const [index, c] of contacts.entries()) {
      if (!c?.id || !c?.name || !c?.phone) continue;
      await client.query(
        `insert into app_contact (id, user_id, name, phone, relationship, priority, updated_at)
         values ($1, $2, $3, $4, $5, $6, now())`,
        [c.id, req.userId, c.name, c.phone, c.relationship ?? null, c.priority ?? index + 1]
      );
    }
    await client.query('commit');
    res.json({ ok: true, count: contacts.length });
  } catch (e) {
    await client.query('rollback');
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save contacts.' });
  } finally {
    client.release();
  }
});

/* --------------------------------------------------------------- Incidents */

dataRouter.get('/incidents', async (req: AuthedRequest, res) => {
  const { rows } = await pool.query<{ data: unknown }>(
    `select data from app_incident where user_id = $1
      order by detected_at desc limit 200`,
    [req.userId]
  );
  res.json({ incidents: rows.map((r) => r.data) });
});

/** Upsert one incident. Called as incidents happen, not in bulk. */
dataRouter.put('/incidents/:id', async (req: AuthedRequest, res) => {
  const incident = req.body?.incident;
  if (!incident || typeof incident !== 'object' || !incident.detectedAt) {
    return res.status(400).json({ error: 'Body must be { incident: { detectedAt, … } }.' });
  }
  await pool.query(
    `insert into app_incident (id, user_id, data, detected_at, updated_at)
     values ($1, $2, $3::jsonb, $4, now())
     on conflict (id) do update
       set data = excluded.data, detected_at = excluded.detected_at, updated_at = now()
     where app_incident.user_id = $2`,
    [req.params.id, req.userId, JSON.stringify(incident), incident.detectedAt]
  );
  res.json({ ok: true });
});

dataRouter.delete('/incidents', async (req: AuthedRequest, res) => {
  await pool.query('delete from app_incident where user_id = $1', [req.userId]);
  res.json({ ok: true });
});
