export type NumericFormat = 'price' | 'yield' | 'percent' | 'basisPoints';
export type Movement = 'standard' | 'inverse';
const priceFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumeric(value: number | null | undefined, format: NumericFormat, approximate = false): string {
  if (value == null) return '—';
  const prefix = approximate ? '~' : '';
  if (format === 'price') return prefix + priceFormatter.format(value);
  if (format === 'yield') return `${prefix}${value.toFixed(3)}%`;
  const signed = value > 0 ? '+' : '';
  return format === 'percent'
    ? `${prefix}${signed}${value.toFixed(2)}%`
    : `${prefix}${signed}${value.toFixed(1)} bp`;
}

/** Yield increases use inverse direction; callers choose the financial meaning. */
export function movementClass(value: number | null | undefined, movement: Movement): string {
  if (value == null || value === 0) return '';
  const positive = movement === 'inverse' ? value < 0 : value > 0;
  return positive ? 'positive' : 'negative';
}

export const formatET = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  : null;
