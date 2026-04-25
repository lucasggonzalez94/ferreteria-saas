import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  cashRegisterSession: {
    findUnique: jest.fn() as any,
  },
  exchangeRateSnapshot: {
    create: jest.fn() as any,
  },
};

const mockGetRate = jest.fn() as any;

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {
    getRate = mockGetRate;
  },
}));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { CashRegisterService } from '@/services/cash-register.service';

describe('CashRegisterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculateSummary devuelve null si no existe la sesion', async () => {
    mockPrisma.cashRegisterSession.findUnique.mockResolvedValue(null);

    const summary = await CashRegisterService.calculateSummary('session-1');
    expect(summary).toBeNull();
  });

  it('calculateSummary agrega pagos, efectivo USD/ARS y movimientos', async () => {
    mockPrisma.cashRegisterSession.findUnique.mockResolvedValue({
      id: 'session-1',
      openingAmount: n(100),
      openingAmountUSD: n(5),
      closingAmount: n(300),
      closingAmountUSD: n(6),
      difference: n(10),
      differenceUSD: n(1),
      sales: [
        {
          payments: [
            { method: 'CASH_ARS', amount: n(120) },
            { method: 'CASH_USD', amount: n(2400), amountUSD: n(2) },
            { method: 'TRANSFER', amount: n(80) },
          ],
        },
      ],
      movements: [
        { id: 'm1', type: 'INCOME', amount: n(20), reason: 'ajuste', createdAt: new Date() },
        { id: 'm2', type: 'EXPENSE', amount: n(10), reason: 'gasto', createdAt: new Date() },
      ],
      openingExchangeRate: { rate: n(1200), dollarType: 'blue', source: 'manual' },
      closingExchangeRate: { rate: n(1210), dollarType: 'blue', source: 'api' },
    });

    const summary = await CashRegisterService.calculateSummary('session-1');

    expect(summary?.expectedAmount).toBe(230);
    expect(summary?.expectedAmountUSD).toBe(7);
    expect(summary?.paymentsByMethod.CASH_ARS).toBe(120);
    expect(summary?.paymentsByMethod.CASH_USD).toBe(2400);
    expect(summary?.paymentsByMethod.TRANSFER).toBe(80);
    expect(summary?.totalSales).toBe(1);
    expect(summary?.totalMovements).toBe(2);
    expect(summary?.openingExchangeRate?.rate).toBe(1200);
    expect(summary?.closingExchangeRate?.rate).toBe(1210);
  });

  it('saveOpeningExchangeRate guarda snapshot y retorna id', async () => {
    mockGetRate.mockResolvedValue({
      rate: 1200,
      buyRate: 1190,
      sellRate: 1200,
      dollarType: 'blue',
      source: 'manual',
    });
    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'fx-open' });

    const snapshotId = await CashRegisterService.saveOpeningExchangeRate('biz-1');

    expect(mockPrisma.exchangeRateSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: 'biz-1', rate: 1200 }) })
    );
    expect(mockLogger.info).toHaveBeenCalled();
    expect(snapshotId).toBe('fx-open');
  });

  it('saveOpeningExchangeRate maneja error y retorna null', async () => {
    mockGetRate.mockRejectedValue(new Error('fx failed'));

    const snapshotId = await CashRegisterService.saveOpeningExchangeRate('biz-1');

    expect(snapshotId).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('saveClosingExchangeRate guarda snapshot y maneja errores', async () => {
    mockGetRate.mockResolvedValue({
      rate: 1210,
      buyRate: 1200,
      sellRate: 1210,
      dollarType: 'blue',
      source: 'api',
    });
    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'fx-close' });

    const ok = await CashRegisterService.saveClosingExchangeRate('biz-1');
    expect(ok).toBe('fx-close');

    mockGetRate.mockRejectedValue(new Error('fx close failed'));
    const fail = await CashRegisterService.saveClosingExchangeRate('biz-1');
    expect(fail).toBeNull();
  });
});
