import api from './api';
import { Destination, ParsedJourneyIntent } from '../types';

interface RawAiParseResponse {
  destination_name?: string;
  destinationName?: string;
  destination?: Destination;
  buffer_minutes?: number;
  bufferMinutes?: number;
  alarm_buffer_minutes?: number;
  confidence?: number;
}

/**
 * Sends natural language travel input to `/ai/parse-journey` for NLU extraction ONLY.
 * Extracts the target destination name and wake-up buffer minutes.
 * IMPORTANT: AI never sets or computes the alarm time. Alarm timing is strictly
 * computed from the real ETA via `computeAlarmTime(eta, bufferMinutes)`.
 */
export async function parseJourneyText(text: string): Promise<ParsedJourneyIntent> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Please enter where you are travelling to.');
  }

  const response = await api.post<RawAiParseResponse>('/ai/parse-journey', {
    text: trimmed,
    prompt: trimmed,
  });

  const data = response.data;
  const destinationName =
    data.destinationName ||
    data.destination_name ||
    data.destination?.name ||
    '';

  const bufferMinutes =
    data.bufferMinutes ??
    data.buffer_minutes ??
    data.alarm_buffer_minutes ??
    30;

  if (!destinationName) {
    throw new Error(
      'Could not identify a destination from your message. Try saying: "I\'m going to Bangalore, wake me 30 min before".'
    );
  }

  return {
    destinationName,
    destination: data.destination,
    bufferMinutes: Number(bufferMinutes) > 0 ? Number(bufferMinutes) : 30,
    confidence: data.confidence,
  };
}
