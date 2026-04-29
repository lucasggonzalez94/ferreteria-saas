import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  sale: {
    findMany: jest.fn() as any,
  },
  saleItem: {
    findMany: jest.fn() as any,
  },
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));

import { SalesReportsService } from '@/services/sales-reports.service';

describe('SalesReportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const businessId = 'biz-1';
  const baseFilters = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    compareWithPrevious: false,
  };

  it('getSummary calcula métricas correctamente sin comparación', async () => {
    const mockSales = [
      {
        id: 'sale-1',
        total: n(1500),
        confirmedAt: new Date('2024-01-15T10:00:00'),
        payments: [
          { method: 'CASH_ARS', amount: n(1000) },
          { method: 'TRANSFER', amount: n(500) },
        ],
        customer: { id: 'c1', firstName: 'Juan', lastName: 'Perez', companyName: null },
      },
      {
        id: 'sale-2',
        total: n(800),
        confirmedAt: new Date('2024-01-20T14:00:00'),
        payments: [{ method: 'CASH_ARS', amount: n(800) }],
        customer: { id: 'c2', firstName: 'Maria', lastName: 'Gomez', companyName: 'Empresa' },
      },
    ];

    const mockSaleItems = [
      { productId: 'p1', product: { name: 'Producto A', category: { id: 'cat1', name: 'Herramientas' } }, quantity: n(2), subtotal: n(1000) },
      { productId: 'p2', product: { name: 'Producto B', category: { id: 'cat2', name: 'Tornillos' } }, quantity: n(5), subtotal: n(500) },
      { productId: 'p1', product: { name: 'Producto A', category: { id: 'cat1', name: 'Herramientas' } }, quantity: n(1), subtotal: n(500) },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue(mockSaleItems);

    const result = await new SalesReportsService().getSummary(businessId, baseFilters);

    expect(result.metrics.totalRevenue).toBe(2300);
    expect(result.metrics.totalSales).toBe(2);
    expect(result.metrics.avgTicket).toBe(1150);
    expect(result.metrics.totalItems).toBe(8);
    expect(result.comparison).toBeNull();
    expect(result.timeSeries.length).toBeGreaterThan(0);
    expect(result.topProducts.length).toBe(2);
    expect(result.topCategories.length).toBe(2);
    expect(result.paymentMethods).toEqual({
      CASH_ARS: 1800,
      TRANSFER: 500,
    });
  });

  it('getSummary filtra por customerId', async () => {
    const filters = { ...baseFilters, customerId: 'c1' };

    const mockSales = [
      {
        id: 'sale-1',
        total: n(1000),
        confirmedAt: new Date('2024-01-15'),
        payments: [{ method: 'CASH_ARS', amount: n(1000) }],
        customer: { id: 'c1', firstName: 'Juan', lastName: 'Perez', companyName: null },
      },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue([]);

    const result = await new SalesReportsService().getSummary(businessId, filters);

    expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'c1',
        }),
      })
    );
    expect(result.metrics.totalRevenue).toBe(1000);
  });

  it('getSummary filtra por categoryId', async () => {
    const filters = { ...baseFilters, categoryId: 'cat1' };

    const mockSales = [
      {
        id: 'sale-1',
        total: n(1500),
        confirmedAt: new Date('2024-01-15'),
        payments: [{ method: 'CASH_ARS', amount: n(1500) }],
        customer: { id: 'c1', firstName: 'Juan', lastName: null, companyName: null },
      },
    ];

    const mockSaleItems = [
      { productId: 'p1', product: { name: 'Producto A', category: { id: 'cat1', name: 'Herramientas' } }, quantity: n(2), subtotal: n(1500) },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue(mockSaleItems);

    const result = await new SalesReportsService().getSummary(businessId, filters);

    expect(mockPrisma.saleItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: { categoryId: 'cat1' },
        }),
      })
    );
    expect(result.metrics.totalRevenue).toBe(1500);
  });

  it('getSummary incluye comparación con período anterior cuando compareWithPrevious=true', async () => {
    const filters = { ...baseFilters, compareWithPrevious: true };

    const mockCurrentSales = [
      { id: 'sale-1', total: n(2000), confirmedAt: new Date('2024-01-15'), payments: [{ method: 'CASH_ARS', amount: n(2000) }], customer: { id: 'c1', firstName: 'Juan', lastName: null, companyName: null } },
    ];
    const mockPrevSales = [
      { id: 'sale-old', total: n(1000), confirmedAt: new Date('2023-12-15'), payments: [], customer: null },
    ];

    mockPrisma.sale.findMany
      .mockResolvedValueOnce(mockCurrentSales)
      .mockResolvedValueOnce(mockPrevSales);

    mockPrisma.saleItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await new SalesReportsService().getSummary(businessId, filters);

    expect(result.comparison).not.toBeNull();
    expect(result.comparison?.previousRevenue).toBe(1000);
    expect(result.comparison?.revenueDelta).toBe(1000);
    expect(result.comparison?.revenuePercentChange).toBe(100);
    expect(result.comparison?.previousSales).toBe(1);
    expect(result.comparison?.salesDelta).toBe(0);
  });

  it('getSummary maneja ventas sin pagos correctamente', async () => {
    const mockSales = [
      { id: 'sale-1', total: n(500), confirmedAt: new Date('2024-01-15'), payments: [], customer: { id: 'c1', firstName: 'Juan', lastName: null, companyName: null } },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue([]);

    const result = await new SalesReportsService().getSummary(businessId, baseFilters);

    expect(result.paymentMethods).toEqual({});
    expect(result.metrics.totalRevenue).toBe(500);
  });

  it('getSummary calcula top products correctamente', async () => {
    const mockSales = [
      { id: 'sale-1', total: n(3000), confirmedAt: new Date('2024-01-15'), payments: [{ method: 'CASH_ARS', amount: n(3000) }], customer: { id: 'c1', firstName: 'Juan', lastName: null, companyName: null } },
    ];

    const mockSaleItems = [
      { productId: 'p1', product: { name: 'Producto X', category: { id: 'cat1', name: 'A' } }, quantity: n(10), subtotal: n(2000) },
      { productId: 'p1', product: { name: 'Producto X', category: { id: 'cat1', name: 'A' } }, quantity: n(5), subtotal: n(1000) },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue(mockSaleItems);

    const result = await new SalesReportsService().getSummary(businessId, baseFilters);

    expect(result.topProducts).toHaveLength(1);
    expect(result.topProducts[0].productId).toBe('p1');
    expect(result.topProducts[0].productName).toBe('Producto X');
    expect(result.topProducts[0].totalRevenue).toBe(3000);
    expect(result.topProducts[0].totalUnits).toBe(15);
  });

  it('getSummary calcula percentages de categorías correctamente', async () => {
    const mockSales = [
      { id: 'sale-1', total: n(2000), confirmedAt: new Date('2024-01-15'), payments: [{ method: 'CASH_ARS', amount: n(2000) }], customer: { id: 'c1', firstName: 'Juan', lastName: null, companyName: null } },
    ];

    const mockSaleItems = [
      { productId: 'p1', product: { name: 'Prod A', category: { id: 'cat1', name: 'Herramientas' } }, quantity: n(2), subtotal: n(1500) },
      { productId: 'p2', product: { name: 'Prod B', category: { id: 'cat2', name: 'Tornillos' } }, quantity: n(5), subtotal: n(500) },
    ];

    mockPrisma.sale.findMany.mockResolvedValue(mockSales);
    mockPrisma.saleItem.findMany.mockResolvedValue(mockSaleItems);

    const result = await new SalesReportsService().getSummary(businessId, baseFilters);

    expect(result.topCategories).toHaveLength(2);
    const herramientas = result.topCategories.find((c: { categoryName: string }) => c.categoryName === 'Herramientas');
    expect(herramientas?.percentage).toBe(75);
    expect(herramientas?.totalRevenue).toBe(1500);
  });
});