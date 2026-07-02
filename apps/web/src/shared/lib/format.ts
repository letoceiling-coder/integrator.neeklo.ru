const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('ru-RU');

/** Amounts are stored in minor units (kopecks). */
export function formatMoney(amountMinor: number, currency = 'RUB'): string {
  const major = amountMinor / 100;
  if (currency === 'RUB') return rubFormatter.format(major);
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(major);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return `${days} дн назад`;
}
