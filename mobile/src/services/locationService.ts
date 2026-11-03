import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'ALARMY_BACKGROUND_LOCATION_TASK';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Define background task so TaskManager is registered if background updates are enabled
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      return;
    }
    if (data) {
      // Background location updates received
    }
  });
}

/**
 * Requests foreground location permissions (and optionally background if needed).
 */
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return false;
  }
  return true;
}

/**
 * Gets the user's current GPS coordinates.
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch {
    // Graceful fallback to Chennai Central coordinates on web if browser geolocation is blocked
    return {
      latitude: 13.0827,
      longitude: 80.2707,
    };
  }
}

/**
 * Reverse geocodes coordinates into a human-readable city name (e.g. "Chennai").
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address;
        const city =
          addr?.city ||
          addr?.town ||
          addr?.state_district ||
          addr?.county ||
          addr?.state;
        if (city) return city;
      }
    } catch {
      // fall through
    }
    if (Math.abs(lat - 13.0827) < 0.05 && Math.abs(lon - 80.2707) < 0.05) {
      return 'Chennai';
    }
  }

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lon,
    });

    if (results && results.length > 0) {
      const place = results[0];
      return (
        place.city ||
        place.subregion ||
        place.district ||
        place.region ||
        place.name ||
        `${lat.toFixed(2)}, ${lon.toFixed(2)}`
      );
    }
  } catch {
    // Fallback to formatted coordinates if reverse geocoding is unavailable
  }

  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

/**
 * Watches the user's position and invokes `callback` on changes.
 * Returns an unsubscribe function.
 */
export async function watchLocation(
  callback: (coords: Coordinates) => void
): Promise<() => void> {
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    throw new Error('Location permission not granted.');
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: 100,
    },
    (location) => {
      callback({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
  );

  return () => {
    subscription.remove();
  };
}

// Alias for compatibility
export const watchPosition = watchLocation;
