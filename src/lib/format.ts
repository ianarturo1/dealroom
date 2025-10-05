const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return '0 B';
  }

  let value = n;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${UNITS[unitIndex]}`;
}

export function truthy<T>(v: T): v is NonNullable<T> {
  return Boolean(v);
}
