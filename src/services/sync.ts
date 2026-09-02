import { AUTH_BASE_URL, authClient, authConfigured } from './auth';
import {
  loadContacts,
  loadIncidents,
  loadSettings,
  saveContacts,
  saveSettings,
} from '../storage';
import type { Incident } from '../types';

/**
 * Mirrors on-device data into Neon for the signed-in user.
 *
 * The phone stays the source of truth on purpose. Saviour has to work with no
 * signal — which is exactly when someone is most likely to need it — so
 * nothing here is on the critical path of detecting a fall or sending an
 * alert. Every function swallows its errors and returns a boolean; a failed
 * sync must never surface as a blocked SOS.
 */

async function authedFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!authConfigured) return null;
  try {
    // The Expo client keeps the session cookie in SecureStore rather than a
    // cookie jar, so it has to be attached by hand on plain fetches.
    const cookie = await authClient.getCookie();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    if (cookie) headers.Cookie = cookie;

    return await fetch(`${AUTH_BASE_URL}${path}`, { ...init, headers });
  } catch {
    return null;
  }
}

/** Push contacts + settings up. Call after the user changes either. */
export async function syncUp(): Promise<boolean> {
  if (!authConfigured) return false;
  try {
    const [contacts, settings] = await Promise.all([loadContacts(), loadSettings()]);
    const [a, b] = await Promise.all([
      authedFetch('/api/data/contacts', {
        method: 'PUT',
        body: JSON.stringify({ contacts }),
      }),
      authedFetch('/api/data/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }),
    ]);
    return Boolean(a?.ok && b?.ok);
  } catch {
    return false;
  }
}

/** Push one incident as it happens. */
export async function syncIncident(incident: Incident): Promise<boolean> {
  const res = await authedFetch(`/api/data/incidents/${encodeURIComponent(incident.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ incident }),
  });
  return Boolean(res?.ok);
}

/**
 * Pull the server's copy down over local storage. Used when signing in on a
 * new device, where there is nothing local worth keeping.
 */
export async function syncDown(): Promise<boolean> {
  if (!authConfigured) return false;
  try {
    const [contactsRes, settingsRes] = await Promise.all([
      authedFetch('/api/data/contacts'),
      authedFetch('/api/data/settings'),
    ]);
    if (!contactsRes?.ok || !settingsRes?.ok) return false;

    const { contacts } = (await contactsRes.json()) as { contacts?: unknown };
    const { settings } = (await settingsRes.json()) as { settings?: unknown };

    if (Array.isArray(contacts) && contacts.length > 0) {
      await saveContacts(contacts as Awaited<ReturnType<typeof loadContacts>>);
    }
    if (settings && typeof settings === 'object') {
      const merged = { ...(await loadSettings()), ...(settings as object) };
      await saveSettings(merged);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Called once after sign-in. Adopts the server's copy on a device with no
 * contacts yet, otherwise treats this device as authoritative and uploads.
 */
export async function reconcileAfterSignIn(): Promise<void> {
  try {
    const local = await loadContacts();
    if (local.length === 0) await syncDown();
    else await syncUp();
  } catch {
    // Never let a sync decision block getting into the app.
  }
}
