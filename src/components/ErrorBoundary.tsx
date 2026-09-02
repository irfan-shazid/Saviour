import React from 'react';
import { Appearance, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../theme';
import { themeFor } from '../context/ThemeContext';
import { Button } from './ui';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render crash anywhere in the tree shows a recover
 * screen instead of a blank app — this is a safety tool, it should never
 * just vanish.
 *
 * It sits above ThemeProvider (so it can catch that too), and therefore reads
 * the OS colour scheme directly instead of the app's theme preference.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { colors, type } = themeFor(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');

    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <Text style={styles.icon}>🛟</Text>
        <Text style={[type.h1, styles.centered]}>Saviour hit a snag</Text>
        <Text style={[type.caption, styles.centered, styles.msg]}>{this.state.error.message}</Text>
        <Button
          title="Try again"
          onPress={() => this.setState({ error: null })}
          style={{ marginTop: spacing(3) }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4) },
  icon: { fontSize: 44, marginBottom: spacing(2) },
  centered: { textAlign: 'center' },
  msg: { marginTop: spacing(1), lineHeight: 20 },
});
