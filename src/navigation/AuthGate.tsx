import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { RootNavigator } from './RootNavigator';
import { SignInScreen } from '../screens/SignInScreen';
import { authConfigured, useSession } from '../services/auth';
import { loadAuthPromptDismissed, setAuthPromptDismissed } from '../storage';
import { spacing } from '../theme';

/**
 * Decides whether to show the account screen before the app.
 *
 * Accounts are deliberately optional: Saviour's safety features are entirely
 * on-device, so a missing server, a dead network or a user who simply doesn't
 * want an account must never be able to lock someone out of the SOS button.
 */
export function AuthGate() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    loadAuthPromptDismissed()
      .then(setDismissed)
      .catch(() => setDismissed(true)); // storage trouble must not gate the app
  }, []);

  const skip = useCallback(() => {
    setDismissed(true);
    setAuthPromptDismissed(true).catch(() => undefined);
  }, []);

  if (dismissed === null) return <Splash />;
  if (!authConfigured || dismissed) return <RootNavigator />;
  return <SessionGate onSkip={skip} />;
}

/** Split out so `useSession` is only ever called when a server is configured. */
function SessionGate({ onSkip }: { onSkip: () => void }) {
  const { data, isPending } = useSession();

  if (isPending) return <Splash />;
  if (data?.session) return <RootNavigator />;
  return <SignInScreen onDone={onSkip} />;
}

function Splash() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      <AppBackground />
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>Saviour</Text>
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      gap: spacing(2),
    },
    label: { ...type.label, color: colors.textFaint },
  });
