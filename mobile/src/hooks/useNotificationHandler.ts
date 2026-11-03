import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { initializeNotifications, registerWebAlarmFiredHandler } from '../services/alarmService';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Sets up `expo-notifications` listeners for both foreground receipt and user interaction.
 * Navigates to `/alarm` when the wake-up alarm fires or is tapped by the user.
 */
export function useNotificationHandler(): void {
  const router = useRouter();

  useEffect(() => {
    initializeNotifications().catch(() => {});

    if (Platform.OS === 'web') {
      registerWebAlarmFiredHandler(() => {
        router.push('/alarm');
      });
      return;
    }

    // When notification fires while app is in foreground, automatically show the alarm screen
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'TRAVEL_ALARM') {
          router.push('/alarm');
        }
      }
    );

    // When user taps the notification from lockscreen or notification center
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'TRAVEL_ALARM' || response.actionIdentifier) {
          router.push('/alarm');
        }
      }
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);
}
