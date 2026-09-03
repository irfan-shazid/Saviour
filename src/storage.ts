import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyContact, Incident, Settings } from './types';

// Local-first storage: the phone is the source of truth for everything the
// safety features need, so Saviour keeps working with no signal. These three
// keys hold the whole app state — settings, emergency contacts and incident
// history — and services/sync.ts mirrors them to the server in the background.
const KEYS = {
  settings: 'saviour.settings',
  contacts: 'saviour.contacts',
  incidents: 'saviour.incidents',
} as const;

const MAX_HISTORY = 100;

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  themePreference: 'system',
  countdownSeconds: 30,
  sensitivity: 2.6,
  autoEscalateEnabled: true,
  medicalNote: '',
  sirenEnabled: true,
  alarmSoundEnabled: true,
};

/** A best-effort unique id — no server to hand them out anymore. */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---- Settings ------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  const stored = await readJSON<Partial<Settings>>(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJSON(KEYS.settings, settings);
}

// ---- Contacts ------------------------------------------------------------

export async function loadContacts(): Promise<EmergencyContact[]> {
  const contacts = await readJSON<EmergencyContact[]>(KEYS.contacts, []);
  return contacts.sort((a, b) => a.priority - b.priority);
}

export async function saveContacts(contacts: EmergencyContact[]): Promise<void> {
  await writeJSON(KEYS.contacts, contacts);
}

/** Re-number `priority` from 1..n in array order and persist. */
export async function saveContactOrder(contacts: EmergencyContact[]): Promise<EmergencyContact[]> {
  const renumbered = contacts.map((c, i) => ({ ...c, priority: i + 1 }));
  await saveContacts(renumbered);
  return renumbered;
}

// ---- Incident history ----------------------------------------------------

export async function loadIncidents(): Promise<Incident[]> {
  const incidents = await readJSON<Incident[]>(KEYS.incidents, []);
  return incidents.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

/** Insert or update an incident in the history (newest first, capped). */
export async function upsertIncident(incident: Incident): Promise<void> {
  const incidents = await readJSON<Incident[]>(KEYS.incidents, []);
  const idx = incidents.findIndex((i) => i.id === incident.id);
  if (idx >= 0) incidents[idx] = incident;
  else incidents.unshift(incident);
  await writeJSON(KEYS.incidents, incidents.slice(0, MAX_HISTORY));
}

/** Wipe incident history only (contacts + settings kept). */
export async function clearIncidents(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.incidents);
}

/** Full reset — settings, contacts, and history. */
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.settings, KEYS.contacts, KEYS.incidents]);
}
