import React, { useEffect } from 'react';
import { Platform, UIManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from './src/context/SettingsContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthGate } from './src/navigation/AuthGate';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initNotifications } from './src/services/notifications';

// Opt Android into animating layout changes (list add/remove/reorder, form
// expand). Harmless no-op on the New Architecture and on iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  useEffect(() => {
    initNotifications().catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>
            <Themed />
          </ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/** Split out so the status bar can read the resolved theme from context. */
function Themed() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AuthGate />
    </>
  );
}
