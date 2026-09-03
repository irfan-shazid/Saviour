import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { Banner, Button, Field, GlassView, smoothLayout } from '../components/ui';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { authClient, authErrorMessage } from '../services/auth';
import { reconcileAfterSignIn } from '../services/sync';
import { spacing } from '../theme';

type Mode = 'signIn' | 'signUp';

/**
 * Sign-in gate. An account is required, so there is no skip path.
 *
 * There is no verification step either: sign-up creates the account and signs
 * the user straight in, so both branches land in the same place. Neither
 * branch navigates — flipping the session is enough, and AuthGate swaps the
 * app in on its next render.
 */
export function SignInScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);

  const swap = () => {
    smoothLayout();
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
  };

  const submitEmail = async () => {
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'signUp' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy('email');
    setError(null);
    try {
      // Sign-up auto-signs in (no verification step), so both branches end
      // with a live session and the same follow-up.
      const res =
        mode === 'signUp'
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim().split('@')[0],
            })
          : await authClient.signIn.email({ email: email.trim(), password });

      if (res.error) {
        setError(
          authErrorMessage(
            res.error,
            mode === 'signUp' ? 'Could not create your account.' : 'Could not sign you in.'
          )
        );
      } else {
        await reconcileAfterSignIn();
      }
    } catch (e) {
      setError(authErrorMessage(e, 'Could not reach the server. Check your connection.'));
    } finally {
      setBusy(null);
    }
  };

  const signInWithGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      const res = await authClient.signIn.social({ provider: 'google', callbackURL: 'saviour://' });
      if (res.error) {
        setError(authErrorMessage(res.error, 'Google sign-in failed.'));
      } else {
        // No navigation call needed: the session flips and AuthGate swaps in
        // the app on its next render.
        await reconcileAfterSignIn();
      }
    } catch (e) {
      setError(authErrorMessage(e, 'Google sign-in failed.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>🛟</Text>
          <Text style={styles.title}>Saviour</Text>
          <Text style={styles.tagline}>
            Fall detection and one-tap SOS. Sign in to keep your contacts and history synced and
            safe.
          </Text>

          <GlassView style={styles.panel}>
            <View style={styles.panelInner}>
              <Text style={styles.panelTitle}>
                {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
              </Text>

              {error && (
                <View style={{ marginBottom: spacing(2) }}>
                  <Banner tone="danger" title="Couldn’t continue" message={error} />
                </View>
              )}

              {mode === 'signUp' && (
                <Field
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Jane Doe"
                  autoCapitalize="words"
                  textContentType="name"
                />
              )}

              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signUp' ? 'At least 8 characters' : '••••••••'}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              />

              <Button
                title={mode === 'signIn' ? 'Sign in' : 'Create account'}
                onPress={submitEmail}
                loading={busy === 'email'}
                disabled={busy !== null}
              />

              <View style={styles.dividerRow}>
                <View style={styles.rule} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.rule} />
              </View>

              <Button
                title="Continue with Google"
                icon="🇬"
                variant="subtle"
                onPress={signInWithGoogle}
                loading={busy === 'google'}
                disabled={busy !== null}
              />

              <Text style={styles.swap} onPress={swap}>
                {mode === 'signIn' ? 'No account? Create one' : 'Already have an account? Sign in'}
              </Text>
            </View>
          </GlassView>

          <Text style={styles.footnote}>
            Your contacts, history and settings stay on this device and sync to your account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing(2.5),
      paddingVertical: spacing(6),
    },
    mark: { fontSize: 52, textAlign: 'center' },
    title: { ...type.display, textAlign: 'center', marginTop: spacing(1) },
    tagline: {
      ...type.caption,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: spacing(1),
      marginBottom: spacing(3),
      paddingHorizontal: spacing(1),
    },
    panel: { alignSelf: 'stretch' },
    panelInner: { padding: spacing(2.5) },
    panelTitle: { ...type.h2, marginBottom: spacing(2) },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(1.5),
      marginVertical: spacing(2),
    },
    rule: { flex: 1, height: 1, backgroundColor: colors.glassBorder },
    dividerText: { ...type.label, fontSize: 11 },
    swap: {
      color: colors.primaryHi,
      fontWeight: '700',
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing(2.5),
    },
    footnote: {
      color: colors.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginTop: spacing(1),
      lineHeight: 17,
    },
  });
