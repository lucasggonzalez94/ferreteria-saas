import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  financialAccount: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  checkRegister: {
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  financialMovement: {
    create: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  logUpdate: jest.fn() as any,
};

const mockValidateFunds = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/financial-account.service', () => ({
  FinancialAccountService: class FinancialAccountService {
    validateFunds = mockValidateFunds;
  },
}));

import { CheckService } from '@/services/check.service';

describe('CheckService', () => {
  let service: CheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckService();
  });

  it('issueCheck valida cuenta, tipo, duplicado y monto', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValue(null);
    await expect(
      service.issueCheck('biz-1', 'user-1', {
        accountId: 'acc-1',
        checkNumber: '0001',
        amount: 100,
      })
    ).rejects.toThrow('Financial account not found');

    mockPrisma.financialAccount.findUnique.mockResolvedValue({ id: 'acc-1', businessId: 'biz-2' });
    await expect(
      service.issueCheck('biz-1', 'user-1', {
        accountId: 'acc-1',
        checkNumber: '0001',
        amount: 100,
      })
    ).rejects.toThrow('Access denied');

    mockPrisma.financialAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      businessId: 'biz-1',
      type: 'CASH',
    });
    await expect(
      service.issueCheck('biz-1', 'user-1', {
        accountId: 'acc-1',
        checkNumber: '0001',
        amount: 100,
      })
    ).rejects.toThrow('Only BANK accounts can issue checks');

    mockPrisma.financialAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      businessId: 'biz-1',
      type: 'BANK',
      currency: 'ARS',
    });
    mockPrisma.checkRegister.findUnique.mockResolvedValue({ id: 'check-existing' });
    await expect(
      service.issueCheck('biz-1', 'user-1', {
        accountId: 'acc-1',
        checkNumber: '0001',
        amount: 100,
      })
    ).rejects.toThrow('Check number already exists');

    mockPrisma.checkRegister.findUnique.mockResolvedValue(null);
    await expect(
      service.issueCheck('biz-1', 'user-1', {
        accountId: 'acc-1',
        checkNumber: '0001',
        amount: 0,
      })
    ).rejects.toThrow('Amount must be positive');
  });

  it('issueCheck crea cheque y audita', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      businessId: 'biz-1',
      type: 'BANK',
      currency: 'USD',
    });
    mockPrisma.checkRegister.findUnique.mockResolvedValue(null);
    mockPrisma.checkRegister.create.mockResolvedValue({ id: 'check-1' });

    const result = await service.issueCheck('biz-1', 'user-1', {
      accountId: 'acc-1',
      checkNumber: '0002',
      amount: 250,
    });

    expect(mockPrisma.checkRegister.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          checkNumber: '0002',
          currency: 'USD',
          status: 'ISSUED',
        }),
      })
    );
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(result.id).toBe('check-1');
  });

  it('clearCheck valida estado y procesa transaccion de cobro', async () => {
    mockPrisma.checkRegister.findUnique.mockResolvedValue(null);
    await expect(service.clearCheck('biz-1', 'user-1', 'check-1')).rejects.toThrow('Check not found');

    mockPrisma.checkRegister.findUnique.mockResolvedValue({
      id: 'check-1',
      businessId: 'biz-2',
      status: 'ISSUED',
      accountId: 'acc-1',
      amount: n(10),
      account: { balance: n(100) },
    });
    await expect(service.clearCheck('biz-1', 'user-1', 'check-1')).rejects.toThrow('Access denied');

    mockPrisma.checkRegister.findUnique.mockResolvedValue({
      id: 'check-1',
      businessId: 'biz-1',
      status: 'CLEARED',
      accountId: 'acc-1',
      amount: n(10),
      account: { balance: n(100) },
    });
    await expect(service.clearCheck('biz-1', 'user-1', 'check-1')).rejects.toThrow('Check is already CLEARED');

    const check = {
      id: 'check-1',
      businessId: 'biz-1',
      status: 'ISSUED',
      accountId: 'acc-1',
      checkNumber: '0001',
      amount: n(40),
      account: { balance: n(100) },
    };
    mockPrisma.checkRegister.findUnique.mockResolvedValue(check);
    mockValidateFunds.mockResolvedValue(undefined);
    const tx = {
      checkRegister: { update: (jest.fn() as any).mockResolvedValue({ id: 'check-1', status: 'CLEARED' }) },
      financialAccount: { update: (jest.fn() as any).mockResolvedValue({ id: 'acc-1' }) },
      financialMovement: { create: (jest.fn() as any).mockResolvedValue({ id: 'fm-1' }) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.clearCheck('biz-1', 'user-1', 'check-1');

    expect(mockValidateFunds).toHaveBeenCalledWith('acc-1', 40);
    expect(tx.financialAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: 60 },
    });
    expect(tx.financialMovement.create).toHaveBeenCalled();
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(result.status).toBe('CLEARED');
  });

  it('bounceCheck y cancelCheck actualizan estado y auditan', async () => {
    mockPrisma.checkRegister.findUnique.mockResolvedValue({
      id: 'check-1',
      businessId: 'biz-1',
      status: 'ISSUED',
      notes: 'nota',
    });
    mockPrisma.checkRegister.update.mockResolvedValue({ id: 'check-1', status: 'BOUNCED' });

    const bounced = await service.bounceCheck('biz-1', 'user-1', 'check-1', 'sin fondos');
    expect(mockPrisma.checkRegister.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'BOUNCED' }),
      })
    );
    expect(bounced.status).toBe('BOUNCED');

    mockPrisma.checkRegister.findUnique.mockResolvedValue({
      id: 'check-2',
      businessId: 'biz-1',
      status: 'ISSUED',
      notes: null,
    });
    mockPrisma.checkRegister.update.mockResolvedValue({ id: 'check-2', status: 'CANCELLED' });

    const cancelled = await service.cancelCheck('biz-1', 'user-1', 'check-2', 'error emision');
    expect(cancelled.status).toBe('CANCELLED');
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
  });

  it('list y getById aplican filtros/ownership y metadatos', async () => {
    mockPrisma.checkRegister.findMany.mockResolvedValue([{ id: 'check-1' }, { id: 'check-2' }]);
    mockPrisma.checkRegister.count.mockResolvedValue(2);

    const list = await service.list('biz-1', { accountId: 'acc-1', status: 'ISSUED', page: 1, limit: 10 });
    expect(mockPrisma.checkRegister.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'biz-1', accountId: 'acc-1', status: 'ISSUED' } })
    );
    expect(list.meta.total).toBe(2);

    mockPrisma.checkRegister.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById('biz-1', 'check-x')).rejects.toThrow('Check not found');

    mockPrisma.checkRegister.findUnique.mockResolvedValueOnce({ id: 'check-1', businessId: 'biz-2' });
    await expect(service.getById('biz-1', 'check-1')).rejects.toThrow('Access denied');

    mockPrisma.checkRegister.findUnique.mockResolvedValueOnce({ id: 'check-1', businessId: 'biz-1' });
    const check = await service.getById('biz-1', 'check-1');
    expect(check.id).toBe('check-1');
  });

  it('getSummaryByAccount agrupa y suma por cuenta', async () => {
    mockPrisma.checkRegister.findMany.mockResolvedValue([
      { accountId: 'acc-1', amount: 100, currency: 'ARS', account: { name: 'Banco 1' } },
      { accountId: 'acc-1', amount: 50, currency: 'ARS', account: { name: 'Banco 1' } },
      { accountId: 'acc-2', amount: 30, currency: 'USD', account: { name: 'Banco 2' } },
    ]);

    const summary = await service.getSummaryByAccount('biz-1');
    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: 'acc-1', totalPending: 150, count: 2 }),
        expect.objectContaining({ accountId: 'acc-2', totalPending: 30, count: 1 }),
      ])
    );
  });
});
