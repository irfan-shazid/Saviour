import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useThemedStyles, type ThemeState } from '../context/ThemeContext';
import {
  Banner,
  Button,
  Card,
  Field,
  ScreenHeader,
  SectionLabel,
  Segmented,
  ToggleRow,
} from '../components/ui';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import {
  DEFAULT_SETTINGS,
  clearAllData,
  clearIncidents,
  genId,
  setAuthPromptDismissed,
} from '../storage';
import { authClient, authConfigured, useSession } from '../services/auth';
import {
  hasDirectSmsPermission,
  isDirectSmsSupported,
  requestDirectSmsPermission,
} from '../../modules/direct-sms';
import type { Incident, ThemePreference } from '../types';
import { spacing } from '../theme';

const VERSION = '1.0.0';

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const COUNTDOWNS = [15, 30, 45, 60].map((s) => ({ label: `${s}s`, value: s }));

const SENSITIVITIES: { label: string; value: number; hint: string }[] = [
  { label: 'High', value: 2.2, hint: 'Catches lighter falls — more false alarms' },
  { label: 'Medium', value: 2.6, hint: 'Balanced (recommended)' },
  { label: 'Low', value: 3.2, hint: 'Only hard impacts — fewer false alarms' },
];

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState(settings.name);
  const [note, setNote] = useState(settings.medicalNote);
  const [testIncident, setTestIncident] = useState<Incident | null>(null);

  // Snap a stored value to the nearest preset so the segmented control always
  // shows a selection, even for settings written by an older build.
  const sensitivity = SENSITIVITIES.reduce((best, s) =>
    Math.abs(s.value - settings.sensitivity) < Math.abs(best.value - settings.sensitivity) ? s : best
  );

  const runTest = () =>
    setTestIncident({
      id: genId(),
      status: 'PENDING',
      source: 'FALL_DETECTION',
      impactMagnitude: 3.1,
      countdownSeconds: settings.countdownSeconds,
      detectedAt: new Date().toISOString(),
    });

  const confirmClearHistory = () =>
    Alert.alert('Clear history?', 'Deletes every recorded incident. Contacts and settings stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearIncidents() },
    ]);

  const confirmReset = () =>
    Alert.alert('Reset everything?', 'Erases your settings, contacts, and history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          await update(DEFAULT_SETTINGS);
          setName('');
          setNote('');
          Alert.alert('Done', 'Saviour has been reset to defaults.');
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Settings" subtitle="Everything is stored on this device only." />

      <Card>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          onEndEditing={() => update({ name: name.trim() })}
          onBlur={() => update({ name: name.trim() })}
          placeholder="e.g. Jane Doe"
          helper="Shown in the emergency text so contacts know who needs help."
        />
        <Field
          label="Medical note (optional)"
          value={note}
          onChangeText={setNote}
          onEndEditing={() => update({ medicalNote: note.trim() })}
          onBlur={() => update({ medicalNote: note.trim() })}
          placeholder="Blood type, allergies, medication…"
          multiline
          style={{ marginBottom: 0 }}
          helper="Added as a line in every alert."
        />
      </Card>

      <SectionLabel>Appearance</SectionLabel>
      <Segmented
        options={THEMES}
        value={settings.themePreference}
        onChange={(themePreference) => update({ themePreference })}
      />
      <Text style={styles.hint}>“System” follows your phone’s light/dark setting.</Text>

      <SectionLabel>Grace period before alerting</SectionLabel>
      <Segmented
        options={COUNTDOWNS}
        value={settings.countdownSeconds}
        onChange={(countdownSeconds) => update({ countdownSeconds })}
      />
      <Text style={styles.hint}>How long you have to tap “I’M OK” before contacts are texted.</Text>

      <SectionLabel>Fall detection sensitivity</SectionLabel>
      <Segmented
        options={SENSITIVITIES}
        value={sensitivity.value}
        onChange={(v) => update({ sensitivity: v })}
      />
      <Text style={styles.hint}>{sensitivity.hint}</Text>

      <SectionLabel>Sending alerts</SectionLabel>
      <AutoSendSection />

      <SectionLabel>Alerts</SectionLabel>
      <Card style={styles.stack}>
        <ToggleRow
          title="Auto-escalate"
          description="Open the pre-filled SMS automatically when the countdown ends"
          value={settings.autoEscalateEnabled}
          onValueChange={(v) => update({ autoEscalateEnabled: v })}
        />
        <View style={styles.divider} />
        <ToggleRow
          title="Alarm sound"
          description="Play a loud siren through the speaker so people nearby hear it"
          value={settings.alarmSoundEnabled}
          onValueChange={(v) => update({ alarmSoundEnabled: v })}
        />
        <View style={styles.divider} />
        <ToggleRow
          title="Vibration alarm"
          description="Loud looping buzz during the countdown"
          value={settings.sirenEnabled}
          onValueChange={(v) => update({ sirenEnabled: v })}
        />
      </Card>

      <Button
        title="Test the alarm"
        icon="🔔"
        variant="subtle"
        onPress={runTest}
        style={{ marginTop: spacing(2) }}
      />
      <Text style={styles.hint}>Previews the countdown. No contacts are alerted.</Text>

      {authConfigured && <AccountSection />}

      <SectionLabel>Data</SectionLabel>
      <Button title="Clear incident history" variant="ghost" size="md" onPress={confirmClearHistory} />
      <Button
        title="Reset everything"
        variant="ghost"
        size="md"
        onPress={confirmReset}
        style={{ marginTop: spacing(1) }}
      />

      <Text style={styles.about}>
        Saviour v{VERSION} · No account, no server. Alerts go out through your own SMS app. Fall
        detection uses on-device sensors and pauses when the app is backgrounded — keep it open while
        relying on it.
      </Text>

      {testIncident && (
        <EmergencyOverlay
          test
          incident={testIncident}
          siren={settings.sirenEnabled}
          alarmSound={settings.alarmSoundEnabled}
          onClose={() => setTestIncident(null)}
        />
      )}
    </ScrollView>
  );
}

