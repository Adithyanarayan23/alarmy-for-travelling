export interface Destination {
  id?: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface Journey {
  id: string;
  destination: Destination;
  originLatitude: number;
  originLongitude: number;
  status: 'active' | 'completed' | 'cancelled';
  alarmBufferMinutes: number;
  currentEta: string | null;       // ISO datetime string
  alarmScheduledAt: string | null; // ISO datetime string
  createdAt: string;
}

export interface EtaResult {
  estimatedArrival: string;  // ISO datetime
  durationSeconds: number;
  distanceMeters: number;
  alarmTime: string;         // ISO datetime (eta - buffer)
}

export interface EtaUpdate {
  previousEta: string;
  newEta: string;
  previousAlarm: string;
  newAlarm: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  access_token?: string;
  token?: string;
  user: User;
}

export interface ParsedJourneyIntent {
  destinationName: string;
  destination?: Destination;
  bufferMinutes: number;
  confidence?: number;
}

export interface CreateJourneyPayload {
  destination: Destination;
  originLatitude: number;
  originLongitude: number;
  alarmBufferMinutes: number;
}
