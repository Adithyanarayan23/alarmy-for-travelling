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

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('Unable to reach server') && !msg.includes('Network Error')) {
      throw err;
    }

    // Heuristic client-side NLU fallback when backend is unreachable
    const bufferMatch = trimmed.match(/(\d+)\s*(?:min|minute|minutes|m)\b/i);
    const hourMatch = trimmed.match(/(\d+)\s*(?:hr|hour|hours|h)\b/i);
    const bufferMinutes = bufferMatch
      ? parseInt(bufferMatch[1], 10)
      : hourMatch
      ? parseInt(hourMatch[1], 10) * 60
      : 30;

    const destMatch =
      trimmed.match(/(?:to|towards|for|reaching|arriving\s+in|arriving\s+at)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:,|\.|;|\s+wake|\s+tonight|\s+today|\s+tomorrow|\s+in\s+\d+|\s+before|$)/i) ||
      trimmed.match(/^([A-Za-z][A-Za-z\s]{1,25})$/);

    const destinationName = destMatch ? destMatch[1].trim() : '';
    if (!destinationName) {
      throw new Error(
        'Could not identify a destination from your message. Try saying: "I\'m going to Bangalore, wake me 30 min before".'
      );
    }

    return {
      destinationName,
      bufferMinutes: bufferMinutes > 0 ? bufferMinutes : 30,
    };
  }
}
