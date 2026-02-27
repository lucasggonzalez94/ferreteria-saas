import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export const DEFAULT_TIMEZONE = 'America/Buenos_Aires';

/**
 * Obtener "ahora" en la zona horaria especificada
 */
export function nowInTimezone(tz: string = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), tz);
}

/**
 * Inicio del día en la zona horaria del tenant, retorna UTC
 * @param date - Fecha en UTC
 * @param tz - Zona horaria IANA
 * @returns Fecha UTC que representa el inicio del día en la TZ especificada
 */
export function startOfDayInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const startOfDayZoned = startOfDay(zonedDate);
  return fromZonedTime(startOfDayZoned, tz);
}

/**
 * Fin del día en la zona horaria del tenant, retorna UTC
 * @param date - Fecha en UTC
 * @param tz - Zona horaria IANA
 * @returns Fecha UTC que representa el fin del día en la TZ especificada
 */
export function endOfDayInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const endOfDayZoned = endOfDay(zonedDate);
  return fromZonedTime(endOfDayZoned, tz);
}

/**
 * Inicio del mes en la zona horaria del tenant, retorna UTC
 */
export function startOfMonthInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const startOfMonthZoned = startOfMonth(zonedDate);
  return fromZonedTime(startOfMonthZoned, tz);
}

/**
 * Fin del mes en la zona horaria del tenant, retorna UTC
 */
export function endOfMonthInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const endOfMonthZoned = endOfMonth(zonedDate);
  return fromZonedTime(endOfMonthZoned, tz);
}

/**
 * Inicio del año en la zona horaria del tenant, retorna UTC
 */
export function startOfYearInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const startOfYearZoned = startOfYear(zonedDate);
  return fromZonedTime(startOfYearZoned, tz);
}

/**
 * Fin del año en la zona horaria del tenant, retorna UTC
 */
export function endOfYearInTimezone(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  const zonedDate = toZonedTime(date, tz);
  const endOfYearZoned = endOfYear(zonedDate);
  return fromZonedTime(endOfYearZoned, tz);
}

/**
 * Rango UTC para un día local (YYYY-MM-DD)
 * @param localDate - Fecha en formato "YYYY-MM-DD"
 * @param tz - Zona horaria IANA
 * @returns Tupla [startUTC, endUTC] que representa el día completo en la TZ especificada
 */
export function rangeForLocalDay(localDate: string, tz: string = DEFAULT_TIMEZONE): [Date, Date] {
  const [year, month, day] = localDate.split('-').map(Number);
  const startZoned = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endZoned = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  return [
    fromZonedTime(startZoned, tz),
    fromZonedTime(endZoned, tz),
  ];
}

/**
 * Rango UTC para un rango de días locales
 * @param startLocalDate - Fecha inicio en formato "YYYY-MM-DD"
 * @param endLocalDate - Fecha fin en formato "YYYY-MM-DD"
 * @param tz - Zona horaria IANA
 * @returns Objeto con startDate y endDate en UTC
 */
export function rangeForLocalDays(
  startLocalDate: string,
  endLocalDate: string,
  tz: string = DEFAULT_TIMEZONE
): { startDate: Date; endDate: Date } {
  const [startYear, startMonth, startDay] = startLocalDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endLocalDate.split('-').map(Number);
  
  const startZoned = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
  const endZoned = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
  
  return {
    startDate: fromZonedTime(startZoned, tz),
    endDate: fromZonedTime(endZoned, tz),
  };
}

/**
 * Formatear fecha UTC para mostrar en la zona horaria del tenant
 * @param date - Fecha en UTC (Date o ISO string)
 * @param pattern - Patrón de formato (date-fns)
 * @param tz - Zona horaria IANA
 * @returns String formateado en la TZ especificada
 */
export function formatInTimezone(
  date: Date | string,
  pattern: string,
  tz: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatTz(toZonedTime(dateObj, tz), pattern, { timeZone: tz });
}

/**
 * Convertir fecha UTC a fecha local en la zona horaria del tenant
 * @param date - Fecha en UTC
 * @param tz - Zona horaria IANA
 * @returns Fecha ajustada a la TZ especificada
 */
export function toLocalTime(date: Date | string, tz: string = DEFAULT_TIMEZONE): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, tz);
}

/**
 * Convertir fecha local a UTC
 * @param date - Fecha en la zona horaria local
 * @param tz - Zona horaria IANA de la fecha local
 * @returns Fecha en UTC
 */
export function toUTC(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(date, tz);
}

/**
 * Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria del tenant
 */
export function todayInTimezone(tz: string = DEFAULT_TIMEZONE): string {
  const now = nowInTimezone(tz);
  return formatTz(now, 'yyyy-MM-dd', { timeZone: tz });
}

/**
 * Parsear una fecha ISO string y determinar si es "hoy" en la zona horaria del tenant
 */
export function isToday(date: Date | string, tz: string = DEFAULT_TIMEZONE): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateInTz = formatTz(toZonedTime(dateObj, tz), 'yyyy-MM-dd', { timeZone: tz });
  return dateInTz === todayInTimezone(tz);
}

/**
 * Validar si un string es una zona horaria IANA válida
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista de zonas horarias comunes para Argentina y países cercanos
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
