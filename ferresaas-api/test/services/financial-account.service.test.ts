import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  financialAccount: {
    findMany: jest.fn() as any,
    findUnique: jest.fn() as any,
    findFirst: jest.fn() as any,
    updateMany: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
  },
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  logUpdate: jest.fn() as any,
};

const mockConvertUsdToArs = jest.fn() as any;
const mockConvertArsToUsd = jest.fn() as any;
const mockGetRate = jest.fn() as any;

const mockLogger = {
  warn: jest.fn() as any,
  info: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {
    convertUsdToArs = mockConvertUsdToArs;
    convertArsToUsd = mockConvertArsToUsd;
    getRate = mockGetRate;
  },
}));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { FinancialAccountService } from '@/services/financial-account.service';

describe('FinancialAccountService', () => {
  let service: FinancialAccountService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialAccountService();
  });

  it('list aplica filtros y orden', async () => {
    mockPrisma.financialAccount.findMany.mockResolvedValue([{ id: 'acc-1' }]);

    const result = await service.list('biz-1', { type: 'CASH', isActive: true, currency: 'ARS' });

    expect(mockPrisma.financialAccount.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', type: 'CASH', isActive: true, currency: 'ARS' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    expect(result).toHaveLength(1);
  });

  it('getById valida inexistencia y ownership', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById('biz-1', 'acc-1')).rejects.toThrow('Financial account not found');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({ id: 'acc-1', businessId: 'biz-2' });
    await expect(service.getById('biz-1', 'acc-1')).rejects.toThrow('Access denied');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({ id: 'acc-1', businessId: 'biz-1' });
    const account = await service.getById('biz-1', 'acc-1');
    expect(account.id).toBe('acc-1');
  });

  it('getDefaultByType lanza error cuando falta default account', async () => {
    mockPrisma.financialAccount.findFirst.mockResolvedValue(null);

    await expect(service.getDefaultByType('biz-1', 'CASH')).rejects.toThrow('No default CASH account found');
    await expect(service.getDefaultByType('biz-1', 'BANK', 'USD')).rejects.toThrow(
      'No default BANK account in USD found'
    );
  });

  it('create valida moneda y unicidad', async () => {
    await expect(
      service.create('biz-1', 'user-1', { type: 'CASH', name: 'Caja', currency: 'EUR' as any })
    ).rejects.toThrow('Currency must be ARS or USD');

    mockPrisma.financialAccount.findUnique.mockResolvedValue({ id: 'acc-1' });
    await expect(
      service.create('biz-1', 'user-1', { type: 'CASH', name: 'Caja ARS' })
    ).rejects.toThrow('An account with this name already exists');
  });

  it('create desmarca defaults previos y registra auditoria', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValue(null);
    mockPrisma.financialAccount.create.mockResolvedValue({ id: 'acc-1' });

    const account = await service.create('biz-1', 'user-1', {
      type: 'CASH',
      name: 'Caja Principal',
      initialBalance: 100,
      isDefault: true,
      currency: 'ARS',
    });

    expect(mockPrisma.financialAccount.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', type: 'CASH', currency: 'ARS', isDefault: true },
      data: { isDefault: false },
    });
    expect(mockPrisma.financialAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 100, isDefault: true }) })
    );
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(account.id).toBe('acc-1');
  });

  it('update desmarca defaults previos cuando corresponde', async () => {
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'acc-1',
      businessId: 'biz-1',
      type: 'BANK',
      isDefault: false,
    } as any);
    mockPrisma.financialAccount.update.mockResolvedValue({ id: 'acc-1', name: 'Banco 1' });

    const updated = await service.update('biz-1', 'user-1', 'acc-1', { isDefault: true, name: 'Banco 1' });

    expect(getByIdSpy).toHaveBeenCalledWith('biz-1', 'acc-1');
    expect(mockPrisma.financialAccount.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', type: 'BANK', isDefault: true, id: { not: 'acc-1' } },
      data: { isDefault: false },
    });
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(updated.id).toBe('acc-1');
  });

  it('validateFunds valida estado, fondos y conversiones', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce(null);
    await expect(service.validateFunds('acc-1', 10)).rejects.toThrow('Financial account not found');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      businessId: 'biz-1',
      isActive: false,
      currency: 'ARS',
      balance: n(100),
    });
    await expect(service.validateFunds('acc-1', 10)).rejects.toThrow('This account is inactive');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({
      id: 'acc-ars',
      businessId: 'biz-1',
      isActive: true,
      currency: 'ARS',
      balance: n(100),
    });
    mockConvertUsdToArs.mockResolvedValue({ amountArs: 200 });
    await expect(service.validateFunds('acc-ars', 2, 'USD')).rejects.toThrow('Insufficient funds');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({
      id: 'acc-usd',
      businessId: 'biz-1',
      isActive: true,
      currency: 'USD',
      balance: n(100),
    });
    mockConvertArsToUsd.mockResolvedValue({ amountUsd: 50 });

    const account = await service.validateFunds('acc-usd', 50000, 'ARS');
    expect(mockConvertArsToUsd).toHaveBeenCalledWith('biz-1', 50000);
    expect(account.id).toBe('acc-usd');
  });

  it('updateBalance valida inexistencia, saldo negativo y actualiza', async () => {
    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateBalance('acc-1', 10, 'add')).rejects.toThrow('Financial account not found');

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({ id: 'acc-1', balance: n(5) });
    await expect(service.updateBalance('acc-1', 10, 'subtract')).rejects.toThrow(
      'Operation would result in negative balance'
    );

    mockPrisma.financialAccount.findUnique.mockResolvedValueOnce({ id: 'acc-1', balance: n(10) });
    mockPrisma.financialAccount.update.mockResolvedValue({ id: 'acc-1', balance: n(30) });
    const balance = await service.updateBalance('acc-1', 20, 'add');
    expect(balance.toNumber()).toBe(30);
  });

  it('getBalanceSummary convierte USD a ARS y tolera falta de tasa', async () => {
    mockPrisma.financialAccount.findMany.mockResolvedValueOnce([
      { id: 'a1', type: 'CASH', name: 'Caja', currency: 'ARS', balance: n(100) },
      { id: 'a2', type: 'BANK', name: 'USD Bank', currency: 'USD', balance: n(10) },
    ]);
    mockGetRate.mockResolvedValue({ rate: 1200 });

    const summary = await service.getBalanceSummary('biz-1');
    expect(summary.totalBalance).toBe(12100);
    expect(summary.exchangeRate).toBe(1200);

    mockPrisma.financialAccount.findMany.mockResolvedValueOnce([
      { id: 'a3', type: 'BANK', name: 'USD', currency: 'USD', balance: n(2) },
    ]);
    mockGetRate.mockRejectedValue(new Error('no rate'));

    const summaryNoRate = await service.getBalanceSummary('biz-1');
    expect(summaryNoRate.totalBalance).toBe(2);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('convertAmount cubre same currency, conversiones y caso no soportado', async () => {
    const same = await service.convertAmount('biz-1', 50, 'ARS', 'ARS');
    expect(same).toEqual({ amount: 50, rate: 1, source: 'same_currency' });

    mockConvertUsdToArs.mockResolvedValue({ amountArs: 1200, rate: 1200, source: 'manual' });
    const usdToArs = await service.convertAmount('biz-1', 1, 'USD', 'ARS');
    expect(usdToArs.amount).toBe(1200);

    mockConvertArsToUsd.mockResolvedValue({ amountUsd: 2, rate: 1200, source: 'api' });
    const arsToUsd = await service.convertAmount('biz-1', 2400, 'ARS', 'USD');
    expect(arsToUsd.amount).toBe(2);

    await expect(service.convertAmount('biz-1', 1, 'EUR', 'ARS')).rejects.toThrow(
      'Conversion from EUR to ARS is not supported'
    );
  });
});
