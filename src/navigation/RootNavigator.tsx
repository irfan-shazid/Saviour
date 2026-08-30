import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

  // Content transition: fade + a short directional slide between tabs.
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

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

      const dir = TABS.findIndex((t) => t.key === next) > TABS.findIndex((t) => t.key === tab) ? 1 : -1;

      Animated.timing(fade, {
        toValue: 0,
        duration: 110,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setTab(next);
        slide.setValue(dir * 16);
        Animated.parallel([
          Animated.timing(fade, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(slide, {
            toValue: 0,
            speed: 14,
            bounciness: 4,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [tab, fade, slide, refreshBadges]
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
      <Animated.View
        style={{ flex: 1, opacity: fade, transform: [{ translateX: slide }] }}
      >
        {tab === 'monitor' && <MonitorScreen />}
        {tab === 'contacts' && <ContactsScreen />}
        {tab === 'incidents' && <IncidentsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </Animated.View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TabButton
            key={t.key}
            icon={t.icon}
            label={t.label}
            active={tab === t.key}
            showDot={t.key === 'contacts' && needsContact}
            onPress={() => switchTab(t.key)}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ *
 * TabButton — spring-animated active pill + icon, plus press feedback.
 * ------------------------------------------------------------------ */
function TabButton({
  icon,
  label,
  active,
  showDot,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  showDot: boolean;
  onPress: () => void;
}) {
  const a = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(a, {
      toValue: active ? 1 : 0,
      speed: 16,
      bounciness: active ? 8 : 0,
      useNativeDriver: true,
    }).start();
  }, [active, a]);

  const springPress = (to: number) =>
    Animated.spring(press, { toValue: to, speed: 40, bounciness: 0, useNativeDriver: true }).start();

  const iconScale = Animated.multiply(
    press,
    a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] })
  );

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => springPress(0.88)}
      onPressOut={() => springPress(1)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.iconPill,
            {
              opacity: a,
              transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.tabIcon,
            {
              opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          {icon}
        </Animated.Text>
        {showDot && <View style={styles.dot} />}
      </View>
      <Text style={[styles.tabLabel, active && { color: colors.primaryHi }]}>{label}</Text>
    </Pressable>
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
  iconPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
  },
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
