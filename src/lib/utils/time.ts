const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const RELATIVE_UNITS = [
  { unit: 'year', seconds: 31_536_000 },
  { unit: 'month', seconds: 2_592_000 },
  { unit: 'week', seconds: 604_800 },
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 }
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
  return `${minutes}:${pad(remainingSeconds)}`;
}

export function formatDate(timestamp: number): string {
  return DATE_FORMATTER.format(new Date(timestamp));
}

export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const diffSeconds = Math.round((now - timestamp) / 1_000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 5) return 'just now';

  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (absSeconds >= seconds) {
      const value = Math.floor(absSeconds / seconds);
      const suffix = value === 1 ? unit : `${unit}s`;
      return diffSeconds >= 0 ? `${value} ${suffix} ago` : `in ${value} ${suffix}`;
    }
  }

  return diffSeconds >= 0 ? 'less than a minute ago' : 'in less than a minute';
}

export function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getDayOfWeek(timestamp: number): number {
  return new Date(timestamp).getDay();
}

export function formatDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}
