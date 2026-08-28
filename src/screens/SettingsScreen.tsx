import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Button, Card, Chip, Field, ScreenHeader, SectionLabel } from '../components/ui';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { DEFAULT_SETTINGS, clearAllData, clearIncidents, genId } from '../storage';
import type { Incident } from '../types';
import { colors, spacing, type } from '../theme';

const VERSION = '1.0.0';
const COUNTDOWNS = [15, 30, 45, 60];
const SENSITIVITIES: { label: string; value: number; hint: string }[] = [
  { label: 'High', value: 2.2, hint: 'Catches lighter falls — more false alarms' },
  { label: 'Medium', value: 2.6, hint: 'Balanced (recommended)' },
  { label: 'Low', value: 3.2, hint: 'Only hard impacts — fewer false alarms' },
];

export function SettingsScreen() {
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const [note, setNote] = useState(settings.medicalNote);
  const [testIncident, setTestIncident] = useState<Incident | null>(null);

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

      <Card style={styles.card}>
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

      <SectionLabel>Grace period before alerting</SectionLabel>
      <View style={styles.chipRow}>
        {COUNTDOWNS.map((sec) => (
          <Chip
            key={sec}
            label={`${sec}s`}
            active={settings.countdownSeconds === sec}
            onPress={() => update({ countdownSeconds: sec })}
          />
        ))}
      </View>

      <SectionLabel>Fall detection sensitivity</SectionLabel>
      <View style={{ gap: spacing(1) }}>
        {SENSITIVITIES.map((s) => {
          const active = Math.abs(settings.sensitivity - s.value) < 0.01;
          return (
            <Card
              key={s.value}
              padded={false}
              style={[styles.sensRow, active && { borderColor: colors.primary }]}
            >
              <Chip label={s.label} active={active} onPress={() => update({ sensitivity: s.value })} />
              <Text style={styles.sensHint}>{s.hint}</Text>
            </Card>
          );
        })}
      </View>

      <Card style={[styles.card, styles.switchRow, { marginTop: spacing(2) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Auto-escalate</Text>
          <Text style={styles.meta}>Open the SMS alert automatically on no response</Text>
        </View>
        <Switch
          value={settings.autoEscalateEnabled}
          onValueChange={(v) => update({ autoEscalateEnabled: v })}
          trackColor={{ true: colors.safe, false: colors.border }}
          thumbColor="#fff"
        />
      </Card>

      <Card style={[styles.card, styles.switchRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Alarm siren</Text>
          <Text style={styles.meta}>Loud looping vibration during the countdown</Text>
        </View>
        <Switch
          value={settings.sirenEnabled}
          onValueChange={(v) => update({ sirenEnabled: v })}
          trackColor={{ true: colors.safe, false: colors.border }}
          thumbColor="#fff"
        />
      </Card>

      <Button
        title="Test the alarm"
        icon="🔔"
        variant="primary"
        onPress={runTest}
        style={{ marginTop: spacing(2) }}
      />
      <Text style={styles.testHint}>Previews the “Are you OK?” countdown. No contacts are alerted.</Text>

      <SectionLabel>Data</SectionLabel>
      <Button title="Clear incident history" icon="🗑️" variant="ghost" size="md" onPress={confirmClearHistory} />
      <Button
        title="Reset everything"
        icon="⚠️"
        variant="ghost"
        size="md"
        onPress={confirmReset}
        style={{ marginTop: spacing(1) }}
      />

      <Text style={styles.about}>
        Saviour v{VERSION} · No account, no server. Fall detection uses on-device sensors and pauses
        when the app is backgrounded — keep it open while relying on it.
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

const styles = StyleSheet.create({
  container: { padding: spacing(2), paddingBottom: spacing(6) },
  card: { marginBottom: spacing(2) },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(1) },
  sensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    padding: spacing(1.5),
  },
  sensHint: { color: colors.textMuted, fontSize: 12, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { ...type.h3, fontSize: 15 },
  testHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: spacing(1) },
  about: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing(3),
    textAlign: 'center',
  },
});
