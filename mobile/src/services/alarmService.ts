import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTime } from '../utils/dateUtils';

export const ACTIVE_ALARM_STORAGE_KEY = '@alarmy/active_alarm_id';
export const ALARM_CATEGORY_IDENTIFIER = 'TRAVEL_ALARM_CATEGORY';
export const ALARM_CHANNEL_ID = 'travel-alarm-channel';

// Module-level variable holding the active alarm notification identifier
let currentAlarmIdentifier: string | null = null;
let webAlarmTimerId: ReturnType<typeof setTimeout> | null = null;
let onWebAlarmFiredCallback: (() => void) | null = null;

export function registerWebAlarmFiredHandler(cb: () => void): void {
  onWebAlarmFiredCallback = cb;
}

/**
 * Configures notification categories and Android high-priority alarm channel.
 */
export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    const storedId = await AsyncStorage.getItem(ACTIVE_ALARM_STORAGE_KEY);
    if (storedId) {
      currentAlarmIdentifier = storedId;
    }
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Travel Wake-Up Alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 1000],
      lightColor: '#FF6584',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
    });
  }

  await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_IDENTIFIER, [
    {
      identifier: 'DISMISS_ALARM',
      buttonTitle: 'Dismiss Alarm',
      options: {
        opensAppToForeground: true,
        isDestructive: true,
      },
    },
  ]);

  // Restore any persisted alarm ID into the module-level variable
  const storedId = await AsyncStorage.getItem(ACTIVE_ALARM_STORAGE_KEY);
  if (storedId) {
    currentAlarmIdentifier = storedId;
  }
}

/**
 * Requests notification permissions from the operating system.
 */
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'default') {
        try {
          await window.Notification.requestPermission();
        } catch {
          // ignore
        }
      }
    }
    return true;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true,
      },
    });
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Retrieves the currently stored active alarm identifier.
 */
export async function getActiveAlarmIdentifier(): Promise<string | null> {
  if (currentAlarmIdentifier) {
    return currentAlarmIdentifier;
  }
  const stored = await AsyncStorage.getItem(ACTIVE_ALARM_STORAGE_KEY);
  currentAlarmIdentifier = stored;
  return stored;
}

/**
 * Cancels a scheduled alarm notification by identifier and clears persisted state.
 */
export async function cancelAlarm(identifier?: string | null): Promise<void> {
  if (webAlarmTimerId) {
    clearTimeout(webAlarmTimerId);
    webAlarmTimerId = null;
  }

  if (Platform.OS !== 'web') {
    const targetId = identifier ?? currentAlarmIdentifier ?? (await AsyncStorage.getItem(ACTIVE_ALARM_STORAGE_KEY));

    if (targetId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(targetId);
      } catch {
        // Ignore if notification already fired or was dismissed by OS
      }
    }
  }

  currentAlarmIdentifier = null;
  await AsyncStorage.removeItem(ACTIVE_ALARM_STORAGE_KEY);
}

/**
 * Schedules a local wake-up alarm notification at `alarmTime`.
 * Enforces one active alarm at a time by cancelling any existing alarm first.
 */
export async function scheduleAlarm(
  alarmTime: Date,
  destination: string,
  eta: Date
): Promise<string> {
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    throw new Error('Notification permissions are required to schedule your wake-up alarm.');
  }

  // Enforce single active alarm constraint
  const existingId = currentAlarmIdentifier ?? (await AsyncStorage.getItem(ACTIVE_ALARM_STORAGE_KEY));
  if (existingId) {
    await cancelAlarm(existingId);
  }

  const formattedEta = formatTime(eta);

  // If alarmTime is already in the past or within 2 seconds (e.g. short journey), fire in 2 seconds
  const nowMs = Date.now();
  const triggerDate =
    alarmTime.getTime() <= nowMs + 2000 ? new Date(nowMs + 2000) : alarmTime;

  if (Platform.OS === 'web') {
    const webId = `web-alarm-${Date.now()}`;
    const delayMs = Math.max(2000, triggerDate.getTime() - nowMs);
    webAlarmTimerId = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification("🔔 You're arriving soon!", {
            body: `Wake up! You're approaching ${destination}. Expected arrival: ${formattedEta}`,
          });
        }
      } catch {
        // ignore browser notification errors
      }
      if (onWebAlarmFiredCallback) {
        onWebAlarmFiredCallback();
      }
    }, delayMs);

    currentAlarmIdentifier = webId;
    await AsyncStorage.setItem(ACTIVE_ALARM_STORAGE_KEY, webId);
    return webId;
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔔 You're arriving soon!",
      body: `Wake up! You're approaching ${destination}. Expected arrival: ${formattedEta}`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: ALARM_CATEGORY_IDENTIFIER,
      data: {
        type: 'TRAVEL_ALARM',
        destination,
        eta: eta.toISOString(),
        alarmTime: alarmTime.toISOString(),
      },
    },
    trigger:
      Platform.OS === 'android'
        ? {
            date: triggerDate,
            channelId: ALARM_CHANNEL_ID,
          }
        : triggerDate,
  });

  currentAlarmIdentifier = identifier;
  await AsyncStorage.setItem(ACTIVE_ALARM_STORAGE_KEY, identifier);

  return identifier;
}

/**
 * Cancels the old alarm and schedules a new one at `newAlarmTime`.
 */
export async function rescheduleAlarm(
  oldIdentifier: string | null,
  newAlarmTime: Date,
  destination: string,
  eta: Date
): Promise<string> {
  if (oldIdentifier) {
    await cancelAlarm(oldIdentifier);
  } else {
    await cancelAlarm();
  }
  return scheduleAlarm(newAlarmTime, destination, eta);
}
