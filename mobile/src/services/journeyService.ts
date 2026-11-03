import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { CreateJourneyPayload, Destination, EtaResult, Journey } from '../types';
import { computeAlarmTime } from '../utils/alarmUtils';

const LOCAL_JOURNEYS_KEY = '@alarmy/local_journeys';

async function getStoredLocalJourneys(): Promise<Journey[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_JOURNEYS_KEY);
    return raw ? (JSON.parse(raw) as Journey[]) : [];
  } catch {
    return [];
  }
}

async function saveStoredLocalJourneys(journeys: Journey[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_JOURNEYS_KEY, JSON.stringify(journeys));
  } catch {
    // ignore
  }
}

async function computeDirectOsrmEta(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  bufferMinutes: number
): Promise<EtaResult> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const route = json?.routes?.[0];
      if (route && typeof route.duration === 'number') {
        const durationSeconds = Math.round(route.duration);
        const distanceMeters = Math.round(route.distance ?? 0);
        const etaDate = new Date(Date.now() + durationSeconds * 1000);
        const alarmDate = computeAlarmTime(etaDate, bufferMinutes);
        return {
          estimatedArrival: etaDate.toISOString(),
          durationSeconds,
          distanceMeters,
          alarmTime: alarmDate.toISOString(),
        };
      }
    }
  } catch {
    // fallback to Haversine calculation below
  }

  // Haversine fallback (60 km/h average transit speed)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(destLat - originLat);
  const dLon = toRad(destLon - originLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(originLat)) * Math.cos(toRad(destLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const distanceMeters = Math.max(5000, Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
  const durationSeconds = Math.max(2400, Math.round(distanceMeters / 16.67));
  const etaDate = new Date(Date.now() + durationSeconds * 1000);
  const alarmDate = computeAlarmTime(etaDate, bufferMinutes);

  return {
    estimatedArrival: etaDate.toISOString(),
    durationSeconds,
    distanceMeters,
    alarmTime: alarmDate.toISOString(),
  };
}

interface RawJourneyResponse {
  id?: string | number;
  destination?: Destination;
  destination_name?: string;
  destination_display_name?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  origin_latitude?: number;
  originLatitude?: number;
  origin_longitude?: number;
  originLongitude?: number;
  status?: 'active' | 'completed' | 'cancelled';
  alarm_buffer_minutes?: number;
  alarmBufferMinutes?: number;
  current_eta?: string | null;
  currentEta?: string | null;
  alarm_scheduled_at?: string | null;
  alarmScheduledAt?: string | null;
  created_at?: string;
  createdAt?: string;
}

interface RawEtaResponse {
  estimated_arrival?: string;
  estimatedArrival?: string;
  eta?: string;
  duration_seconds?: number;
  durationSeconds?: number;
  distance_meters?: number;
  distanceMeters?: number;
  alarm_time?: string;
  alarmTime?: string;
}

function normalizeJourney(raw: RawJourneyResponse, fallbackDest?: Destination): Journey {
  const destination: Destination = raw.destination || {
    name: raw.destination_name || fallbackDest?.name || 'Destination',
    displayName:
      raw.destination_display_name ||
      raw.destination_name ||
      fallbackDest?.displayName ||
      'Destination',
    latitude: raw.destination_latitude ?? fallbackDest?.latitude ?? 0,
    longitude: raw.destination_longitude ?? fallbackDest?.longitude ?? 0,
  };

  return {
    id: String(raw.id ?? `journey-${Date.now()}`),
    destination,
    originLatitude: raw.originLatitude ?? raw.origin_latitude ?? 0,
    originLongitude: raw.originLongitude ?? raw.origin_longitude ?? 0,
    status: raw.status ?? 'active',
    alarmBufferMinutes: raw.alarmBufferMinutes ?? raw.alarm_buffer_minutes ?? 30,
    currentEta: raw.currentEta ?? raw.current_eta ?? null,
    alarmScheduledAt: raw.alarmScheduledAt ?? raw.alarm_scheduled_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

/**
 * Creates a new journey on the backend (`POST /journeys`).
 */
export async function createJourney(payload: CreateJourneyPayload): Promise<Journey> {
  try {
    const response = await api.post<RawJourneyResponse>('/journeys', {
      destination_name: payload.destination.name,
      destination_display_name: payload.destination.displayName,
      destination_latitude: payload.destination.latitude,
      destination_longitude: payload.destination.longitude,
      destination: payload.destination,
      origin_latitude: payload.originLatitude,
      origin_longitude: payload.originLongitude,
      originLatitude: payload.originLatitude,
      originLongitude: payload.originLongitude,
      alarm_buffer_minutes: payload.alarmBufferMinutes,
      alarmBufferMinutes: payload.alarmBufferMinutes,
    });

    const created = normalizeJourney(response.data, payload.destination);
    const localList = await getStoredLocalJourneys();
    await saveStoredLocalJourneys([created, ...localList.filter((j) => j.id !== created.id)]);
    return created;
  } catch {
    const eta = await computeDirectOsrmEta(
      payload.originLatitude,
      payload.originLongitude,
      payload.destination.latitude,
      payload.destination.longitude,
      payload.alarmBufferMinutes
    );
    const fallbackJourney: Journey = {
      id: `journey-${Date.now()}`,
      destination: payload.destination,
      originLatitude: payload.originLatitude,
      originLongitude: payload.originLongitude,
      status: 'active',
      alarmBufferMinutes: payload.alarmBufferMinutes,
      currentEta: eta.estimatedArrival,
      alarmScheduledAt: eta.alarmTime,
      createdAt: new Date().toISOString(),
    };
    const localList = await getStoredLocalJourneys();
    await saveStoredLocalJourneys([fallbackJourney, ...localList]);
    return fallbackJourney;
  }
}

/**
 * Fetches a single journey by ID (`GET /journeys/{id}`).
 */
export async function getJourney(id: string): Promise<Journey> {
  try {
    const response = await api.get<RawJourneyResponse>(`/journeys/${id}`);
    return normalizeJourney(response.data);
  } catch {
    const localList = await getStoredLocalJourneys();
    const found = localList.find((j) => j.id === id);
    if (found) return found;
    throw new Error('Journey not found.');
  }
}

/**
 * Fetches all journeys for history screen (`GET /journeys`).
 */
export async function getJourneys(): Promise<Journey[]> {
  try {
    const response = await api.get<RawJourneyResponse[] | { journeys: RawJourneyResponse[] }>(
      '/journeys'
    );
    const list = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.journeys)
      ? response.data.journeys
      : [];
    return list.map((item) => normalizeJourney(item));
  } catch {
    return getStoredLocalJourneys();
  }
}

/**
 * Polls the latest ETA for an active journey (`GET /journeys/{id}/eta`).
 * Always computes `alarmTime` via `computeAlarmTime(etaDate, bufferMinutes)`.
 */
export async function getJourneyEta(
  id: string,
  bufferMinutes: number = 30,
  currentCoords?: { latitude: number; longitude: number }
): Promise<EtaResult> {
  try {
    const response = await api.get<RawEtaResponse>(`/journeys/${id}/eta`, {
      params: currentCoords
        ? {
            current_latitude: currentCoords.latitude,
            current_longitude: currentCoords.longitude,
          }
        : undefined,
    });

    const data = response.data;
    const estimatedArrivalIso =
      data.estimatedArrival ||
      data.estimated_arrival ||
      data.eta ||
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const etaDate = new Date(estimatedArrivalIso);
    // Strictly derive alarmTime using computeAlarmTime from alarmUtils
    const computedAlarmDate = computeAlarmTime(etaDate, bufferMinutes);

    const durationSeconds =
      data.durationSeconds ??
      data.duration_seconds ??
      Math.max(0, Math.round((etaDate.getTime() - Date.now()) / 1000));

    const distanceMeters = data.distanceMeters ?? data.distance_meters ?? 0;

    return {
      estimatedArrival: etaDate.toISOString(),
      durationSeconds,
      distanceMeters,
      alarmTime: computedAlarmDate.toISOString(),
    };
  } catch {
    const localList = await getStoredLocalJourneys();
    const journey = localList.find((j) => j.id === id);
    const origLat = currentCoords?.latitude ?? journey?.originLatitude ?? 13.0827;
    const origLon = currentCoords?.longitude ?? journey?.originLongitude ?? 80.2707;
    const destLat = journey?.destination.latitude ?? 12.9716;
    const destLon = journey?.destination.longitude ?? 77.5946;
    return computeDirectOsrmEta(origLat, origLon, destLat, destLon, bufferMinutes);
  }
}

/**
 * Updates journey status or attributes (`PATCH /journeys/{id}`).
 */
export async function updateJourney(
  id: string,
  updates: Partial<Pick<Journey, 'status' | 'alarmBufferMinutes' | 'currentEta' | 'alarmScheduledAt'>>
): Promise<Journey> {
  try {
    const response = await api.patch<RawJourneyResponse>(`/journeys/${id}`, {
      status: updates.status,
      alarm_buffer_minutes: updates.alarmBufferMinutes,
      current_eta: updates.currentEta,
      alarm_scheduled_at: updates.alarmScheduledAt,
    });
    return normalizeJourney(response.data);
  } catch {
    const localList = await getStoredLocalJourneys();
    const updatedList = localList.map((j) => (j.id === id ? { ...j, ...updates } : j));
    await saveStoredLocalJourneys(updatedList);
    const found = updatedList.find((j) => j.id === id);
    if (found) return found;
    throw new Error('Journey not found.');
  }
}
