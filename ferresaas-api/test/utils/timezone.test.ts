import { describe, expect, it } from '@jest/globals';
import {
  COMMON_TIMEZONES,
  DEFAULT_TIMEZONE,
  endOfDayInTimezone,
  endOfMonthInTimezone,
  endOfYearInTimezone,
  formatInTimezone,
  isToday,
  isValidTimezone,
  nowInTimezone,
  rangeForLocalDay,
  rangeForLocalDays,
  startOfDayInTimezone,
  startOfMonthInTimezone,
  startOfYearInTimezone,
  toLocalTime,
  todayInTimezone,
  toUTC,
} from '@/utils/timezone';

describe('timezone utils', () => {
  it('returns current date object for nowInTimezone', () => {
    const now = nowInTimezone();
    expect(now).toBeInstanceOf(Date);
  });

  it('computes day boundaries in a timezone', () => {
    const date = new Date('2026-01-15T15:30:00.000Z');

    const start = startOfDayInTimezone(date, 'UTC');
    const end = endOfDayInTimezone(date, 'UTC');

    expect(formatInTimezone(start, 'HH:mm:ss', 'UTC')).toBe('00:00:00');
    expect(formatInTimezone(end, 'HH:mm:ss', 'UTC')).toBe('23:59:59');
  });

  it('computes month and year boundaries', () => {
    const date = new Date('2026-07-15T10:00:00.000Z');

    const monthStart = startOfMonthInTimezone(date, 'UTC');
    const monthEnd = endOfMonthInTimezone(date, 'UTC');
    const yearStart = startOfYearInTimezone(date, 'UTC');
    const yearEnd = endOfYearInTimezone(date, 'UTC');

    expect(formatInTimezone(monthStart, 'yyyy-MM-dd', 'UTC')).toBe('2026-07-01');
    expect(formatInTimezone(monthEnd, 'yyyy-MM-dd', 'UTC')).toBe('2026-07-31');
    expect(formatInTimezone(yearStart, 'yyyy-MM-dd', 'UTC')).toBe('2026-01-01');
    expect(formatInTimezone(yearEnd, 'yyyy-MM-dd', 'UTC')).toBe('2026-12-31');
  });

  it('builds utc ranges from local days', () => {
    const [start, end] = rangeForLocalDay('2026-04-24', 'UTC');
    const range = rangeForLocalDays('2026-04-24', '2026-04-26', 'UTC');

    expect(formatInTimezone(start, 'yyyy-MM-dd HH:mm:ss', 'UTC')).toBe('2026-04-24 00:00:00');
    expect(formatInTimezone(end, 'yyyy-MM-dd HH:mm:ss', 'UTC')).toBe('2026-04-24 23:59:59');
    expect(formatInTimezone(range.startDate, 'yyyy-MM-dd', 'UTC')).toBe('2026-04-24');
    expect(formatInTimezone(range.endDate, 'yyyy-MM-dd', 'UTC')).toBe('2026-04-26');
  });

  it('supports string and Date input in format and local conversion helpers', () => {
    const source = '2026-04-24T12:00:00.000Z';
    const formatted = formatInTimezone(source, 'yyyy-MM-dd HH:mm', 'UTC');
    const local = toLocalTime(source, 'UTC');
    const utc = toUTC(local, 'UTC');

    expect(formatted).toBe('2026-04-24 12:00');
    expect(local).toBeInstanceOf(Date);
    expect(utc.toISOString()).toBe('2026-04-24T12:00:00.000Z');
  });

  it('reports today and timezone validity', () => {
    const today = todayInTimezone('UTC');

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isToday(new Date(), 'UTC')).toBe(true);
    expect(isToday(new Date('1999-01-01T00:00:00.000Z'), 'UTC')).toBe(false);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Invalid/Timezone')).toBe(false);
  });

  it('exports expected constants', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Buenos_Aires');
    expect(COMMON_TIMEZONES.some(tz => tz.value === 'UTC')).toBe(true);
  });
});
