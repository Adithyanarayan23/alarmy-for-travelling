/**
 * Formats an ISO date string or Date object into a localized time string (e.g. "6:30 AM").
 */
export function formatTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '--:--';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '--:--';

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an ISO date string or Date object into a readable date (e.g. "Nov 3, 2026 • 6:30 AM").
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Unknown date';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Unknown date';

  const datePart = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = formatTime(date);
  return `${datePart} • ${timePart}`;
}

/**
 * Formats duration in seconds into a human-readable string (e.g. "2h 15m" or "45m").
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Arriving now';
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Computes the absolute or signed difference in seconds between two dates.
 * Returns (dateA - dateB) in seconds.
 */
export function timeDiffSeconds(
  dateA: string | Date,
  dateB: string | Date
): number {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  return Math.round((a.getTime() - b.getTime()) / 1000);
}

/**
 * Formats how long ago a timestamp occurred (e.g. "Just now", "2 min ago", "1h ago").
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
