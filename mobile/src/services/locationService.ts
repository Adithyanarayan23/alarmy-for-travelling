import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'ALARMY_BACKGROUND_LOCATION_TASK';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Define background task so TaskManager is registered if background updates are enabled
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
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
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    throw new Error(
      'Location permission was denied. Please enable location access in Settings so Alarmy can track your arrival.'
    );
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/**
 * Reverse geocodes coordinates into a human-readable city name (e.g. "Chennai").
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
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
