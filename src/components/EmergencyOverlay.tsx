import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Linking, Modal, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Incident, SmsOutcome } from '../types';
import { radius, spacing, type Palette } from '../theme';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { Button, smoothLayout } from './ui';
import { CountdownRing } from './CountdownRing';

type Phase = 'countdown' | 'waiting' | 'escalating' | 'result' | 'safe' | 'error';

/** Copy shown after escalation, driven by how the SMS actually went. */
function outcomeCopy(
  c: Palette
): Record<SmsOutcome, { title: string; color: string; help: string; ok: boolean }> {
  return {
    sent: {
      title: 'Contacts alerted',
      color: c.safe,
      help: 'Your emergency contacts have been texted your location. Stay where you are if you can.',
      ok: true,
    },
    unknown: {
      title: 'Message ready — hit send',
      color: c.safe,
      help: 'Your SMS app is open with the alert already written and addressed. Tap send, then stay where you are if you can.',
      ok: true,
    },
    cancelled: {
      title: 'Alert not sent',
      color: c.warning,
      help: 'You closed the message before it was sent. Reopen it or call your local emergency number.',
      ok: false,
    },
    unavailable: {
      title: "Couldn't send SMS",
      color: c.warning,
      help: 'This device can’t send text messages. Call your local emergency number directly.',
      ok: false,
    },
    'no-contacts': {
      title: 'No contacts to alert',
      color: c.warning,
      help: 'Add emergency contacts in the Contacts tab so Saviour can text them for you.',
      ok: false,
    },
  };
}

const ALARM_PATTERN = [0, 600, 400, 600, 400];

/**
 * Full-screen "Are you OK?" overlay shown the moment a fall is detected.
 * Counts down from the incident's grace period. If the user does not tap
 * "I'M OK" in time, it escalates — the parent opens the device SMS composer,
 * pre-filled and pre-addressed, to alert the emergency contacts.
 */
