import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Show alerts even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for notification permission and set up the Android alert channel. Call
 * once on app start. All notifications are local (fired on-device) — there is
 * no server and no push tokens.
 */
export async function initNotifications(): Promise<void> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== 'granted') {
    await Notifications.requestPermissionsAsync().catch(() => undefined);
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Emergency alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
    }).catch(() => undefined);
  }
}

/** Fire an immediate local notification (used the moment a fall is detected). */
export async function notifyLocal(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });
}
