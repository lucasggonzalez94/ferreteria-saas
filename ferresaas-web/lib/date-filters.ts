export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom'
  | 'all';

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface DatePresetOption {
  value: DatePreset;
  label: string;
}

export const DATE_PRESETS: DatePresetOption[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
  { value: 'last_30_days', label: 'Últimos 30 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'this_year', label: 'Este año' },
  { value: 'last_year', label: 'Año pasado' },
  { value: 'all', label: 'Todo' },
  { value: 'custom', label: 'Personalizado' },
];

export function getDatePresetRange(preset: DatePreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const today = formatDateInput(now);

  if (preset === 'today') {
    return { startDate: today, endDate: today };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const y = formatDateInput(yesterday);
    return { startDate: y, endDate: y };
  }

  if (preset === 'last_7_days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: formatDateInput(start), endDate: today };
  }

  if (preset === 'last_30_days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { startDate: formatDateInput(start), endDate: today };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatDateInput(start), endDate: today };
  }

  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }

  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: formatDateInput(start), endDate: today };
  }

  if (preset === 'last_year') {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31);
    return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }

  return { startDate: '', endDate: '' };
}

export function toStartDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T00:00:00.000`).toISOString();
}

export function toEndDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
}

export function formatDateRangeLabel(
  startDate: string,
  endDate: string
): string {
  if (!startDate && !endDate) return 'todo el histórico';
  if (startDate && endDate) return `${startDate} al ${endDate}`;
  if (startDate) return `desde ${startDate}`;
  return `hasta ${endDate}`;
}