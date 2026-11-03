import api from './api';
import { CreateJourneyPayload, Destination, EtaResult, Journey } from '../types';
import { computeAlarmTime } from '../utils/alarmUtils';

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

  return normalizeJourney(response.data, payload.destination);
}

/**
 * Fetches a single journey by ID (`GET /journeys/{id}`).
 */
export async function getJourney(id: string): Promise<Journey> {
  const response = await api.get<RawJourneyResponse>(`/journeys/${id}`);
  return normalizeJourney(response.data);
}

/**
 * Fetches all journeys for history screen (`GET /journeys`).
 */
export async function getJourneys(): Promise<Journey[]> {
  const response = await api.get<RawJourneyResponse[] | { journeys: RawJourneyResponse[] }>(
    '/journeys'
  );
  const list = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.journeys)
    ? response.data.journeys
    : [];
  return list.map((item) => normalizeJourney(item));
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
}

/**
 * Updates journey status or attributes (`PATCH /journeys/{id}`).
 */
export async function updateJourney(
  id: string,
  updates: Partial<Pick<Journey, 'status' | 'alarmBufferMinutes' | 'currentEta' | 'alarmScheduledAt'>>
): Promise<Journey> {
  const response = await api.patch<RawJourneyResponse>(`/journeys/${id}`, {
    status: updates.status,
    alarm_buffer_minutes: updates.alarmBufferMinutes,
    current_eta: updates.currentEta,
    alarm_scheduled_at: updates.alarmScheduledAt,
  });
  return normalizeJourney(response.data);
}
