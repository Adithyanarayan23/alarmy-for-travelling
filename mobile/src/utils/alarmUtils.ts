/**
 * Computes the exact alarm time from the estimated arrival time and buffer in minutes.
 * This is the ONLY place in the application where alarm time is computed.
 * Alarm time is ALWAYS derived from the latest ETA: alarmTime = ETA - bufferMinutes.
 */
export function computeAlarmTime(eta: Date, bufferMinutes: number): Date {
  return new Date(eta.getTime() - bufferMinutes * 60 * 1000);
}
