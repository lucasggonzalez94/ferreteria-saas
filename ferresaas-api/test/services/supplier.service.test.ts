import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  supplier: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  purchase: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  supplierPayable: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

import { SupplierService } from '@/services/supplier.service';

describe('SupplierService', () => {
  let supplierService: SupplierService;

  beforeEach(() => {
    jest.clearAllMocks();
    supplierService = new SupplierService();
  });

  describe('list', () => {
    it('lists suppliers with pagination meta', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([
        { id: 'sup-1', name: 'Proveedor Uno', _count: { purchases: 2 } },
      ]);
      mockPrisma.supplier.count.mockResolvedValue(1);

      const result = await supplierService.list('biz-1', { page: 1, limit: 20 });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-1' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasMore).toBe(false);
      expect(result.items[0].name).toBe('Proveedor Uno');
    });

    it('applies search and active filters and caps limit at 100', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([]);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await supplierService.list('biz-1', {
        search: 'ferre',
        isActive: true,
        page: 2,
        limit: 150,
      });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz-1',
            isActive: true,
            OR: [
              { name: { contains: 'ferre', mode: 'insensitive' } },
              { cuit: { contains: 'ferre', mode: 'insensitive' } },
              { email: { contains: 'ferre', mode: 'insensitive' } },
            ],
          }),
          skip: 100,
          take: 100,
        }),
      );
    });
  });

  describe('getSummary', () => {
    it('throws not found when supplier does not exist', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(null);

      await expect(supplierService.getSummary('biz-1', 'sup-1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'SUPPLIER_NOT_FOUND',
      });
    });

    it('throws forbidden when supplier belongs to another business', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', businessId: 'biz-2' });

      await expect(supplierService.getSummary('biz-1', 'sup-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('returns computed summary stats', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', businessId: 'biz-1', name: 'Proveedor Uno' });
      mockPrisma.purchase.findMany.mockResolvedValue([{ total: 1000 }, { total: 500 }]);
      mockPrisma.supplierPayable.findMany.mockResolvedValue([
        { amount: 400, paidAmount: 100, status: 'PENDING' },
        { amount: 600, paidAmount: 300, status: 'PARTIAL' },
      ]);
      mockPrisma.purchase.findFirst.mockResolvedValue({ createdAt: '2026-04-20T10:00:00.000Z' });

      const result = await supplierService.getSummary('biz-1', 'sup-1');

      expect(result.stats.totalPurchases).toBe(2);
      expect(result.stats.totalAmount).toBe(1500);
      expect(result.stats.totalPayable).toBe(1000);
      expect(result.stats.totalPaid).toBe(400);
      expect(result.stats.pendingPayment).toBe(600);
      expect(result.stats.lastPurchaseDate).toBe('2026-04-20T10:00:00.000Z');
    });
  });
});
