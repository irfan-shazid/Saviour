import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useThemedStyles, type ThemeState } from '../context/ThemeContext';
import {
  Button,
  Card,
  Field,
  ScreenHeader,
  SectionLabel,
  Segmented,
  ToggleRow,
} from '../components/ui';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { DEFAULT_SETTINGS, clearAllData, clearIncidents, genId } from '../storage';
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
          title="Alarm siren"
          description="Loud looping vibration during the countdown"
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
          onClose={() => setTestIncident(null)}
        />
      )}
    </ScrollView>
  );
}

const makeStyles = ({ colors }: ThemeState) =>
  StyleSheet.create({
    container: { padding: spacing(2), paddingBottom: spacing(6) },
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
