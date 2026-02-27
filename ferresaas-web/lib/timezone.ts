import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from 'date-fns';

export const DEFAULT_TIMEZONE = 'America/Buenos_Aires';

// Variable global para almacenar el timezone del negocio (se setea desde auth-context)
let businessTimezone = DEFAULT_TIMEZONE;

/**
 * Establecer la zona horaria del negocio (llamar desde auth-context al login)
 */
export function setBusinessTimezone(tz: string): void {
  businessTimezone = tz || DEFAULT_TIMEZONE;
}

/**
 * Obtener la zona horaria actual del negocio
 */
export function getBusinessTimezone(): string {
  return businessTimezone;
}

/**
 * Obtener "ahora" en la zona horaria del negocio
 */
export function nowInTimezone(): Date {
  return toZonedTime(new Date(), businessTimezone);
}

/**
 * Formatear fecha UTC para mostrar en la zona horaria del negocio
 * @param date - Fecha en UTC (Date o ISO string)
 * @param pattern - Patrón de formato (date-fns)
 * @returns String formateado en la TZ del negocio
 */
export function formatDate(date: Date | string, pattern: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatTz(toZonedTime(dateObj, businessTimezone), pattern, { timeZone: businessTimezone });
}

/**
 * Formatear fecha UTC con locale español
 */
export function formatDateLocale(date: Date | string, pattern: string): string {
  const { es } = require('date-fns/locale');
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatTz(toZonedTime(dateObj, businessTimezone), pattern, { 
    timeZone: businessTimezone,
    locale: es,
  });
}

/**
 * Convertir fecha local (YYYY-MM-DD) a ISO string UTC para enviar al backend
 * @param localDate - Fecha en formato "YYYY-MM-DD"
 * @returns ISO string en UTC
 */
export function localDateToUTC(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const localDateTime = new Date(year, month - 1, day, 0, 0, 0, 0);
  return fromZonedTime(localDateTime, businessTimezone).toISOString();
}

/**
 * Convertir fecha local (YYYY-MM-DD) a ISO string UTC con hora de fin de día
 * @param localDate - Fecha en formato "YYYY-MM-DD"
 * @returns ISO string en UTC (23:59:59.999 del día local)
 */
export function localDateToUTCEndOfDay(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const localDateTime = new Date(year, month - 1, day, 23, 59, 59, 999);
  return fromZonedTime(localDateTime, businessTimezone).toISOString();
}

/**
 * Obtener rango UTC para un día local
 * @param localDate - Fecha en formato "YYYY-MM-DD"
 * @returns Objeto con startDate y endDate en ISO string UTC
 */
export function rangeForLocalDay(localDate: string): { startDate: string; endDate: string } {
  return {
    startDate: localDateToUTC(localDate),
    endDate: localDateToUTCEndOfDay(localDate),
  };
}

/**
 * Obtener rango UTC para un rango de días locales
 */
export function rangeForLocalDays(
  startLocalDate: string,
  endLocalDate: string
): { startDate: string; endDate: string } {
  return {
    startDate: localDateToUTC(startLocalDate),
    endDate: localDateToUTCEndOfDay(endLocalDate),
  };
}

/**
 * Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria del negocio
 */
export function todayLocal(): string {
  const now = nowInTimezone();
  return formatTz(now, 'yyyy-MM-dd', { timeZone: businessTimezone });
}

/**
 * Obtener fecha de hace N días en formato YYYY-MM-DD
 */
export function daysAgoLocal(days: number): string {
  const now = nowInTimezone();
  const past = subDays(now, days);
  return formatTz(past, 'yyyy-MM-dd', { timeZone: businessTimezone });
}

/**
 * Obtener fecha de hace N meses en formato YYYY-MM-DD
 */
export function monthsAgoLocal(months: number): string {
  const now = nowInTimezone();
  const past = subMonths(now, months);
  return formatTz(past, 'yyyy-MM-dd', { timeZone: businessTimezone });
}

/**
 * Obtener rango de fechas para presets comunes (últimos 7 días, este mes, etc.)
 * Retorna fechas en formato YYYY-MM-DD (local)
 */
export function getDateRangePreset(preset: '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear'): {
  start: string;
  end: string;
} {
  const now = nowInTimezone();
  const today = formatTz(now, 'yyyy-MM-dd', { timeZone: businessTimezone });

  switch (preset) {
    case '7d':
      return { start: daysAgoLocal(7), end: today };
    case '30d':
      return { start: daysAgoLocal(30), end: today };
    case 'thisMonth': {
      const monthStart = startOfMonth(now);
      return { 
        start: formatTz(monthStart, 'yyyy-MM-dd', { timeZone: businessTimezone }), 
        end: today 
      };
    }
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      const monthStart = startOfMonth(lastMonth);
      const monthEnd = endOfMonth(lastMonth);
      return { 
        start: formatTz(monthStart, 'yyyy-MM-dd', { timeZone: businessTimezone }), 
        end: formatTz(monthEnd, 'yyyy-MM-dd', { timeZone: businessTimezone }) 
      };
    }
    case 'thisYear': {
      const yearStart = startOfYear(now);
      return { 
        start: formatTz(yearStart, 'yyyy-MM-dd', { timeZone: businessTimezone }), 
        end: today 
      };
    }
    case 'lastYear': {
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      const yearStart = startOfYear(lastYear);
      const yearEnd = endOfYear(lastYear);
      return { 
        start: formatTz(yearStart, 'yyyy-MM-dd', { timeZone: businessTimezone }), 
        end: formatTz(yearEnd, 'yyyy-MM-dd', { timeZone: businessTimezone }) 
      };
    }
    default:
      return { start: daysAgoLocal(30), end: today };
  }
}

/**
 * Convertir rango de fechas locales a rango UTC para enviar al backend
 */
export function convertDateRangeToUTC(startLocal: string, endLocal: string): {
  startDate: string;
  endDate: string;
} {
  return rangeForLocalDays(startLocal, endLocal);
}

/**
 * Lista de zonas horarias comunes para configuración
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires) - UTC-3' },
  { value: 'America/Cordoba', label: 'Argentina (Córdoba) - UTC-3' },
  { value: 'America/Mendoza', label: 'Argentina (Mendoza) - UTC-3' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo) - UTC-3' },
  { value: 'America/Santiago', label: 'Chile (Santiago) - UTC-3/UTC-4' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo) - UTC-3' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción) - UTC-3/UTC-4' },
  { value: 'America/La_Paz', label: 'Bolivia (La Paz) - UTC-4' },
  { value: 'America/Lima', label: 'Perú (Lima) - UTC-5' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá) - UTC-5' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México) - UTC-6' },
  { value: 'America/New_York', label: 'Estados Unidos (Nueva York) - UTC-5/UTC-4' },
  { value: 'Europe/Madrid', label: 'España (Madrid) - UTC+1/UTC+2' },
  { value: 'UTC', label: 'UTC - Tiempo Universal Coordinado' },
] as const;
