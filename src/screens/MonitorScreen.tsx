import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useSettings } from '../context/SettingsContext';
import { useFallDetection } from '../hooks/useFallDetection';
import { getCurrentFix } from '../utils/location';
import { notifyLocal } from '../services/notifications';
import { buildEmergencyMessage, sendEmergencySMS } from '../services/sms';
import { genId, loadContacts, loadIncidents, upsertIncident } from '../storage';
import type { Incident, IncidentSource, SmsOutcome } from '../types';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { Banner, Button, Card, MountFade } from '../components/ui';
import { relativeTime } from '../utils/format';
import { colors, radius, spacing, type } from '../theme';

const KEEP_AWAKE_TAG = 'saviour-monitor';

type Ready = { contacts: number; hasName: boolean; location: 'granted' | 'denied' | 'unknown' };

export function MonitorScreen() {
  const { settings } = useSettings();
  const [monitoring, setMonitoring] = useState(false);
  const [active, setActive] = useState<Incident | null>(null);
  const [test, setTest] = useState<Incident | null>(null);
  const [busy, setBusy] = useState(false);
  const [backgrounded, setBackgrounded] = useState(false);
  const [ready, setReady] = useState<Ready>({ contacts: 0, hasName: false, location: 'unknown' });
  const [lastIncident, setLastIncident] = useState<Incident | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    const [contacts, incidents, perm] = await Promise.all([
      loadContacts(),
      loadIncidents(),
      Location.getForegroundPermissionsAsync().catch(() => null),
    ]);
    setReady({
      contacts: contacts.length,
      hasName: settings.name.trim().length > 0,
      location: perm ? (perm.granted ? 'granted' : 'denied') : 'unknown',
    });
    setLastIncident(incidents[0] ?? null);
  }, [settings.name]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the screen/CPU awake while monitoring so the sensor keeps sampling.
  useEffect(() => {
    if (monitoring) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [monitoring]);

  // JS sensors pause when the app is backgrounded — tell the user.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setBackgrounded(s !== 'active'));
    return () => sub.remove();
  }, []);

  // Beacon animation while monitoring: two radar rings pulsing out of phase,
  // plus a slow "breathing" scale on the core so an idle screen still feels live.
  useEffect(() => {
    if (!monitoring) {
      [pulse, pulse2, breathe].forEach((v) => {
        v.stopAnimation();
        v.setValue(0);
      });
      return;
    }
    const ring = (v: Animated.Value) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
    const ringA = ring(pulse);
    const ringB = ring(pulse2);
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    ringA.start();
    breath.start();
    const t = setTimeout(() => ringB.start(), 1200);
    return () => {
      clearTimeout(t);
      ringA.stop();
      ringB.stop();
      breath.stop();
    };
  }, [monitoring, pulse, pulse2, breathe]);

  const openIncident = useCallback(
    async (source: IncidentSource, magnitude?: number) => {
      if (active) return; // one at a time
      setBusy(true);
      try {
        if (source === 'FALL_DETECTION') {
          notifyLocal('⚠️ Possible fall detected', 'Open Saviour — are you OK?').catch(
            () => undefined
          );
        }
        const fix = await getCurrentFix();
        setActive({
          id: genId(),
          status: 'PENDING',
          source,
          latitude: fix.latitude ?? null,
          longitude: fix.longitude ?? null,
          accuracy: fix.accuracy ?? null,
          address: fix.address ?? null,
          impactMagnitude: magnitude ?? null,
          countdownSeconds: settings.countdownSeconds,
          detectedAt: new Date().toISOString(),
        });
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not start incident');
      } finally {
        setBusy(false);
      }
    },
    [active, settings.countdownSeconds]
  );

  useFallDetection({
    enabled: monitoring && !active,
    sensitivity: settings.sensitivity,
    onFall: (magnitude) => openIncident('FALL_DETECTION', magnitude),
  });

  // Escalation: grab the freshest location, text every contact, save history.
  const handleEscalate = useCallback(async (): Promise<SmsOutcome> => {
    if (!active) return 'unavailable';
    const contacts = await loadContacts();
    const fresh = await getCurrentFix();
    const loc = {
      latitude: fresh.latitude ?? active.latitude ?? undefined,
      longitude: fresh.longitude ?? active.longitude ?? undefined,
      accuracy: fresh.accuracy ?? active.accuracy ?? undefined,
      address: fresh.address ?? active.address ?? undefined,
    };
    const outcome = await sendEmergencySMS(
      contacts,
      buildEmergencyMessage({
        name: settings.name,
        source: active.source,
        fix: loc,
        medicalNote: settings.medicalNote,
      })
    );
    await upsertIncident({
      ...active,
      status: 'EMERGENCY',
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null,
      accuracy: loc.accuracy ?? null,
      address: loc.address ?? null,
      escalatedAt: new Date().toISOString(),
      contactsAlerted: contacts.map((c) => ({ name: c.name, phone: c.phone })),
      smsOutcome: outcome,
    });
    return outcome;
  }, [active, settings.name, settings.medicalNote]);

  const handleSafe = useCallback(async () => {
    if (!active) return;
    await upsertIncident({ ...active, status: 'SAFE', respondedAt: new Date().toISOString() });
  }, [active]);

  const closeActive = useCallback(() => {
    setActive(null);
    refresh();
  }, [refresh]);

  const confirmSos = () =>
    Alert.alert('Send SOS?', 'This starts the alert countdown for your emergency contacts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: () => openIncident('MANUAL_SOS') },
    ]);

  const runTest = () =>
    setTest({
      id: genId(),
      status: 'PENDING',
      source: 'FALL_DETECTION',
      impactMagnitude: 3.1,
      countdownSeconds: settings.countdownSeconds,
      detectedAt: new Date().toISOString(),
    });

  const firstName = settings.name.trim().split(' ')[0];
  const notReady = ready.contacts === 0 || !ready.hasName;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const ring2Scale = pulse2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ring2Opacity = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MountFade delay={0}>
        <Text style={styles.hello}>Hi{firstName ? ` ${firstName}` : ''} 👋</Text>
      </MountFade>

      <MountFade delay={60}>
      <Card elevated style={{ alignItems: 'center', paddingVertical: spacing(4) }}>
        <View style={styles.beaconBox}>
          {monitoring && (
            <>
              <Animated.View
                style={[
                  styles.beaconPulse,
                  { borderColor: colors.safe, opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.beaconPulse,
                  { borderColor: colors.safe, opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
                ]}
              />
            </>
          )}
          <View style={[styles.beacon, { borderColor: monitoring ? colors.safe : colors.border }]}>
            <Animated.View
              style={[
                styles.beaconDot,
                {
                  backgroundColor: monitoring ? colors.safe : colors.textFaint,
                  transform: [{ scale: monitoring ? coreScale : 1 }],
                },
              ]}
            />
          </View>
        </View>

        <Text style={styles.statusTitle}>
          {monitoring ? 'Protection active' : 'Protection off'}
        </Text>
        <Text style={styles.statusHelp}>
          {monitoring
            ? 'Saviour is watching for a fall. Keep the app open in the foreground.'
            : 'Turn on to start monitoring for accidents.'}
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Monitoring</Text>
          <Switch
            value={monitoring}
            onValueChange={setMonitoring}
            trackColor={{ true: colors.safe, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </Card>
      </MountFade>

      {monitoring && backgrounded && (
        <Banner
          tone="warning"
          title="Detection pauses in the background"
          message="The OS stops the motion sensor when Saviour isn't on screen. Keep it open and awake."
        />
      )}

      {notReady && (
        <Banner
          tone="warning"
          title="Setup incomplete"
          message={
            ready.contacts === 0
              ? 'Add at least one emergency contact so Saviour can alert someone.'
              : 'Add your name in Settings so contacts know who needs help.'
          }
        />
      )}

      <MountFade delay={120}>
        <Button
          title="Send SOS now"
          icon="🆘"
          variant="danger"
          onPress={confirmSos}
          loading={busy}
          style={{ marginTop: spacing(2) }}
        />
      </MountFade>

      <MountFade delay={180}>
      <Card style={{ marginTop: spacing(2) }}>
        <Text style={styles.cardTitle}>Readiness</Text>
        <CheckRow ok={ready.hasName} label="Your name is set" hint="Shown in the alert text" />
        <CheckRow
          ok={ready.contacts > 0}
          label={`${ready.contacts} emergency contact${ready.contacts === 1 ? '' : 's'}`}
          hint="Texted your location on escalation"
        />
        <CheckRow
          ok={ready.location === 'granted'}
          label="Location permission"
          hint={ready.location === 'denied' ? 'Denied — alerts won’t include a map link' : 'Used for the map link'}
        />
        <CheckRow
          ok
          label={`Auto-escalate ${settings.autoEscalateEnabled ? 'on' : 'off'}`}
          hint={
            settings.autoEscalateEnabled
              ? 'Alerts open automatically at 0'
              : 'You confirm the alert at 0'
          }
        />
      </Card>
      </MountFade>

      {lastIncident && (
        <MountFade delay={220}>
          <Card style={{ marginTop: spacing(2) }}>
            <Text style={styles.cardTitle}>Last incident</Text>
            <Text style={styles.lastLine}>
              {lastIncident.source === 'MANUAL_SOS' ? 'Manual SOS' : 'Fall detected'} ·{' '}
              {lastIncident.status} · {relativeTime(lastIncident.detectedAt)}
            </Text>
          </Card>
        </MountFade>
      )}

      <MountFade delay={260}>
      <Card style={{ marginTop: spacing(2) }}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Text style={styles.infoLine}>1. Turn on monitoring and keep Saviour open.</Text>
        <Text style={styles.infoLine}>
          2. A hard fall triggers a {settings.countdownSeconds}s “Are you OK?” prompt.
        </Text>
        <Text style={styles.infoLine}>
          3. No response → your SMS app opens, pre-filled for your contacts.
        </Text>
      </Card>

      <Button
        title="Test the alarm"
        icon="🔔"
        variant="ghost"
        size="md"
        onPress={runTest}
        style={{ marginTop: spacing(2) }}
      />
      <Text style={styles.testHint}>Previews the countdown. Nothing is sent.</Text>
      </MountFade>

      {active && (
        <EmergencyOverlay
          incident={active}
          autoEscalate={settings.autoEscalateEnabled}
          siren={settings.sirenEnabled}
          onEscalate={handleEscalate}
          onSafe={handleSafe}
          onClose={closeActive}
        />
      )}

      {test && (
        <EmergencyOverlay
          test
          incident={test}
          siren={settings.sirenEnabled}
          onClose={() => setTest(null)}
        />
      )}
    </ScrollView>
  );
}

function CheckRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkMark, { color: ok ? colors.safe : colors.warning }]}>
        {ok ? '✓' : '!'}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {hint ? <Text style={styles.checkHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(2), paddingBottom: spacing(6), gap: 0 },
  hello: { ...type.h1, marginBottom: spacing(2) },
  beaconBox: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing(2) },
  beaconPulse: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2 },
  beacon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconDot: { width: 40, height: 40, borderRadius: 20 },
  statusTitle: { ...type.h2 },
  statusHelp: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing(2),
    paddingHorizontal: spacing(2),
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
  },
  switchLabel: { color: colors.text, fontWeight: '700' },
  cardTitle: { ...type.h3, marginBottom: spacing(1) },
  infoLine: { color: colors.textMuted, lineHeight: 22 },
  lastLine: { color: colors.textMuted, lineHeight: 20, fontWeight: '600' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(1.5),
    paddingVertical: spacing(0.75),
  },
  checkMark: { fontSize: 15, fontWeight: '900', width: 16, textAlign: 'center', marginTop: 1 },
  checkLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  checkHint: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  testHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
