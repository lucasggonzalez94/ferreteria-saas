import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  supplier: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  purchase: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
  },
  exchangeRateSnapshot: {
    create: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockAuditService = {
  logCreate: jest.fn() as any,
};

const mockInventoryCreateMovement = jest.fn() as any;
const mockGetDefaultByType = jest.fn() as any;
const mockValidateFunds = jest.fn() as any;
const mockGetRate = jest.fn() as any;

const mockGetAccountTypeByPaymentMethod = jest.fn() as any;
const mockCalculateWeightedAverageCost = jest.fn() as any;
const mockProcessCostChange = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/inventory.service', () => ({
  InventoryService: class InventoryService {
    createMovement = mockInventoryCreateMovement;
  },
}));
jest.mock('@/services/financial-account.service', () => ({
  FinancialAccountService: class FinancialAccountService {
    getDefaultByType = mockGetDefaultByType;
    validateFunds = mockValidateFunds;
  },
}));
jest.mock('@/services/financial-movement.service', () => ({
  FinancialMovementService: class FinancialMovementService {
    static getAccountTypeByPaymentMethod = mockGetAccountTypeByPaymentMethod;
  },
}));
jest.mock('@/services/pricing.service', () => ({
  PricingService: {
    calculateWeightedAverageCost: mockCalculateWeightedAverageCost,
    processCostChange: mockProcessCostChange,
  },
}));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {
    getRate = mockGetRate;
  },
}));
jest.mock('@/services/check.service', () => ({
  CheckService: class CheckService {},
}));

import { PurchaseService } from '@/services/purchase.service';

describe('PurchaseService', () => {
  let service: PurchaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PurchaseService();
  });

  it('create valida proveedor y pertenencia al negocio', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValue(null);

    await expect(
      service.create('biz-1', 'user-1', {
        supplierId: 'sup-1',
        items: [{ productId: 'prod-1', quantity: 1, unitCost: 10, taxRate: 21 }],
      })
    ).rejects.toThrow('Supplier not found');

    mockPrisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', businessId: 'biz-2' });

    await expect(
      service.create('biz-1', 'user-1', {
        supplierId: 'sup-1',
        items: [{ productId: 'prod-1', quantity: 1, unitCost: 10, taxRate: 21 }],
      })
    ).rejects.toThrow('Access denied');
  });

  it('create exige datos de cheque cuando paymentMethod es CHECK', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      businessId: 'biz-1',
      currentBalance: n(0),
      paymentTermDays: 0,
      name: 'Proveedor 1',
    });

    await expect(
      service.create('biz-1', 'user-1', {
        supplierId: 'sup-1',
        amountPaid: 100,
        paymentMethod: 'CHECK',
        items: [{ productId: 'prod-1', quantity: 1, unitCost: 100, taxRate: 0 }],
      })
    ).rejects.toThrow('Check number is required for check payments');

    await expect(
      service.create('biz-1', 'user-1', {
        supplierId: 'sup-1',
        amountPaid: 100,
        paymentMethod: 'CHECK',
        checkNumber: '0001',
        items: [{ productId: 'prod-1', quantity: 1, unitCost: 100, taxRate: 0 }],
      })
    ).rejects.toThrow('Bank account is required for check payments');
  });

  it('create valida fondos para pagos inmediatos', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      businessId: 'biz-1',
      currentBalance: n(0),
      paymentTermDays: 0,
      name: 'Proveedor 1',
    });
    mockGetAccountTypeByPaymentMethod.mockReturnValue('CASH');
    mockGetDefaultByType.mockResolvedValue({ id: 'acc-1' });
    mockValidateFunds.mockRejectedValue(new Error('fondos insuficientes'));

    await expect(
      service.create('biz-1', 'user-1', {
        supplierId: 'sup-1',
        amountPaid: 100,
        paymentMethod: 'CASH',
        items: [{ productId: 'prod-1', quantity: 1, unitCost: 100, taxRate: 0 }],
      })
    ).rejects.toThrow('fondos insuficientes');

    expect(mockGetDefaultByType).toHaveBeenCalledWith('biz-1', 'CASH');
    expect(mockValidateFunds).toHaveBeenCalledWith('acc-1', 100);
  });

  it('list aplica filtros y metadatos', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    mockPrisma.purchase.findMany.mockResolvedValue([{ id: 'pur-1' }]);
    mockPrisma.purchase.count.mockResolvedValue(1);

    const result = await service.list('biz-1', {
      supplierId: 'sup-1',
      startDate,
      endDate,
      page: 1,
      limit: 20,
    });

    expect(mockPrisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          supplierId: 'sup-1',
          createdAt: expect.objectContaining({ gte: startDate, lte: endDate }),
        }),
      })
    );
    expect(result.meta.total).toBe(1);
  });

  it('getById valida existencia y ownership', async () => {
    mockPrisma.purchase.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById('biz-1', 'pur-1')).rejects.toThrow('Purchase not found');

    mockPrisma.purchase.findUnique.mockResolvedValueOnce({ id: 'pur-1', businessId: 'biz-2' });
    await expect(service.getById('biz-1', 'pur-1')).rejects.toThrow('Access denied');

    mockPrisma.purchase.findUnique.mockResolvedValueOnce({ id: 'pur-1', businessId: 'biz-1' });
    const purchase = await service.getById('biz-1', 'pur-1');
    expect(purchase.id).toBe('pur-1');
  });
});
