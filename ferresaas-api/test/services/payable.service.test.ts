import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  purchase: {
    findUnique: jest.fn() as any,
  },
  supplierPayable: {
    create: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockAuditService = {
  logCreate: jest.fn() as any,
};

const mockGetDefaultByType = jest.fn() as any;
const mockValidateFunds = jest.fn() as any;
const mockGetAccountTypeByPaymentMethod = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
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

import { PayableService } from '@/services/payable.service';

describe('PayableService', () => {
  let service: PayableService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayableService();
  });

  it('createFromPurchase valida inexistencia y ownership', async () => {
    mockPrisma.purchase.findUnique.mockResolvedValueOnce(null);
    await expect(service.createFromPurchase('biz-1', 'user-1', 'pur-1')).rejects.toThrow('Purchase not found');

    mockPrisma.purchase.findUnique.mockResolvedValueOnce({
      id: 'pur-1',
      businessId: 'biz-2',
      supplierId: 'sup-1',
      total: 100,
    });
    await expect(service.createFromPurchase('biz-1', 'user-1', 'pur-1')).rejects.toThrow('Access denied');
  });

  it('createFromPurchase crea payable y registra auditoria', async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: 'pur-1',
      businessId: 'biz-1',
      supplierId: 'sup-1',
      total: 250,
    });
    mockPrisma.supplierPayable.create.mockResolvedValue({ id: 'pay-1' });

    const dueDate = new Date('2026-05-10T00:00:00.000Z');
    const payable = await service.createFromPurchase('biz-1', 'user-1', 'pur-1', dueDate);

    expect(mockPrisma.supplierPayable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          supplierId: 'sup-1',
          purchaseId: 'pur-1',
          dueDate,
          status: 'PENDING',
        }),
      })
    );
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(payable.id).toBe('pay-1');
  });

  it('list aplica filtros, estado CSV y metadatos', async () => {
    mockPrisma.supplierPayable.findMany.mockResolvedValue([{ id: 'pay-1' }]);
    mockPrisma.supplierPayable.count.mockResolvedValue(3);

    const result = await service.list('biz-1', {
      supplierId: 'sup-1',
      status: 'PENDING,PARTIAL',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      dueDateFrom: new Date('2026-02-01T00:00:00.000Z'),
      dueDateTo: new Date('2026-03-01T00:00:00.000Z'),
      search: 'ferreteria',
      minAmount: 100,
      maxAmount: 500,
      page: 1,
      limit: 2,
    });

    expect(mockPrisma.supplierPayable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          supplierId: 'sup-1',
          status: { in: ['PENDING', 'PARTIAL'] },
          createdAt: expect.any(Object),
          dueDate: expect.any(Object),
          amount: { gte: 100, lte: 500 },
          supplier: { name: { contains: 'ferreteria', mode: 'insensitive' } },
        }),
        take: 2,
      })
    );
    expect(result.meta.total).toBe(3);
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasMore).toBe(true);
  });

  it('recordPayment valida payable, ownership, monto y sobrepago', async () => {
    mockPrisma.supplierPayable.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 10, 'CASH')
    ).rejects.toThrow('Payable not found');

    mockPrisma.supplierPayable.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      businessId: 'biz-2',
      paidAmount: 0,
      amount: 100,
    });
    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 10, 'CASH')
    ).rejects.toThrow('Access denied');

    mockPrisma.supplierPayable.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      businessId: 'biz-1',
      paidAmount: 0,
      amount: 100,
    });
    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 0, 'CASH')
    ).rejects.toThrow('Amount must be positive');

    mockPrisma.supplierPayable.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      businessId: 'biz-1',
      paidAmount: 90,
      amount: 100,
    });
    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 20, 'CASH')
    ).rejects.toThrow('Payment exceeds payable amount');
  });

  it('recordPayment CHECK exige checkNumber y checkAccountId', async () => {
    mockPrisma.supplierPayable.findUnique.mockResolvedValue({
      id: 'pay-1',
      businessId: 'biz-1',
      supplierId: 'sup-1',
      paidAmount: 0,
      amount: 100,
      currency: 'ARS',
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
    });

    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 10, 'CHECK')
    ).rejects.toThrow('Check number is required for check payments');

    await expect(
      service.recordPayment('biz-1', 'user-1', 'pay-1', 10, 'CHECK', undefined, undefined, '0001')
    ).rejects.toThrow('Bank account is required for check payments');
  });

  it('recordPayment no CHECK valida fondos y registra movimiento financiero', async () => {
    mockPrisma.supplierPayable.findUnique.mockResolvedValue({
      id: 'pay-1',
      businessId: 'biz-1',
      supplierId: 'sup-1',
      paidAmount: 0,
      amount: 100,
      currency: 'ARS',
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
    });

    mockGetAccountTypeByPaymentMethod.mockReturnValue('CASH');
    mockGetDefaultByType.mockResolvedValue({ id: 'acc-default' });
    mockValidateFunds.mockResolvedValue(undefined);

    const tx = {
      supplierPayment: { create: (jest.fn() as any).mockResolvedValue({ id: 'sp-1' }) },
      supplierPayable: { update: (jest.fn() as any).mockResolvedValue({ id: 'pay-1' }) },
      supplier: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'sup-1', currentBalance: 1000 }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'sup-1' }),
      },
      checkRegister: { create: jest.fn() as any },
      financialAccount: {
        findFirst: (jest.fn() as any).mockResolvedValue({ id: 'acc-default', balance: n(500) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'acc-default' }),
      },
      financialMovement: { create: (jest.fn() as any).mockResolvedValue({ id: 'fm-1' }) },
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const payment = await service.recordPayment('biz-1', 'user-1', 'pay-1', 100, 'CASH', 'ref-1', 'nota');

    expect(mockGetDefaultByType).toHaveBeenCalledWith('biz-1', 'CASH');
    expect(mockValidateFunds).toHaveBeenCalledWith('acc-default', 100);
    expect(tx.supplierPayable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
    );
    expect(tx.financialMovement.create).toHaveBeenCalled();
    expect(tx.checkRegister.create).not.toHaveBeenCalled();
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(payment.id).toBe('sp-1');
  });

  it('recordPayment CHECK crea checkRegister y deja status PARTIAL', async () => {
    mockPrisma.supplierPayable.findUnique.mockResolvedValue({
      id: 'pay-2',
      businessId: 'biz-1',
      supplierId: 'sup-2',
      paidAmount: 20,
      amount: 100,
      currency: 'USD',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
    });

    const tx = {
      supplierPayment: { create: (jest.fn() as any).mockResolvedValue({ id: 'sp-2' }) },
      supplierPayable: { update: (jest.fn() as any).mockResolvedValue({ id: 'pay-2' }) },
      supplier: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'sup-2', name: 'Proveedor 2', currentBalance: 200 }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'sup-2' }),
      },
      checkRegister: { create: (jest.fn() as any).mockResolvedValue({ id: 'chk-1' }) },
      financialAccount: { findFirst: jest.fn() as any, update: jest.fn() as any },
      financialMovement: { create: jest.fn() as any },
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const payment = await service.recordPayment(
      'biz-1',
      'user-1',
      'pay-2',
      50,
      'CHECK',
      undefined,
      'pago parcial',
      '000123',
      'bank-acc-1'
    );

    expect(tx.supplierPayable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIAL' }) })
    );
    expect(tx.checkRegister.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ checkNumber: '000123', accountId: 'bank-acc-1' }) })
    );
    expect(tx.financialMovement.create).not.toHaveBeenCalled();
    expect(payment.id).toBe('sp-2');
  });

  it('getSummary calcula totales, vencidos y conteo por estado', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    mockPrisma.supplierPayable.findMany.mockResolvedValue([
      { amount: 100, paidAmount: 20, status: 'PARTIAL', dueDate: yesterday },
      { amount: 200, paidAmount: 0, status: 'PENDING', dueDate: tomorrow },
      { amount: 300, paidAmount: 300, status: 'PAID', dueDate: yesterday },
    ]);

    const summary = await service.getSummary('biz-1');

    expect(summary.totalPayable).toBe(600);
    expect(summary.totalPaid).toBe(320);
    expect(summary.totalPending).toBe(280);
    expect(summary.overdue).toBe(1);
    expect(summary.byStatus).toEqual({ pending: 1, partial: 1, paid: 1 });
  });
});
