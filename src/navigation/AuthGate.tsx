import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { Banner, GlassView } from '../components/ui';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { RootNavigator } from './RootNavigator';
import { SignInScreen } from '../screens/SignInScreen';
import { authConfigured, useSession } from '../services/auth';
import { spacing } from '../theme';

/**
 * Signing in is required — the app is unreachable without a session.
 *
 * Note for offline use: the Expo client caches the session in SecureStore, so
 * a user who has signed in once still gets straight through with no network.
 * It is only the *first* sign-in on a device that needs connectivity.
 */
export function AuthGate() {
  // Hooks must run unconditionally, so this can't be branched around.
  if (!authConfigured) return <NotConfigured />;
  return <SessionGate />;
}

function SessionGate() {
  const { data, isPending } = useSession();

  if (isPending) return <Splash />;
  if (data?.session) return <RootNavigator />;
  return <SignInScreen />;
}

/**
 * No server address was built into the bundle, so there is no way to sign in
 * and therefore no way in at all. Say exactly that rather than showing a
 * sign-in form whose every request would fail.
 */
function NotConfigured() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      <AppBackground />
      <View style={styles.configWrap}>
        <Text style={styles.mark}>🛟</Text>
        <GlassView>
          <View style={{ padding: spacing(2.5) }}>
            <Banner
              tone="warning"
              title="No server configured"
              message={
                'Set EXPO_PUBLIC_AUTH_URL in .env to the address of the Saviour server, then restart Metro with "npx expo start -c" — these values are baked into the bundle, so a plain reload will not pick up the change.'
              }
            />
          </View>
        </GlassView>
      </View>
    </View>
  );
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
    configWrap: { alignSelf: 'stretch', padding: spacing(2.5) },
    mark: { fontSize: 44, textAlign: 'center', marginBottom: spacing(2) },
    label: { ...type.label, color: colors.textFaint },
  });