export function EmergencyOverlay({
  incident,
  onClose,
  onEscalate,
  onSafe,
  autoEscalate = true,
  siren = true,
  test = false,
}: {
  incident: Incident;
  onClose: () => void;
  /** Sends the emergency SMS and persists the incident; returns the outcome. */
  onEscalate?: () => Promise<SmsOutcome>;
  /** Marks the incident safe and persists it. */
  onSafe?: () => Promise<void>;
  /** When false, hitting 0 waits on a prompt instead of opening the composer. */
  autoEscalate?: boolean;
  /** Loud looping vibration alarm during the countdown. */
  siren?: boolean;
  /** Preview the flow without creating real alerts (Settings → Test alarm). */
  test?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [remaining, setRemaining] = useState(incident.countdownSeconds);
  const [phase, setPhaseRaw] = useState<Phase>('countdown');
  const [outcome, setOutcome] = useState<SmsOutcome>('sent');
  const [error, setError] = useState<string | null>(null);
  const escalatedRef = useRef(false);

  // Ease the sheet's height/content whenever the phase (and so its body) changes.
  const setPhase = useCallback((p: Phase) => {
    smoothLayout(220);
    setPhaseRaw(p);
  }, []);

  // Spring the sheet up on mount instead of a bare fade.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, speed: 12, bounciness: 7, useNativeDriver: true }).start();
  }, [enter]);

  const stopAlarm = useCallback(() => Vibration.cancel(), []);

  // Alarm buzz while the prompt is up.
  useEffect(() => {
    if (siren) Vibration.vibrate(ALARM_PATTERN, true);
    else Vibration.vibrate(400);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    return stopAlarm;
  }, [siren, stopAlarm]);

  // Countdown tick.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (remaining <= 0) {
      if (autoEscalate) escalate();
      else setPhase('waiting');
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, phase]);

  const COPY = outcomeCopy(colors);

  async function escalate() {
    if (escalatedRef.current) return;
    escalatedRef.current = true;
    setPhase('escalating');
    stopAlarm();
    try {
      const result = test ? 'sent' : (await onEscalate?.()) ?? 'unavailable';
      setOutcome(result);
      setPhase('result');
      Haptics.notificationAsync(
        COPY[result].ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to alert contacts');
      setPhase('error');
    }
  }

  async function markSafe() {
    stopAlarm();
    try {
      if (!test) await onSafe?.();
      setPhase('safe');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
      setPhase('error');
    }
  }

  const callForHelp = () => {
    Linking.openURL(Platform.OS === 'ios' ? 'tel:112' : 'tel:').catch(() => {
      setError('Could not open the phone dialer. Dial your local emergency number.');
      setPhase('error');
    });
  };

  const copy = COPY[outcome];
  const kicker =
    incident.source === 'MANUAL_SOS' ? 'MANUAL SOS ACTIVATED' : 'POSSIBLE ACCIDENT DETECTED';

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: enter,
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
              ],
            },
          ]}
        >
          {(phase === 'countdown' || phase === 'waiting') && (
            <>
              {test && <Text style={styles.testTag}>TEST — no alerts will be sent</Text>}
              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>
                {phase === 'waiting' ? 'Still no response' : 'Are you OK?'}
              </Text>

              <CountdownRing
                total={incident.countdownSeconds}
                remaining={remaining}
                running={phase === 'countdown'}
              />

              <Text style={styles.help}>
                {phase === 'waiting'
                  ? 'The grace period is up. Alert your emergency contacts now, or confirm you are safe.'
                  : `In ${remaining}s your SMS app opens with an alert ready to send to your contacts.`}
              </Text>

              {incident.impactMagnitude ? (
                <Text style={styles.detail}>Impact ≈ {incident.impactMagnitude.toFixed(1)} g</Text>
              ) : null}

              <View style={styles.actions}>
                <Button title="I'M OK — I'm fine" icon="✅" variant="safe" onPress={markSafe} />
                <Button title="Send help now" icon="🆘" variant="danger" onPress={escalate} />
                <Button title="Call for help" icon="📞" variant="ghost" size="md" onPress={callForHelp} />
              </View>
            </>
          )}

          {phase === 'escalating' && (
            <View style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
              <Text style={styles.title}>Opening your messages…</Text>
              <Text style={styles.help}>Hang tight — writing the alert for your contacts.</Text>
            </View>
          )}

          {phase === 'result' && (
            <>
              {test && <Text style={styles.testTag}>TEST — nothing was actually sent</Text>}
              <Text style={styles.resultIcon}>{copy.ok ? '📨' : '⚠️'}</Text>
              <Text style={[styles.title, { color: copy.color }]}>{copy.title}</Text>
              <Text style={styles.help}>{copy.help}</Text>
              <View style={styles.actions}>
                {!copy.ok && (
                  <Button title="Call for help" icon="📞" variant="danger" onPress={callForHelp} />
                )}
                <Button title="Close" variant="ghost" onPress={onClose} />
              </View>
            </>
          )}

          {phase === 'safe' && (
            <View style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
              <Text style={styles.resultIcon}>💚</Text>
              <Text style={[styles.title, { color: colors.safe }]}>Glad you're OK</Text>
            </View>
          )}

          {phase === 'error' && (
            <>
              <Text style={styles.resultIcon}>⚠️</Text>
              <Text style={[styles.title, { color: colors.warning }]}>Something went wrong</Text>
              <Text style={styles.help}>{error}</Text>
              <View style={styles.actions}>
                <Button title="Close" variant="ghost" onPress={onClose} />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing(3),
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: spacing(3),
      alignItems: 'center',
    },
    kicker: { color: colors.dangerHi, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
    testTag: {
      color: colors.warning,
      fontWeight: '900',
      fontSize: 11,
      marginBottom: spacing(1),
      letterSpacing: 0.5,
    },
    title: {
      ...type.h1,
      fontSize: 28,
      marginTop: spacing(1),
      marginBottom: spacing(2),
      textAlign: 'center',
    },
    resultIcon: { fontSize: 40, marginBottom: spacing(1) },
    help: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing(2),
      marginBottom: spacing(2.5),
      lineHeight: 21,
      fontSize: 14,
    },
    detail: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: spacing(2),
    },
    actions: { alignSelf: 'stretch', width: '100%', gap: spacing(1.5) },
  });
