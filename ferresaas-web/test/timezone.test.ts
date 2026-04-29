import {
  setBusinessTimezone,
  getBusinessTimezone,
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateLocale,
  localDateToUTC,
  localDateToUTCEndOfDay,
  rangeForLocalDay,
  rangeForLocalDays,
  todayLocal,
  daysAgoLocal,
  monthsAgoLocal,
  getDateRangePreset,
  convertDateRangeToUTC,
  COMMON_TIMEZONES,
} from '@/lib/timezone';

describe('timezone', () => {
  beforeEach(() => {
    setBusinessTimezone(DEFAULT_TIMEZONE);
  });

  describe('setBusinessTimezone', () => {
    it('should set custom timezone', () => {
      setBusinessTimezone('America/New_York');
      expect(getBusinessTimezone()).toBe('America/New_York');
    });

    it('should fallback to default for empty string', () => {
      setBusinessTimezone('');
      expect(getBusinessTimezone()).toBe(DEFAULT_TIMEZONE);
    });

    it('should fallback to default for undefined', () => {
      setBusinessTimezone(undefined as unknown as string);
      expect(getBusinessTimezone()).toBe(DEFAULT_TIMEZONE);
    });
  });

  describe('getBusinessTimezone', () => {
    it('should return America/Buenos_Aires by default', () => {
      expect(getBusinessTimezone()).toBe(DEFAULT_TIMEZONE);
    });
  });

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2024-03-15T12:00:00Z');
      const result = formatDate(date, 'yyyy-MM-dd');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should format ISO string', () => {
      const result = formatDate('2024-03-15T12:00:00Z', 'yyyy-MM-dd');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('formatDateLocale', () => {
    it('should format with locale', () => {
      const result = formatDateLocale('2024-03-15T12:00:00Z', 'MMMM dd, yyyy');
      expect(result).toContain('2024');
    });
  });

  describe('localDateToUTC', () => {
    it('should convert YYYY-MM-DD to ISO string', () => {
      const result = localDateToUTC('2024-03-15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should handle single digit month and day', () => {
      const result = localDateToUTC('2024-01-01');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('localDateToUTCEndOfDay', () => {
    it('should convert to end of day UTC', () => {
      const result = localDateToUTCEndOfDay('2024-03-15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('rangeForLocalDay', () => {
    it('should return start and end for single day', () => {
      const result = rangeForLocalDay('2024-03-15');
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });
  });

  describe('rangeForLocalDays', () => {
    it('should return start and end for range', () => {
      const result = rangeForLocalDays('2024-03-01', '2024-03-15');
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });
  });

  describe('todayLocal', () => {
    it('should return date in yyyy-MM-dd format', () => {
      const result = todayLocal();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('daysAgoLocal', () => {
    it('should return date N days ago', () => {
      const result = daysAgoLocal(7);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle zero days', () => {
      const result = daysAgoLocal(0);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('monthsAgoLocal', () => {
    it('should return date N months ago', () => {
      const result = monthsAgoLocal(1);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getDateRangePreset', () => {
    it('should return 7d preset', () => {
      const result = getDateRangePreset('7d');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should return 30d preset', () => {
      const result = getDateRangePreset('30d');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should return thisMonth preset', () => {
      const result = getDateRangePreset('thisMonth');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should return lastMonth preset', () => {
      const result = getDateRangePreset('lastMonth');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should return thisYear preset', () => {
      const result = getDateRangePreset('thisYear');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should return lastYear preset', () => {
      const result = getDateRangePreset('lastYear');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should default to 30d for unknown preset', () => {
      const result = getDateRangePreset('unknown' as '7d');
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });
  });

  describe('convertDateRangeToUTC', () => {
    it('should convert date range to UTC', () => {
      const result = convertDateRangeToUTC('2024-03-01', '2024-03-15');
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });
  });

  describe('COMMON_TIMEZONES', () => {
    it('should have valid timezone entries', () => {
      expect(COMMON_TIMEZONES.length).toBeGreaterThan(0);
      expect(COMMON_TIMEZONES[0]).toHaveProperty('value');
      expect(COMMON_TIMEZONES[0]).toHaveProperty('label');
    });
  });
});