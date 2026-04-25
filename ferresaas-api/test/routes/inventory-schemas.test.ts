import { describe, it, expect } from '@jest/globals';
import {
  createAdjustmentSchema,
  processReturnSchema,
  movementFiltersSchema,
} from '@/routes/inventory.schemas';

describe('inventory schemas', () => {
  const validCuid = 'cia3ae12e000000000000000000';

  describe('createAdjustmentSchema', () => {
    it('should validate valid adjustment', () => {
      const input = {
        productId: validCuid,
        quantity: 10,
        reason: 'Stock count correction',
      };
      const result = createAdjustmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty reason', () => {
      const input = {
        productId: validCuid,
        quantity: 10,
        reason: '',
      };
      const result = createAdjustmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept negative quantity', () => {
      const input = {
        productId: validCuid,
        quantity: -5,
        reason: 'Damaged goods',
      };
      const result = createAdjustmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject reason > 500 chars', () => {
      const input = {
        productId: validCuid,
        quantity: 10,
        reason: 'a'.repeat(501),
      };
      const result = createAdjustmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('processReturnSchema', () => {
    it('should validate valid return', () => {
      const input = {
        saleId: validCuid,
        items: [{ productId: validCuid, quantity: 2 }],
      };
      const result = processReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty items', () => {
      const input = {
        saleId: validCuid,
        items: [],
      };
      const result = processReturnSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept with reason', () => {
      const input = {
        saleId: validCuid,
        items: [{ productId: validCuid, quantity: 2 }],
        reason: 'Customer returned',
      };
      const result = processReturnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('movementFiltersSchema', () => {
    it('should validate empty filters', () => {
      const result = movementFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate with productId', () => {
      const result = movementFiltersSchema.safeParse({ productId: validCuid });
      expect(result.success).toBe(true);
    });

    it('should validate page as string', () => {
      const result = movementFiltersSchema.safeParse({ page: '1', limit: '10' });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric page', () => {
      const result = movementFiltersSchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});
