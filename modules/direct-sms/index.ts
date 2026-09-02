import { Platform, PermissionsAndroid } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DirectSmsResult {
  /** Message parts the radio confirmed as sent. */
  sentParts: number;
  /** Message parts the radio reported as failed. */
  failedParts: number;
  /** How many recipients were addressed. */
  recipients: number;
}

interface DirectSmsNativeModule {
  isSupported(): boolean;
  hasPermission(): boolean;
  sendSms(phoneNumbers: string[], message: string): Promise<DirectSmsResult>;
}

/**
 * Null in Expo Go and on the web, where the native module isn't in the binary.
 * Every call site must handle that and fall back to the SMS composer.
 */
const native = requireOptionalNativeModule<DirectSmsNativeModule>('DirectSms');

/** Whether this build can send SMS with no user interaction at all. */
export function isDirectSmsSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/** Whether SEND_SMS has already been granted. */
export function hasDirectSmsPermission(): boolean {
  try {
    return native?.hasPermission() ?? false;
  } catch {
    return false;
  }
}

/**
 * Ask for SEND_SMS. Returns true if the app may now send.
 *
 * Worth being blunt in the rationale: this is the permission that lets Saviour
 * text for help when the user cannot, which is the entire product.
 */
export async function requestDirectSmsPermission(): Promise<boolean> {
  if (!isDirectSmsSupported()) return false;
  if (hasDirectSmsPermission()) return true;

  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS, {
      title: 'Allow Saviour to send texts',
      message:
        'Saviour needs to send SMS so it can alert your emergency contacts automatically after a fall — without waiting for you to tap send.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Send the message to every recipient with no composer and no user tap.
 * Throws when unsupported, unpermitted, or the radio rejects it — callers are
 * expected to fall back to the composer rather than swallow the failure.
 */
export async function sendDirectSms(
  phoneNumbers: string[],
  message: string
): Promise<DirectSmsResult> {
  if (!native) throw new Error('Direct SMS is not available in this build.');
  return native.sendSms(phoneNumbers, message);
}
