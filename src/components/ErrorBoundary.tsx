import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';
import { Button } from './ui';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render crash anywhere in the tree shows a recover
 * screen instead of a blank white app — this is a safety tool, it should never
 * just vanish.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.icon}>🛟</Text>
        <Text style={styles.title}>Saviour hit a snag</Text>
        <Text style={styles.msg}>{this.state.error.message}</Text>
        <Button title="Try again" onPress={() => this.setState({ error: null })} style={{ marginTop: spacing(3) }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(4),
  },
  icon: { fontSize: 44, marginBottom: spacing(2) },
  title: { ...type.h1, textAlign: 'center' },
  msg: { ...type.caption, textAlign: 'center', marginTop: spacing(1), lineHeight: 20 },
});
