import { describe, it, expect } from '@jest/globals';
import {
  calculateSuggestedPrice,
  calculateSuggestedPriceWithRounding,
  calculateActualMargin,
  calculateProfit,
} from '@/utils/pricing';

describe('pricing', () => {
  describe('calculateSuggestedPrice', () => {
    it('should calculate price with 21% tax and 30% margin', () => {
      const result = calculateSuggestedPrice(100, 21, 30);
      expect(result).toBe(157.3);
    });

    it('should calculate price with 0% tax', () => {
      const result = calculateSuggestedPrice(100, 0, 30);
      expect(result).toBe(130);
    });

    it('should calculate price with 0% margin', () => {
      const result = calculateSuggestedPrice(100, 21, 0);
      expect(result).toBe(121);
    });

    it('should handle decimal costs', () => {
      const result = calculateSuggestedPrice(55.5, 21, 25);
      expect(result).toBeCloseTo(83.94, 2);
    });
  });

  describe('calculateSuggestedPriceWithRounding', () => {
    it('should round to nearest 10', () => {
      const result = calculateSuggestedPriceWithRounding(100, 21, 30, 10);
      expect(result).toBe(160);
    });

    it('should round up when between', () => {
      const result = calculateSuggestedPriceWithRounding(100, 21, 15, 10);
      expect(result).toBe(140);
    });

    it('should round to nearest 100', () => {
      const result = calculateSuggestedPriceWithRounding(100, 21, 30, 100);
      expect(result).toBe(200);
    });
  });

  describe('calculateActualMargin', () => {
    it('should calculate margin from cost and price', () => {
      const result = calculateActualMargin(100, 157.3, 21);
      expect(result).toBe(30);
    });

    it('should handle 0% margin', () => {
      const result = calculateActualMargin(100, 121, 21);
      expect(result).toBe(0);
    });

    it('should calculate negative margin', () => {
      const result = calculateActualMargin(100, 90, 21);
      expect(result).toBeLessThan(0);
    });
  });

  describe('calculateProfit', () => {
    it('should calculate profit per unit', () => {
      const result = calculateProfit(100, 157.3, 21);
      expect(result).toBe(30);
    });

    it('should return 0 when price equals cost', () => {
      const result = calculateProfit(100, 121, 21);
      expect(result).toBe(0);
    });

    it('should calculate loss when price below cost', () => {
      const result = calculateProfit(100, 110, 21);
      expect(result).toBeLessThan(0);
    });
  });
});
