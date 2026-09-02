import type { ThemePreference } from './theme';

export type { ThemePreference };

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string | null;
  priority: number;
}

/** All user-tunable settings, stored on-device (no accounts, no server). */
export interface Settings {
  /** Optional name used in the emergency message so contacts know who it is. */
  name: string;
  /** Light, dark, or follow the OS. */
  themePreference: ThemePreference;
  countdownSeconds: number;
  /** Impact threshold in g for fall detection (lower = more sensitive). */
  sensitivity: number;
  /**
   * When true, the "Are you OK?" countdown reaching 0 opens the SMS composer
   * automatically. When false, it waits on a persistent prompt for a tap.
   */
  autoEscalateEnabled: boolean;
  /** Optional line appended to every alert (blood type, allergies, meds…). */
  medicalNote: string;
  /** Loud looping vibration alarm during the countdown. */
  sirenEnabled: boolean;
  /** Audible siren played through the speaker during the countdown. */
  alarmSoundEnabled: boolean;
}

export type IncidentStatus = 'PENDING' | 'SAFE' | 'EMERGENCY' | 'CANCELLED';

export type IncidentSource = 'FALL_DETECTION' | 'MANUAL_SOS';

/**
 * Outcome of trying to open the SMS composer for the emergency alert.
 * Mirrors expo-sms results plus our own "unavailable"/"no-contacts" states.
 */
export type SmsOutcome = 'sent' | 'unknown' | 'cancelled' | 'unavailable' | 'no-contacts';

export interface Incident {
  id: string;
  status: IncidentStatus;
  source: IncidentSource;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  impactMagnitude?: number | null;
  countdownSeconds: number;
  detectedAt: string;
  respondedAt?: string | null;
  escalatedAt?: string | null;
  /** Contacts the emergency SMS was addressed to when escalated. */
  contactsAlerted?: { name: string; phone: string }[];
  smsOutcome?: SmsOutcome;
}