/**
 * Explains, honestly, whether this build can text for help on its own — and
 * lets the user grant SEND_SMS if it can. The three states are genuinely
 * different products, so none of them is glossed over.
 */
function AutoSendSection() {
  const styles = useThemedStyles(makeStyles);
  const supported = isDirectSmsSupported();
  const [granted, setGranted] = useState(() => hasDirectSmsPermission());
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    setAsking(true);
    try {
      const ok = await requestDirectSmsPermission();
      setGranted(ok);
      if (!ok) {
        Alert.alert(
          'Permission denied',
          'Without SMS permission Saviour can only open your messaging app with the alert ready — someone still has to tap send. You can change this in Android app settings.'
        );
      }
    } finally {
      setAsking(false);
    }
  };

  if (!supported) {
    return (
      <Banner
        tone="info"
        icon="ℹ️"
        title="Alerts open your SMS app"
        message={
          Platform.OS === 'ios'
            ? 'iOS does not let any app send a text without you confirming it, so the alert opens pre-written and pre-addressed — one tap to send.'
            : 'Automatic sending needs a development build. In Expo Go the alert opens pre-written in your SMS app — one tap to send.'
        }
      />
    );
  }

  if (granted) {
    return (
      <Banner
        tone="safe"
        icon="✅"
        title="Alerts send automatically"
        message="Saviour will text your contacts with no taps needed when the countdown ends."
      />
    );
  }

  return (
    <Card>
      <Text style={styles.accountName}>Send texts automatically</Text>
      <Text style={styles.accountEmail}>
        Right now the alert only opens your SMS app and waits for a tap. Grant SMS permission and
        Saviour can text your contacts on its own — which matters most when you can’t reach your
        phone.
      </Text>
      <Button
        title="Allow Saviour to send SMS"
        onPress={ask}
        loading={asking}
        style={{ marginTop: spacing(2) }}
      />
    </Card>
  );
}

/**
 * Only rendered when an auth server is configured. Signing out returns the
 * user to the account screen; the on-device data is untouched either way.
 */
function AccountSection() {
  const styles = useThemedStyles(makeStyles);
  const { data } = useSession();
  const [busy, setBusy] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your contacts, settings and history stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await authClient.signOut();
            await setAuthPromptDismissed(false);
          } catch {
            Alert.alert('Could not sign out', 'Check your connection and try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <>
      <SectionLabel>Account</SectionLabel>
      {data?.user ? (
        <Card>
          <Text style={styles.accountName}>{data.user.name || data.user.email}</Text>
          <Text style={styles.accountEmail}>{data.user.email}</Text>
          <Button
            title="Sign out"
            variant="ghost"
            size="md"
            onPress={confirmSignOut}
            loading={busy}
            style={{ marginTop: spacing(2) }}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.accountEmail}>
            Not signed in. Saviour is running local-only — everything still works.
          </Text>
        </Card>
      )}
    </>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    container: { padding: spacing(2), paddingBottom: spacing(6) },
    accountName: { ...type.h3 },
    accountEmail: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    stack: { gap: spacing(2) },
    divider: { height: 1, backgroundColor: colors.borderSoft },
    hint: { color: colors.textFaint, fontSize: 12, marginTop: 8, lineHeight: 17 },
    about: {
      color: colors.textFaint,
      fontSize: 12,
      lineHeight: 18,
      marginTop: spacing(3),
      textAlign: 'center',
    },
  });
