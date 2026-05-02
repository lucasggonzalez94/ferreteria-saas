import { getBusinessTimezone } from './timezone';

export const LOCALE = 'es-AR';

export function formatCurrency(value: number, currency = 'ARS'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatMoney(value: number, currency = 'ARS'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format((value || 0) / 100);
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(LOCALE, {
    hour12: false,
    timeZone: getBusinessTimezone(),
  });
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    timeZone: getBusinessTimezone(),
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour12: false,
    timeZone: getBusinessTimezone(),
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}