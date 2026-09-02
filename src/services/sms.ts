import * as SMS from 'expo-sms';
import {
  hasDirectSmsPermission,
  isDirectSmsSupported,
  sendDirectSms,
} from '../../modules/direct-sms';
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
 * Deliver the emergency alert, preferring to send it outright.
 *
 * Two paths, in order:
 *
 *  1. **Direct send** — Android with the SEND_SMS permission in a development
 *     or production build. The text goes out through the radio with no
 *     composer and no tap, which is the point: someone who has just fallen
 *     cannot be relied on to press send.
 *  2. **Composer fallback** — iOS (which has no silent-send API at all) and
 *     Expo Go (where the native module isn't in the binary). Opens the SMS
 *     app pre-filled and pre-addressed.
 *
 * Returns what actually happened so the UI and history reflect reality rather
 * than pretending an alert was delivered when it wasn't.
 */
export async function sendEmergencySMS(
  contacts: EmergencyContact[],
  message: string
): Promise<SmsOutcome> {
  if (contacts.length === 0) return 'no-contacts';
  const numbers = contacts.map((c) => c.phone);

  if (isDirectSmsSupported() && hasDirectSmsPermission()) {
    try {
      const { sentParts, failedParts } = await sendDirectSms(numbers, message);
      if (sentParts > 0 && failedParts === 0) return 'auto-sent';
      if (sentParts > 0) return 'auto-partial';
      // Nothing got out — fall through to the composer rather than report
      // success on an alert that never left the phone.
    } catch {
      // Radio refused, permission revoked mid-flight, SIM missing… same call:
      // give the user a composer instead of a dead end.
    }
  }

  const available = await SMS.isAvailableAsync().catch(() => false);
  if (!available) return 'unavailable';

  try {
    const { result } = await SMS.sendSMSAsync(numbers, message);
    // Android never reports delivery from the composer, so it always
    // resolves as 'unknown'.
    return result as SmsOutcome;
  } catch {
    return 'unavailable';
  }
}
