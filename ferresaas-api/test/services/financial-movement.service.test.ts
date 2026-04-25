import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  financialMovement: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  exchangeRateSnapshot: {
    create: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  log: jest.fn() as any,
};

const mockGetById = jest.fn() as any;
const mockValidateFunds = jest.fn() as any;
const mockUpdateBalance = jest.fn() as any;
const mockConvertAmount = jest.fn() as any;
const mockGetRate = jest.fn() as any;

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

const fixedStartOfDay = new Date('2026-02-10T03:00:00.000Z');
const fixedEndOfDay = new Date('2026-02-11T02:59:59.999Z');

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/financial-account.service', () => ({
  FinancialAccountService: class FinancialAccountService {
    getById = mockGetById;
    validateFunds = mockValidateFunds;
    updateBalance = mockUpdateBalance;
    convertAmount = mockConvertAmount;
  },
}));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {
    getRate = mockGetRate;
  },
}));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/utils/timezone', () => ({
  startOfDayInTimezone: jest.fn(() => fixedStartOfDay),
  endOfDayInTimezone: jest.fn(() => fixedEndOfDay),
  DEFAULT_TIMEZONE: 'America/Argentina/Buenos_Aires',
}));

import { FinancialMovementService } from '@/services/financial-movement.service';

describe('FinancialMovementService', () => {
  let service: FinancialMovementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialMovementService();
  });

  it('createMovement INCOME actualiza balance y registra auditoria', async () => {
    mockGetById.mockResolvedValue({ id: 'acc-1' });
    mockUpdateBalance.mockResolvedValue(n(120));
    mockPrisma.financialMovement.create.mockResolvedValue({ id: 'mov-1', type: 'INCOME' });

    const movement = await service.createMovement('biz-1', 'user-1', {
      accountId: 'acc-1',
      type: 'INCOME',
      amount: 20,
      description: 'Ingreso manual',
    });

    expect(mockValidateFunds).not.toHaveBeenCalled();
    expect(mockUpdateBalance).toHaveBeenCalledWith('acc-1', 20, 'add');
    expect(mockPrisma.financialMovement.create).toHaveBeenCalled();
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(movement.id).toBe('mov-1');
  });

  it('createMovement EXPENSE valida fondos antes de descontar', async () => {
    mockGetById.mockResolvedValue({ id: 'acc-1' });
    mockValidateFunds.mockResolvedValue(undefined);
    mockUpdateBalance.mockResolvedValue(n(70));
    mockPrisma.financialMovement.create.mockResolvedValue({ id: 'mov-2', type: 'EXPENSE' });

    await service.createMovement('biz-1', 'user-1', {
      accountId: 'acc-1',
      type: 'EXPENSE',
      amount: 30,
    });

    expect(mockValidateFunds).toHaveBeenCalledWith('acc-1', 30);
    expect(mockUpdateBalance).toHaveBeenCalledWith('acc-1', 30, 'subtract');
  });

  it('createTransfer rechaza transferencia a la misma cuenta', async () => {
    await expect(
      service.createTransfer('biz-1', 'user-1', {
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: 10,
      })
    ).rejects.toThrow('Cannot transfer to the same account');
  });

  it('createTransfer sin conversion crea dos movimientos y audit log', async () => {
    mockGetById
      .mockResolvedValueOnce({ id: 'from', businessId: 'biz-1', currency: 'ARS', name: 'Caja' })
      .mockResolvedValueOnce({ id: 'to', businessId: 'biz-1', currency: 'ARS', name: 'Banco' });
    mockValidateFunds.mockResolvedValue(undefined);
    mockUpdateBalance.mockResolvedValueOnce(n(90)).mockResolvedValueOnce(n(110));

    const tx = {
      financialMovement: {
        create: (jest.fn() as any)
          .mockResolvedValueOnce({ id: 'out-1', transferToAccountId: 'to' })
          .mockResolvedValueOnce({ id: 'in-1', transferToAccountId: 'to' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const out = await service.createTransfer('biz-1', 'user-1', {
      fromAccountId: 'from',
      toAccountId: 'to',
      amount: 10,
      notes: 'mov',
    });

    expect(mockConvertAmount).not.toHaveBeenCalled();
    expect(mockUpdateBalance).toHaveBeenNthCalledWith(1, 'from', 10, 'subtract');
    expect(mockUpdateBalance).toHaveBeenNthCalledWith(2, 'to', 10, 'add');
    expect(tx.financialMovement.create).toHaveBeenCalledTimes(2);
    expect(mockAuditService.log).toHaveBeenCalled();
    expect(out.expenseMovement.id).toBe('out-1');
  });

  it('createTransfer con conversion guarda snapshot y usa monto convertido', async () => {
    mockGetById
      .mockResolvedValueOnce({ id: 'from', businessId: 'biz-1', currency: 'USD', name: 'Usd Box' })
      .mockResolvedValueOnce({ id: 'to', businessId: 'biz-1', currency: 'ARS', name: 'Ars Box' });
    mockValidateFunds.mockResolvedValue(undefined);
    mockConvertAmount.mockResolvedValue({ amount: 1200, rate: 1200, source: 'manual' });
    mockGetRate.mockResolvedValue({ buyRate: 1190, sellRate: 1200, dollarType: 'blue' });
    mockPrisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'fx-1' });
    mockUpdateBalance.mockResolvedValueOnce(n(4)).mockResolvedValueOnce(n(1200));

    const tx = {
      financialMovement: {
        create: (jest.fn() as any)
          .mockResolvedValueOnce({ id: 'out-2', transferToAccountId: 'to' })
          .mockResolvedValueOnce({ id: 'in-2', transferToAccountId: 'to' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.createTransfer('biz-1', 'user-1', {
      fromAccountId: 'from',
      toAccountId: 'to',
      amount: 1,
      description: 'Cambio',
    });

    expect(mockConvertAmount).toHaveBeenCalledWith('biz-1', 1, 'USD', 'ARS');
    expect(mockPrisma.exchangeRateSnapshot.create).toHaveBeenCalled();
    expect(mockUpdateBalance).toHaveBeenNthCalledWith(2, 'to', 1200, 'add');
  });

  it('listByAccount aplica filtros y devuelve meta paginada', async () => {
    mockGetById.mockResolvedValue({ id: 'acc-1' });
    mockPrisma.financialMovement.findMany.mockResolvedValue([{ id: 'mov-1' }]);
    mockPrisma.financialMovement.count.mockResolvedValue(3);

    const result = await service.listByAccount('biz-1', 'acc-1', {
      type: 'INCOME',
      sourceType: 'SALE',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.000Z'),
      page: 1,
      limit: 2,
    });

    expect(mockPrisma.financialMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          accountId: 'acc-1',
          type: 'INCOME',
          sourceType: 'SALE',
          createdAt: expect.any(Object),
        }),
        take: 2,
      })
    );
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasMore).toBe(true);
  });

  it('getSummary calcula ingresos, egresos y transferencias', async () => {
    mockGetById.mockResolvedValue({ id: 'acc-1' });
    mockPrisma.financialMovement.findMany.mockResolvedValue([
      { type: 'INCOME', amount: n(100) },
      { type: 'EXPENSE', amount: n(40) },
      { type: 'TRANSFER', amount: n(15), transferToAccountId: 'acc-1' },
      { type: 'TRANSFER', amount: n(10), transferToAccountId: 'other' },
    ]);

    const summary = await service.getSummary(
      'biz-1',
      'acc-1',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.999Z')
    );

    expect(summary.totalIncome).toBe(100);
    expect(summary.totalExpense).toBe(40);
    expect(summary.totalTransferIn).toBe(15);
    expect(summary.totalTransferOut).toBe(10);
    expect(summary.netChange).toBe(65);
    expect(summary.movementCount).toBe(4);
  });

  it('listByDate usa timezone utility y filtros', async () => {
    mockPrisma.financialMovement.findMany.mockResolvedValue([{ id: 'mov-1' }]);
    mockPrisma.financialMovement.count.mockResolvedValue(1);

    const result = await service.listByDate('biz-1', new Date('2026-02-10T18:00:00.000Z'), {
      type: 'EXPENSE',
      sourceType: 'MANUAL',
      page: 1,
      limit: 10,
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(mockPrisma.financialMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          type: 'EXPENSE',
          sourceType: 'MANUAL',
          createdAt: { gte: fixedStartOfDay, lte: fixedEndOfDay },
        }),
      })
    );
    expect(result.meta.total).toBe(1);
  });

  it('getAccountTypeByPaymentMethod devuelve mapeo y fallback', () => {
    expect(FinancialMovementService.getAccountTypeByPaymentMethod('CASH')).toBe('CASH');
    expect(FinancialMovementService.getAccountTypeByPaymentMethod('CARD')).toBe('BANK');
    expect(FinancialMovementService.getAccountTypeByPaymentMethod('QR')).toBe('WALLET');
    expect(FinancialMovementService.getAccountTypeByPaymentMethod('UNKNOWN_METHOD')).toBe('BANK');
  });
});
