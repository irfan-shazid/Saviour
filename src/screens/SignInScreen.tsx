import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { Banner, Button, Field, GlassView, smoothLayout } from '../components/ui';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { authClient, authConfigured, authErrorMessage } from '../services/auth';
import { reconcileAfterSignIn } from '../services/sync';
import { spacing } from '../theme';

type Mode = 'signIn' | 'signUp';

/** Better Auth's code for "this address hasn't been confirmed yet". */
const UNVERIFIED_CODES = ['EMAIL_NOT_VERIFIED', 'EMAIL_VERIFICATION_REQUIRED'];

function isUnverified(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; status?: number; message?: string };
  if (e.code && UNVERIFIED_CODES.includes(e.code)) return true;
  return e.status === 403 && /verif/i.test(e.message ?? '');
}

/**
 * Optional account screen. Saviour works entirely on-device, so this never
 * blocks the safety features — "Continue without an account" is always
 * available, and is the only path when no auth server is configured.
 */
export function SignInScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'resend'>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set once a verification link has been mailed, so the UI can say so. */
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const swap = () => {
    smoothLayout();
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
    setAwaitingVerification(false);
  };

  const resendVerification = async () => {
    setBusy('resend');
    setError(null);
    try {
      await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: 'saviour://',
      });
      setAwaitingVerification(true);
    } catch (e) {
      setError(authErrorMessage(e, 'Could not send the verification email.'));
    } finally {
      setBusy(null);
    }
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
      if (mode === 'signUp') {
        const res = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split('@')[0],
          callbackURL: 'saviour://',
        });
        if (res.error) {
          setError(authErrorMessage(res.error, 'Could not create your account.'));
        } else {
          // Verification is required, so there is no session yet — the user
          // has to tap the link in their inbox first.
          smoothLayout();
          setAwaitingVerification(true);
        }
        return;
      }

      const res = await authClient.signIn.email({ email: email.trim(), password });
      if (!res.error) {
        await reconcileAfterSignIn();
        onDone();
      } else if (isUnverified(res.error)) {
        smoothLayout();
        setAwaitingVerification(true);
      } else {
        setError(authErrorMessage(res.error, 'Could not sign you in.'));
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
        await reconcileAfterSignIn();
        onDone();
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
            Fall detection and one-tap SOS. Everything works offline — an account just syncs who you
            are across devices.
          </Text>

          <GlassView style={styles.panel}>
            <View style={styles.panelInner}>
              {!authConfigured ? (
                <Banner
                  tone="info"
                  icon="ℹ️"
                  title="No account server configured"
                  message="Set EXPO_PUBLIC_AUTH_URL in .env to enable sign-in. Saviour works fully without it."
                />
              ) : awaitingVerification ? (
                <>
                  <Text style={styles.verifyIcon}>📬</Text>
                  <Text style={styles.panelTitle}>Check your inbox</Text>
                  <Text style={styles.verifyBody}>
                    We sent a verification link to{' '}
                    <Text style={styles.verifyEmail}>{email.trim()}</Text>. Tap it to confirm your
                    address — that also signs you in, so there’s no code to type.
                  </Text>
                  {error && (
                    <View style={{ marginBottom: spacing(2) }}>
                      <Banner tone="danger" title="Couldn’t send" message={error} />
                    </View>
                  )}
                  <Button
                    title="Resend the link"
                    variant="subtle"
                    onPress={resendVerification}
                    loading={busy === 'resend'}
                    disabled={busy !== null}
                  />
                  <Text
                    style={styles.swap}
                    onPress={() => {
                      smoothLayout();
                      setAwaitingVerification(false);
                      setMode('signIn');
                      setError(null);
                    }}
                  >
                    Back to sign in
                  </Text>
                </>
              ) : (
                <>
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
                    {mode === 'signIn'
                      ? 'No account? Create one'
                      : 'Already have an account? Sign in'}
                  </Text>
                </>
              )}
            </View>
          </GlassView>

          <Button
            title="Continue without an account"
            variant="ghost"
            size="md"
            onPress={onDone}
            style={{ marginTop: spacing(2.5) }}
          />
          <Text style={styles.footnote}>
            Contacts, history and settings are stored on this device either way.
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
    verifyIcon: { fontSize: 40, marginBottom: spacing(1) },
    verifyBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: spacing(2.5),
    },
    verifyEmail: { color: colors.text, fontWeight: '700' },
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
