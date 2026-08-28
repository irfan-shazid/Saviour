import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from './src/context/SettingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initNotifications } from './src/services/notifications';

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
