import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  inventoryMovement: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  product: {
    findMany: jest.fn() as any,
  },
  sale: {
    findUnique: jest.fn() as any,
  },
};

const mockQueryRaw = jest.fn() as any;

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
  Prisma: {
    sql: jest.fn((...args: any[]) => args),
    empty: '',
  },
}));

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
  default: { inventoryMovement: { findMany: jest.fn() } },
}));

Object.defineProperty(mockPrisma, '$queryRaw', {
  value: mockQueryRaw,
  writable: true,
});

import { InventoryReportsService } from '@/services/inventory-reports.service';

describe('InventoryReportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const businessId = 'biz-1';

  describe('getMovementsReport', () => {
    it('devuelve movimientos con paginación y totales', async () => {
      const mockMovements = [
        { id: 'm1', type: 'SALE', quantity: n(5), product: { id: 'p1', internalSku: 'SKU1', name: 'Producto 1', unit: 'units' }, createdAt: new Date() },
        { id: 'm2', type: 'PURCHASE_RECEIPT', quantity: n(10), product: { id: 'p2', internalSku: 'SKU2', name: 'Producto 2', unit: 'units' }, createdAt: new Date() },
      ];

      mockPrisma.inventoryMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.inventoryMovement.count.mockResolvedValue(2);
      mockQueryRaw.mockResolvedValue([
        { type: 'SALE', unit: 'units', total_quantity: 5 },
        { type: 'PURCHASE_RECEIPT', unit: 'units', total_quantity: 10 },
      ]);

      const result = await new InventoryReportsService().getMovementsReport(businessId, {});

      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.totals.SALE.units).toBe(5);
      expect(result.totals.PURCHASE_RECEIPT.units).toBe(10);
    });

    it('filtra por tipo y producto', async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);
      mockPrisma.inventoryMovement.count.mockResolvedValue(0);
      mockQueryRaw.mockResolvedValue([]);

      const result = await new InventoryReportsService().getMovementsReport(businessId, {
        type: 'SALE',
        productId: 'p1',
      });

      expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SALE',
            productId: 'p1',
          }),
        })
      );
    });

    it('paginación correcta', async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);
      mockPrisma.inventoryMovement.count.mockResolvedValue(100);
      mockQueryRaw.mockResolvedValue([]);

      const result = await new InventoryReportsService().getMovementsReport(businessId, {
        page: 2,
        limit: 10,
      });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(10);
      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('getStockAlertsReport', () => {
    it('devuelve alertas clasificadas por nivel', async () => {
      const mockProducts = [
        { id: 'p1', internalSku: 'SKU1', name: 'Prod sin stock', unit: 'units', stockQuantity: n(0), minStock: null, category: { id: 'c1', name: 'Cat1' } },
        { id: 'p2', internalSku: 'SKU2', name: 'Prod bajo mínimo', unit: 'units', stockQuantity: n(3), minStock: n(10), category: { id: 'c1', name: 'Cat1' } },
        { id: 'p3', internalSku: 'SKU3', name: 'Prod OK', unit: 'units', stockQuantity: n(100), minStock: n(10), category: { id: 'c1', name: 'Cat1' } },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await new InventoryReportsService().getStockAlertsReport(businessId);

      expect(result.items).toHaveLength(2);
      expect(result.summary.critical).toBe(1);
      expect(result.summary.warning).toBe(1);
      expect(result.byLevel.CRITICAL).toHaveLength(1);
      expect(result.byLevel.WARNING).toHaveLength(1);
    });

    it('calcula percentageOfMin correctamente', async () => {
      const mockProducts = [
        { id: 'p1', internalSku: 'SKU1', name: 'Prod', unit: 'units', stockQuantity: n(5), minStock: n(10), category: { id: 'c1', name: 'Cat1' } },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await new InventoryReportsService().getStockAlertsReport(businessId);

      expect(result.items[0].percentageOfMin).toBe(50);
      expect(result.items[0].alertLevel).toBe('WARNING');
    });
  });

  describe('getReturnsReport', () => {
    it('devuelve devoluciones con paginación', async () => {
      const mockMovements = [
        { id: 'm1', type: 'RETURN', quantity: n(2), product: { id: 'p1', internalSku: 'SKU1', name: 'Producto', unit: 'units' }, referenceId: 'sale-1', createdAt: new Date() },
      ];

      const mockSale = {
        id: 'sale-1',
        customer: { id: 'c1', name: 'Cliente 1' },
        items: [{ id: 'i1', quantity: n(2), unitPrice: n(100) }],
      };

      mockPrisma.inventoryMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.inventoryMovement.count.mockResolvedValue(1);
      mockPrisma.sale.findUnique.mockResolvedValue(mockSale as any);

      const result = await new InventoryReportsService().getReturnsReport(businessId, {});

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('filtra por rango de fechas y cliente', async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);
      mockPrisma.inventoryMovement.count.mockResolvedValue(0);
      mockPrisma.sale.findUnique.mockResolvedValue(null);

      const result = await new InventoryReportsService().getReturnsReport(businessId, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        customerId: 'c1',
      });

      expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'RETURN',
            createdAt: expect.objectContaining({
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            }),
          }),
        })
      );
    });
  });

  describe('getRotationReport', () => {
    it('clasifica productos por velocidad de rotación', async () => {
      const mockProducts = [
        { id: 'p1', internalSku: 'SKU1', name: 'Prod rápido', unit: 'units', stockQuantity: n(10), cost: n(100), category: { name: 'Cat1' } },
        { id: 'p2', internalSku: 'SKU2', name: 'Prod normal', unit: 'units', stockQuantity: n(20), cost: n(50), category: { name: 'Cat2' } },
        { id: 'p3', internalSku: 'SKU3', name: 'Prod lento', unit: 'units', stockQuantity: n(100), cost: n(10), category: { name: 'Cat3' } },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const mockMovements = [
        { type: 'SALE', quantity: n(-30) },
        { type: 'PURCHASE_RECEIPT', quantity: n(40) },
        { type: 'SALE', quantity: n(-5) },
      ];

      mockPrisma.inventoryMovement.findMany.mockResolvedValue(mockMovements);

      const result = await new InventoryReportsService().getRotationReport(businessId, {});

      expect(result.items).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.totalStockValue).toBeGreaterThan(0);
    });

    it('filtra por rango de fechas', async () => {
      const mockProducts = [
        { id: 'p1', internalSku: 'SKU1', name: 'Prod', unit: 'units', stockQuantity: n(10), cost: n(100), category: { name: 'Cat' } },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);

      const result = await new InventoryReportsService().getRotationReport(businessId, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(mockPrisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            }),
          }),
        })
      );
    });
  });
});