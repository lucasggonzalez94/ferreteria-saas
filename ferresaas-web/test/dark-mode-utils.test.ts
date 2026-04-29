import { alertColors, textColors, getAlertColor, getTextColor } from '@/lib/dark-mode-utils';

describe('dark-mode-utils', () => {
  describe('alertColors', () => {
    it('should have critical color', () => {
      expect(alertColors.critical).toBe('bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800');
    });

    it('should have warning color', () => {
      expect(alertColors.warning).toBe('bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800');
    });

    it('should have info color', () => {
      expect(alertColors.info).toBe('bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800');
    });

    it('should have success color', () => {
      expect(alertColors.success).toBe('bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800');
    });

    it('should have default color', () => {
      expect(alertColors.default).toBe('bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700');
    });
  });

  describe('textColors', () => {
    it('should have critical text color', () => {
      expect(textColors.critical).toBe('text-red-600 dark:text-red-400');
    });

    it('should have warning text color', () => {
      expect(textColors.warning).toBe('text-yellow-600 dark:text-yellow-400');
    });

    it('should have info text color', () => {
      expect(textColors.info).toBe('text-blue-600 dark:text-blue-400');
    });

    it('should have success text color', () => {
      expect(textColors.success).toBe('text-green-600 dark:text-green-400');
    });

    it('should have muted text color', () => {
      expect(textColors.muted).toBe('text-gray-600 dark:text-gray-400');
    });
  });

  describe('getAlertColor', () => {
    it('should return critical for CRITICAL', () => {
      expect(getAlertColor('CRITICAL')).toBe(alertColors.critical);
    });

    it('should return warning for WARNING', () => {
      expect(getAlertColor('WARNING')).toBe(alertColors.warning);
    });

    it('should return info for INFO', () => {
      expect(getAlertColor('INFO')).toBe(alertColors.info);
    });

    it('should return success for SUCCESS', () => {
      expect(getAlertColor('SUCCESS')).toBe(alertColors.success);
    });

    it('should return default for unknown', () => {
      expect(getAlertColor('UNKNOWN')).toBe(alertColors.default);
    });

    it('should handle lowercase', () => {
      expect(getAlertColor('critical')).toBe(alertColors.critical);
    });
  });

  describe('getTextColor', () => {
    it('should return critical for CRITICAL', () => {
      expect(getTextColor('CRITICAL')).toBe(textColors.critical);
    });

    it('should return warning for WARNING', () => {
      expect(getTextColor('WARNING')).toBe(textColors.warning);
    });

    it('should return info for INFO', () => {
      expect(getTextColor('INFO')).toBe(textColors.info);
    });

    it('should return success for SUCCESS', () => {
      expect(getTextColor('SUCCESS')).toBe(textColors.success);
    });

    it('should return muted for unknown', () => {
      expect(getTextColor('UNKNOWN')).toBe(textColors.muted);
    });

    it('should handle lowercase', () => {
      expect(getTextColor('critical')).toBe(textColors.critical);
    });
  });
});