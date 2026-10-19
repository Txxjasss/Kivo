/**
 * Deterministic, locale-aware currency formatter for Kivo.
 * Standardizes monetary formatting across dashboard, cards, scope intake,
 * scope creep detector, and client review portal.
 */

export function formatCurrency(
  amount: number | string | undefined | null,
  currency: string = 'USD',
  forceDecimals: boolean = false
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0)) || 0;
  const hasCents = num % 1 !== 0;
  const digits = forceDecimals || hasCents ? 2 : 0;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase() || 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$${num.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function formatRate(rate: number | string | undefined | null, currency: string = 'USD'): string {
  const num = typeof rate === 'number' ? rate : parseFloat(String(rate || 0)) || 0;
  return `${formatCurrency(num, currency)}/hr`;
}

export function formatHours(hours: number | string | undefined | null): string {
  const num = typeof hours === 'number' ? hours : parseFloat(String(hours || 0)) || 0;
  return `${num.toLocaleString('en-US', { maximumFractionDigits: 2 })}h`;
}
