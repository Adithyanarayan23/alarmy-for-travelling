import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as locationService from '../services/locationService';

export interface UseLocationResult {
  coords: { latitude: number; longitude: number } | null;
  cityName: string | null;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}

export function useLocation(): UseLocationResult {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLocation = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission) {
        const msg = 'Location permission denied';
        setError(msg);
        Alert.alert(
          'Location Permission Required',
          'Alarmy needs access to your GPS location to calculate your arrival time and wake you up before your stop.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return null;
      }

      const position = await locationService.getCurrentLocation();
      setCoords(position);

      const city = await locationService.reverseGeocode(position.latitude, position.longitude);
      setCityName(city);

      return position;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to determine current location';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  return {
    coords,
    cityName,
    isLoading,
    error,
    refreshLocation,
  };
}
