import { describe, it, expect } from '@jest/globals';
import {
  createSaleSchema,
  confirmSaleSchema,
  salesFiltersSchema,
  requestDiscountApprovalSchema,
  approveDiscountSchema,
  rejectDiscountSchema,
  createAdjustmentNoteSchema,
  refundSaleSchema,
  invoiceFiltersSchema,
} from '@/routes/sales.schemas';

describe('sales schemas', () => {
  const validCuid = 'cia3ae12e000000000000000000';

  describe('createSaleSchema', () => {
    it('should validate correct sale input', () => {
      const input = {
        items: [
          {
            productId: validCuid,
            quantity: 2,
            unitPrice: 100,
            taxRate: 21,
          },
        ],
      };
      const result = createSaleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty items', () => {
      const input = { items: [] };
      const result = createSaleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative discount', () => {
      const input = {
        items: [{ productId: validCuid, quantity: 2, unitPrice: 100, taxRate: 21 }],
        discountAmount: -10,
      };
      const result = createSaleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate with optional customer', () => {
      const input = {
        customerId: validCuid,
        items: [{ productId: validCuid, quantity: 2, unitPrice: 100, taxRate: 21 }],
      };
      const result = createSaleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('confirmSaleSchema', () => {
    it('should validate correct confirm input', () => {
      const input = { payments: [{ method: 'CASH_ARS' as const, amount: 200 }] };
      const result = confirmSaleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty payments', () => {
      const input = { payments: [] };
      const result = confirmSaleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept invoice type', () => {
      const input = {
        payments: [{ method: 'CASH_ARS' as const, amount: 200 }],
        invoiceType: 'A' as const,
      };
      const result = confirmSaleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid invoice type', () => {
      const input = {
        payments: [{ method: 'CASH_ARS' as const, amount: 200 }],
        invoiceType: 'D' as any,
      };
      const result = confirmSaleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('salesFiltersSchema', () => {
    it('should validate empty filters', () => {
      const result = salesFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate status filter', () => {
      const result = salesFiltersSchema.safeParse({ status: 'CONFIRMED' });
      expect(result.success).toBe(true);
    });

    it('should validate page as string number', () => {
      const result = salesFiltersSchema.safeParse({ page: '1', limit: '10' });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric page', () => {
      const result = salesFiltersSchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('requestDiscountApprovalSchema', () => {
    it('should validate discount approval request', () => {
      const input = {
        saleId: validCuid,
        productId: validCuid,
        originalPrice: 100,
        discountedPrice: 80,
        discountReason: 'Customer requested discount',
      };
      const result = requestDiscountApprovalSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow when discountedPrice >= originalPrice (schema does not validate this)', () => {
      const input = {
        saleId: validCuid,
        productId: validCuid,
        originalPrice: 100,
        discountedPrice: 100,
        discountReason: 'Test',
      };
      const result = requestDiscountApprovalSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('approveDiscountSchema', () => {
    it('should validate approval', () => {
      const input = {
        discountApprovalId: validCuid,
        approverPassword: 'password12345678',
      };
      const result = approveDiscountSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('rejectDiscountSchema', () => {
    it('should validate rejection without reason', () => {
      const input = { discountApprovalId: validCuid };
      const result = rejectDiscountSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate rejection with reason', () => {
      const input = {
        discountApprovalId: validCuid,
        rejectionReason: 'Not approved',
      };
      const result = rejectDiscountSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('createAdjustmentNoteSchema', () => {
    it('should validate credit note', () => {
      const input = {
        kind: 'CREDIT' as const,
        letter: 'A' as const,
        reason: 'Product return',
      };
      const result = createAdjustmentNoteSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject short reason', () => {
      const input = {
        kind: 'CREDIT' as const,
        letter: 'A' as const,
        reason: 'ab',
      };
      const result = createAdjustmentNoteSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('refundSaleSchema', () => {
    it('should validate refund', () => {
      const input = {
        items: [{ saleItemId: validCuid, quantity: 1 }],
        refundPayments: [{ method: 'CASH_ARS' as const, amount: 100 }],
        reason: 'Customer returned product',
      };
      const result = refundSaleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty items', () => {
      const input = {
        items: [],
        refundPayments: [{ method: 'CASH_ARS' as const, amount: 100 }],
        reason: 'Test',
      };
      const result = refundSaleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('invoiceFiltersSchema', () => {
    it('should validate voucher types', () => {
      const voucherTypes = ['A', 'B', 'C', 'NC_A', 'NC_B', 'NC_C', 'ND_A', 'ND_B', 'ND_C'];
      for (const vt of voucherTypes) {
        const result = invoiceFiltersSchema.safeParse({ voucherType: vt as any });
        expect(result.success).toBe(true);
      }
    });
  });
});
