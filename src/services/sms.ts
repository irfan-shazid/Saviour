import * as SMS from 'expo-sms';
import type { EmergencyContact, IncidentSource, SmsOutcome } from '../types';
import type { Fix } from '../utils/location';
import { mapsUrl } from '../utils/format';

interface MessageParts {
  name?: string;
  source: IncidentSource;
  fix: Pick<Fix, 'latitude' | 'longitude' | 'accuracy' | 'address'>;
  /** Optional line the user set in Settings (blood type, allergies, meds…). */
  medicalNote?: string;
}

/**
 * Build the emergency text. Contacts get who it is, what happened, a tappable
 * Google Maps link to the last known location, and any medical note.
 */
export function buildEmergencyMessage({ name, source, fix, medicalNote }: MessageParts): string {
  const who = name?.trim() ? name.trim() : 'Someone using Saviour';
  const lines = [
    `\u{1F198} EMERGENCY — ${who} may need help.`,
    source === 'MANUAL_SOS'
      ? 'They triggered a manual SOS.'
      : 'A possible fall was detected and they did not respond.',
  ];

  if (fix.address) lines.push(`Location: ${fix.address}`);
  if (fix.latitude != null && fix.longitude != null) {
    lines.push(`Live map: ${mapsUrl(fix.latitude, fix.longitude)}`);
    if (fix.accuracy != null) lines.push(`(accurate to ~${Math.round(fix.accuracy)} m)`);
  } else {
    lines.push('Location is currently unavailable.');
  }

  if (medicalNote?.trim()) lines.push(`Medical: ${medicalNote.trim()}`);

  lines.push('— sent automatically by Saviour');
  return lines.join('\n');
}

/**
 * Open the device SMS composer pre-addressed to every contact with the
 * emergency message. There is no server, so the message is delivered through
 * the phone's own SMS app — the user (or a bystander) confirms the send.
 *
 * Returns how it went so the UI and history can reflect reality instead of
 * pretending an alert was delivered when it wasn't.
 */
export async function sendEmergencySMS(
  contacts: EmergencyContact[],
  message: string
): Promise<SmsOutcome> {
  if (contacts.length === 0) return 'no-contacts';

  const available = await SMS.isAvailableAsync().catch(() => false);
  if (!available) return 'unavailable';

  try {
    const { result } = await SMS.sendSMSAsync(
      contacts.map((c) => c.phone),
      message
    );
    // Android never reports delivery, so it always resolves as 'unknown'.
    return result as SmsOutcome;
  } catch {
    return 'unavailable';
  }
}
