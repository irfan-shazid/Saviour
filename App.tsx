import React, { useEffect } from 'react';
import { Platform, UIManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from './src/context/SettingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
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
          <StatusBar style="light" />
          <RootNavigator />
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
