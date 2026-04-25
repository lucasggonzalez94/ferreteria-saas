import { describe, it, expect } from '@jest/globals';
import {
  createProductSchema,
  updateProductSchema,
  updatePriceSchema,
  productFiltersSchema,
} from '@/routes/products.schemas';

describe('products schemas', () => {
  describe('createProductSchema', () => {
    it('should validate correct product input', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        cost: 100,
        price: 150,
        unit: 'u',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative cost', () => {
      const input = {
        name: 'Test Product',
        cost: -10,
        price: 150,
        unit: 'u',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject zero price', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 0,
        unit: 'u',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid unit', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'invalid',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject tax rate over 100', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        taxRate: 150,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

it('should accept valid unit types', () => {
      const units = ['u', 'mt', 'kg', 'lt'];
      for (const unit of units) {
        const input = { name: 'Test', cost: 100, price: 150, unit };
        const result = createProductSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject marginPercent >= 100', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        marginPercent: 100,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject marginPercent <= 0', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        marginPercent: 0,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept valid marginPercent', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        marginPercent: 50,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept initialStock', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        initialStock: 10,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept targetMargin', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        targetMargin: 30,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject targetMargin >= 100', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        targetMargin: 100,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept targetMarkup', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        targetMarkup: 25,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject targetMarkup <= 0', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        targetMarkup: 0,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept priceLocked', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        priceLocked: true,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept roundingStep', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        roundingStep: 5,
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept costMethod', () => {
      const input = {
        name: 'Test Product',
        cost: 100,
        price: 150,
        unit: 'u',
        costMethod: 'last_cost',
      };
      const result = createProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

describe('updateProductSchema', () => {
    it('should validate partial update', () => {
      const input = {
        name: 'Updated Name',
      };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative minStock', () => {
      const input = {
        minStock: -5,
      };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative stockQuantity', () => {
      const input = {
        stockQuantity: -5,
      };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept update with targetMargin', () => {
      const input = { targetMargin: 30 };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject targetMargin >= 100 in update', () => {
      const input = { targetMargin: 100 };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept update with targetMarkup', () => {
      const input = { targetMarkup: 25 };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject targetMarkup <= 0 in update', () => {
      const input = { targetMarkup: 0 };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept isActive toggle', () => {
      const input = { isActive: false };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept barcode update', () => {
      const input = { barcode: '123456789' };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept description update', () => {
      const input = { description: 'Updated description' };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept taxRate update', () => {
      const input = { taxRate: 10.5 };
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('updatePriceSchema', () => {
    it('should validate price update', () => {
      const input = {
        newCost: 100,
        newPrice: 150,
      };
      const result = updatePriceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept optional reason', () => {
      const input = {
        newCost: 100,
        newPrice: 150,
        reason: 'Price adjustment',
      };
      const result = updatePriceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative newCost', () => {
      const input = {
        newCost: -10,
        newPrice: 150,
      };
      const result = updatePriceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('productFiltersSchema', () => {
    it('should validate empty filters', () => {
      const input = {};
      const result = productFiltersSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with search query', () => {
      const input = { q: 'test' };
      const result = productFiltersSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate active filter', () => {
      const input = { active: 'true' };
      const result = productFiltersSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid active filter', () => {
      const input = { active: 'maybe' };
      const result = productFiltersSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
