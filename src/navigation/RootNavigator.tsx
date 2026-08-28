import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';
import { MonitorScreen } from '../screens/MonitorScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { loadContacts } from '../storage';
import { colors, spacing, type } from '../theme';

type Tab = 'monitor' | 'contacts' | 'incidents' | 'settings';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'monitor', label: 'Monitor', icon: '🛡️' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'incidents', label: 'History', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

export function RootNavigator() {
  const { loading } = useSettings();
  const [tab, setTab] = useState<Tab>('monitor');
  const [needsContact, setNeedsContact] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const refreshBadges = useCallback(() => {
    loadContacts()
      .then((c) => setNeedsContact(c.length === 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  const switchTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      Haptics.selectionAsync().catch(() => {});
      refreshBadges();
      fade.setValue(0);
      setTab(next);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    },
    [tab, fade, refreshBadges]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Saviour</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {tab === 'monitor' && <MonitorScreen />}
        {tab === 'contacts' && <ContactsScreen />}
        {tab === 'incidents' && <IncidentsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </Animated.View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const showDot = t.key === 'contacts' && needsContact;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => switchTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Text style={[styles.tabIcon, { opacity: active ? 1 : 0.6 }]}>{t.icon}</Text>
                {showDot && <View style={styles.dot} />}
              </View>
              <Text style={[styles.tabLabel, active && { color: colors.primaryHi }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing(2) },
  loadingText: { ...type.label, color: colors.textFaint },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
    paddingTop: spacing(1),
    paddingBottom: spacing(0.5),
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(0.5) },
  iconWrap: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginTop: 3 },
  dot: {
    position: 'absolute',
    top: 2,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.bgElevated,
  },
});
