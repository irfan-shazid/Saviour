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
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { useFallDetection } from '../hooks/useFallDetection';
import { getCurrentFix } from '../utils/location';
import { notifyLocal } from '../services/notifications';
import { buildEmergencyMessage, sendEmergencySMS } from '../services/sms';
import { genId, loadContacts, loadIncidents, upsertIncident } from '../storage';
import type { Incident, IncidentSource, SmsOutcome } from '../types';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { Banner, Button, Card, MountFade } from '../components/ui';
import { hasDirectSmsPermission, isDirectSmsSupported } from '../../modules/direct-sms';
import { relativeTime } from '../utils/format';
import { radius, spacing } from '../theme';

const KEEP_AWAKE_TAG = 'saviour-monitor';

type Ready = {
  contacts: number;
  hasName: boolean;
  location: 'granted' | 'denied' | 'unknown';
  /** True when the alert will go out with no user interaction at all. */
  canAutoSend: boolean;
};

export function MonitorScreen() {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [monitoring, setMonitoring] = useState(false);
  const [active, setActive] = useState<Incident | null>(null);
  const [busy, setBusy] = useState(false);
  const [backgrounded, setBackgrounded] = useState(false);
  const [ready, setReady] = useState<Ready>({
    contacts: 0,
    hasName: false,
    location: 'unknown',
    canAutoSend: false,
  });
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
      canAutoSend: isDirectSmsSupported() && hasDirectSmsPermission(),
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
  // plus a slow "breathing" core so an idle screen still feels live.
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
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
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

  const firstName = settings.name.trim().split(' ')[0];

  // Only surface setup steps that still need doing — a wall of green ticks is
  // noise on a screen you look at every day.
  const todo = [
    !ready.hasName && 'Add your name in Settings',
    ready.contacts === 0 && 'Add an emergency contact',
    ready.location !== 'granted' && 'Allow location access',
    isDirectSmsSupported() && !ready.canAutoSend && 'Allow SMS to send alerts automatically',
  ].filter(Boolean) as string[];

  const autoSends = ready.canAutoSend;

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
        <Card elevated blur style={styles.hero}>
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

          <Text style={styles.statusTitle}>{monitoring ? 'Protection active' : 'Protection off'}</Text>
          <Text style={styles.statusHelp}>
            {monitoring
              ? 'Watching for a fall. Keep Saviour open in the foreground.'
              : 'Turn on to start watching for accidents.'}
          </Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Monitoring</Text>
            <Switch
              value={monitoring}
              onValueChange={(v) => {
                Haptics.selectionAsync().catch(() => {});
                setMonitoring(v);
              }}
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
          message="The OS stops the motion sensor when Saviour isn't on screen."
        />
      )}

      {todo.length > 0 && (
        <MountFade delay={100}>
          <Banner
            tone="warning"
            title={todo.length === 1 ? 'One step left' : `${todo.length} steps left`}
            message={todo.join(' · ')}
          />
        </MountFade>
      )}

      <MountFade delay={140}>
        <Button
          title="Send SOS now"
          icon="🆘"
          variant="danger"
          onPress={confirmSos}
          loading={busy}
          style={{ marginTop: spacing(2) }}
        />
        <Text style={styles.sosHint}>
          {autoSends
            ? 'Texts your contacts your location automatically — no tap needed.'
            : 'Opens your SMS app with the alert written and addressed — just hit send.'}
        </Text>
      </MountFade>

      {lastIncident && (
        <MountFade delay={200}>
          <Card style={{ marginTop: spacing(1) }}>
            <Text style={styles.cardTitle}>Last incident</Text>
            <Text style={styles.lastLine}>
              {lastIncident.source === 'MANUAL_SOS' ? 'Manual SOS' : 'Fall detected'} ·{' '}
              {lastIncident.status} · {relativeTime(lastIncident.detectedAt)}
            </Text>
          </Card>
        </MountFade>
      )}

      {active && (
        <EmergencyOverlay
          incident={active}
          autoEscalate={settings.autoEscalateEnabled}
          siren={settings.sirenEnabled}
          alarmSound={settings.alarmSoundEnabled}
          onEscalate={handleEscalate}
          onSafe={handleSafe}
          onClose={closeActive}
        />
      )}
    </ScrollView>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    container: { padding: spacing(2), paddingBottom: spacing(6), gap: spacing(1.5) },
    hello: { ...type.h1 },
    hero: { alignItems: 'center', paddingVertical: spacing(4) },
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
    sosHint: {
      color: colors.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 17,
    },
    cardTitle: { ...type.h3, marginBottom: spacing(0.5) },
    lastLine: { color: colors.textMuted, lineHeight: 20, fontWeight: '600' },
  });
