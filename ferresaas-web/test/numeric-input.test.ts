import { parseNumericInput, formatNumericDisplay, isValidNumericInput, getDecimalPlaces } from '@/lib/numeric-input';

describe('numeric-input', () => {
  describe('parseNumericInput', () => {
    it('should return number as-is if valid number', () => {
      expect(parseNumericInput(100)).toBe(100);
      expect(parseNumericInput(0)).toBe(0);
      expect(parseNumericInput(-50)).toBe(-50);
    });

    it('should return 0 for NaN', () => {
      expect(parseNumericInput(NaN)).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(parseNumericInput(null as unknown as string)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseNumericInput('')).toBe(0);
    });

    it('should return 0 for whitespace only', () => {
      expect(parseNumericInput('   ')).toBe(0);
    });

    it('should parse European format 100.000,50', () => {
      expect(parseNumericInput('100.000,50')).toBe(100000.5);
    });

    it('should parse US format 100,000.50', () => {
      expect(parseNumericInput('100,000.50')).toBe(100000.5);
    });

    it('should parse plain number 100000.50', () => {
      expect(parseNumericInput('100000.50')).toBe(100000.5);
    });

    it('should parse plain number 100000,50', () => {
      expect(parseNumericInput('100000,50')).toBe(100000.5);
    });

    it('should handle multiple dots as thousands separator', () => {
      expect(parseNumericInput('1.000.000')).toBe(1000000);
    });

    it('should handle multiple commas as thousands separator', () => {
      expect(parseNumericInput('1,000,000')).toBe(1000000);
    });

    it('should handle single comma as decimal', () => {
      expect(parseNumericInput('100,50')).toBe(100.5);
    });

    it('should handle single dot as decimal', () => {
      expect(parseNumericInput('100.50')).toBe(100.5);
    });

    it('should return 0 for invalid string', () => {
      expect(parseNumericInput('abc')).toBe(0);
    });

    it('should handle exactly 3 digits after comma as thousands separator', () => {
      expect(parseNumericInput('1,000')).toBe(1000);
    });

    it('should handle 3 digits after comma as thousands in larger numbers', () => {
      expect(parseNumericInput('100,000')).toBe(100000);
    });

    it('should handle 4 digits after comma as decimal', () => {
      expect(parseNumericInput('100,0000')).toBe(100);
    });
  });

  describe('formatNumericDisplay', () => {
    it('should format number with default decimals', () => {
      const result = formatNumericDisplay(1000.5);
      expect(result).toContain('50');
    });

    it('should format with custom decimals', () => {
      const result = formatNumericDisplay(1000.5, 0);
      expect(result).toMatch(/\d+/);
    });

    it('should format string input', () => {
      const result = formatNumericDisplay('1000.50');
      expect(result).toContain('50');
    });

    it('should use custom locale', () => {
      const result = formatNumericDisplay(1000.5, 2, 'en-US');
      expect(result).toMatch(/1,\d+/);
    });
  });

  describe('isValidNumericInput', () => {
    it('should return false for null', () => {
      expect(isValidNumericInput(null as unknown as string)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidNumericInput('')).toBe(false);
    });

    it('should return true for valid number string', () => {
      expect(isValidNumericInput('100.50')).toBe(true);
    });

    it('should return true for numeric string', () => {
      expect(isValidNumericInput('123')).toBe(true);
    });
  });

  describe('getDecimalPlaces', () => {
    it('should return 0 for empty string', () => {
      expect(getDecimalPlaces('')).toBe(0);
    });

    it('should return 0 for integer', () => {
      expect(getDecimalPlaces('100')).toBe(0);
    });

    it('should return correct decimals', () => {
      expect(getDecimalPlaces('100.50')).toBeGreaterThan(0);
    });

    it('should return correct decimals for parsed value', () => {
      expect(getDecimalPlaces('100.123')).toBeGreaterThan(0);
    });
  });
});