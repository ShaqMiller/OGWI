/** Dev tools show times in UTC, because the engines' day rules count UTC days. */
export function formatUtc(value: Date | string): string {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUtcDay(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
