import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  invoiceJob: {
    updateMany: jest.fn() as any,
    upsert: jest.fn() as any,
    update: jest.fn() as any,
    findMany: jest.fn() as any,
    findFirst: jest.fn() as any,
    findUnique: jest.fn() as any,
    count: jest.fn() as any,
  },
  sale: {
    update: jest.fn() as any,
  },
  invoice: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
    groupBy: jest.fn() as any,
  },
};

const mockLogger = {
  warn: jest.fn() as any,
  info: jest.fn() as any,
};

const mockEnv = {
  cloudinary: {
    cloudName: 'test-cloud',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  },
  invoice: {
    jobs: {
      backoffSeconds: 60,
      maxAttempts: 5,
    },
  },
};

const mockResolveInvoiceProvider = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/config/env', () => ({ env: mockEnv }));

jest.mock('@/services/inventory.service', () => ({
  InventoryService: class InventoryService {},
}));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {},
}));
jest.mock('@/services/financial-account.service', () => ({
  FinancialAccountService: class FinancialAccountService {},
}));
jest.mock('@/services/financial-movement.service', () => ({
  FinancialMovementService: class FinancialMovementService {},
}));
jest.mock('@/services/invoice-pdf.service', () => ({
  InvoicePdfService: class InvoicePdfService {},
}));
jest.mock('@/providers/invoice/provider-resolver', () => ({
  resolveInvoiceProvider: mockResolveInvoiceProvider,
}));

import { SaleService } from '@/services/sale.service';

describe('SaleService helpers and retry flow', () => {
  let service: SaleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaleService();
    mockEnv.invoice.jobs.backoffSeconds = 60;
    mockEnv.invoice.jobs.maxAttempts = 5;
  });

  it('uses minimum backoff and max attempts guards', () => {
    mockEnv.invoice.jobs.backoffSeconds = 10;
    mockEnv.invoice.jobs.maxAttempts = 0;

    expect((service as any).getInvoiceJobBackoffSeconds()).toBe(30);
    expect((service as any).getInvoiceJobMaxAttempts()).toBe(1);
  });

  it('computes exponential next retry date', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    mockEnv.invoice.jobs.backoffSeconds = 60;

    const retryAt = (service as any).nextRetryAt(3) as Date;

    expect(retryAt.getTime()).toBe(1_700_000_000_000 + 240_000);
  });

  it('builds proportional default refund payout and keeps totals', () => {
    const result = (service as any).buildDefaultRefundPayout(
      [
        { method: 'CASH_ARS', amount: 80 },
        { method: 'CARD', amount: 20 },
      ],
      50
    ) as Array<{ method: string; amount: number }>;

    expect(result).toEqual([
      { method: 'CASH_ARS', amount: 40 },
      { method: 'CARD', amount: 10 },
    ]);
  });

  it('returns empty payout when there are no positive payments', () => {
    const result = (service as any).buildDefaultRefundPayout(
      [
        { method: 'CASH_ARS', amount: 0 },
        { method: 'CARD', amount: -1 },
      ],
      100
    );

    expect(result).toEqual([]);
  });

  it('detects fiscal errors by category and by message', () => {
    expect((service as any).isFiscalError({ errorCategory: 'fiscal' })).toBe(true);
    expect((service as any).isFiscalError({ error: 'Invalid taxpayer data' })).toBe(true);
    expect((service as any).isFiscalError({ error: 'timeout from provider' })).toBe(false);
  });

  it('marks invoice job as retrying for technical non-exhausted failures', async () => {
    await (service as any).markInvoiceJobAsFailed(
      { id: 'job-1', saleId: 'sale-1', attempts: 0, maxAttempts: 3 },
      'timeout',
      false
    );

    expect(mockPrisma.invoiceJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RETRYING',
          attempts: 1,
        }),
      })
    );
    expect(mockPrisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoiceStatus: 'PENDING_INVOICE' } })
    );
  });

  it('marks invoice job as failed for fiscal or exhausted failures', async () => {
    await (service as any).markInvoiceJobAsFailed(
      { id: 'job-2', saleId: 'sale-2', attempts: 2, maxAttempts: 3 },
      'validation error',
      true
    );

    expect(mockPrisma.invoiceJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          attempts: 3,
        }),
      })
    );
    expect(mockPrisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoiceStatus: 'FAILED' } })
    );
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('processPendingInvoiceJobs counts only processed jobs', async () => {
    mockPrisma.invoiceJob.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const processSpy = jest
      .spyOn(service as any, 'processInvoiceJob')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await service.processPendingInvoiceJobs(3);

    expect(processSpy).toHaveBeenCalledTimes(3);
    expect(result).toBe(2);
  });

  it('retryInvoiceJob throws when job is missing', async () => {
    mockPrisma.invoiceJob.findFirst.mockResolvedValue(null);

    await expect(service.retryInvoiceJob('biz-1', 'job-missing')).rejects.toThrow(
      'Invoice job not found'
    );
  });

  it('retryInvoiceJob throws when job is processing', async () => {
    mockPrisma.invoiceJob.findFirst.mockResolvedValue({
      id: 'job-1',
      businessId: 'biz-1',
      status: 'PROCESSING',
    });

    await expect(service.retryInvoiceJob('biz-1', 'job-1')).rejects.toThrow(
      'Invoice job is currently processing'
    );
  });

  it('retryInvoiceJob resets job, sale status and returns updated job', async () => {
    mockPrisma.invoiceJob.findFirst.mockResolvedValue({
      id: 'job-1',
      saleId: 'sale-1',
      businessId: 'biz-1',
      status: 'FAILED',
    });
    const processSpy = jest.spyOn(service, 'processPendingInvoiceJobs').mockResolvedValue(1);
    mockPrisma.invoiceJob.findUnique.mockResolvedValue({ id: 'job-1', status: 'PENDING' });

    const result = await service.retryInvoiceJob('biz-1', 'job-1');

    expect(mockPrisma.invoiceJob.update).toHaveBeenCalled();
    expect(mockPrisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sale-1' },
        data: { invoiceStatus: 'PENDING_INVOICE' },
      })
    );
    expect(processSpy).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 'job-1', status: 'PENDING' });
  });

  it('lists invoice jobs with status/date filters and pagination', async () => {
    mockPrisma.invoiceJob.findMany.mockResolvedValue([{ id: 'job-1', status: 'PENDING' }]);
    mockPrisma.invoiceJob.count.mockResolvedValue(1);

    const result = await service.listInvoiceJobs('biz-1', {
      status: 'PENDING',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      page: 2,
      limit: 10,
    });

    expect(mockPrisma.invoiceJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          status: 'PENDING',
          createdAt: expect.any(Object),
        }),
        skip: 10,
        take: 10,
      })
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1 });
  });

  it('lists invoices with customer/date filters and pagination', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
    mockPrisma.invoice.count.mockResolvedValue(1);

    const result = await service.listInvoices('biz-1', {
      customerId: 'cust-1',
      voucherType: 'A',
      status: 'ISSUED',
      page: 1,
      limit: 5,
    });

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          voucherType: 'A',
          status: 'ISSUED',
          sale: { customerId: 'cust-1' },
        }),
        take: 5,
      })
    );
    expect(result.meta).toEqual(expect.objectContaining({ total: 1, totalPages: 1 }));
  });

  it('getInvoiceById returns invoice and rejects cross-tenant access', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValueOnce({ id: 'inv-1', businessId: 'biz-1' });

    const ok = await service.getInvoiceById('biz-1', 'inv-1');
    expect(ok).toEqual({ id: 'inv-1', businessId: 'biz-1' });

    mockPrisma.invoice.findUnique.mockResolvedValueOnce({ id: 'inv-2', businessId: 'other-biz' });
    await expect(service.getInvoiceById('biz-1', 'inv-2')).rejects.toThrow('Invoice not found');
  });

  it('getInvoiceJobStats aggregates counts and provider groups', async () => {
    mockPrisma.invoiceJob.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);
    mockPrisma.invoice.groupBy.mockResolvedValue([
      { provider: 'arca_direct', _count: { provider: 7 } },
    ]);

    const stats = await service.getInvoiceJobStats('biz-1');

    expect(stats.jobs).toEqual({
      pending: 1,
      processing: 2,
      retrying: 3,
      failed: 4,
      completed: 5,
      readyToProcess: 6,
    });
    expect(stats.providersLast24h).toEqual([{ provider: 'arca_direct', issued: 7 }]);
  });

  it('createVoucherWithFallback keeps primary result for fiscal errors', async () => {
    const createVoucherPrimary = jest.fn() as any;
    createVoucherPrimary.mockResolvedValue({
      success: false,
      errorCategory: 'fiscal',
      error: 'validation error',
    });

    mockResolveInvoiceProvider.mockResolvedValueOnce({
      providerKey: 'arca_direct',
      provider: {
        createVoucher: createVoucherPrimary,
      },
    });

    const out = await (service as any).createVoucherWithFallback('biz-1', 'facturante', {
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'A',
      pointOfSale: 1,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    });

    expect(mockResolveInvoiceProvider).toHaveBeenCalledTimes(1);
    expect(out.providerKey).toBe('arca_direct');
    expect(out.result.success).toBe(false);
  });

  it('createVoucherWithFallback retries with facturante on technical primary error', async () => {
    const createVoucherPrimary = jest.fn() as any;
    createVoucherPrimary.mockResolvedValue({
      success: false,
      errorCategory: 'technical',
      error: 'timeout',
    });
    const createVoucherFallback = jest.fn() as any;
    createVoucherFallback.mockResolvedValue({ success: true, cae: '123' });

    mockResolveInvoiceProvider
      .mockResolvedValueOnce({
        providerKey: 'arca_direct',
        provider: {
          createVoucher: createVoucherPrimary,
        },
      })
      .mockResolvedValueOnce({
        providerKey: 'facturante',
        provider: {
          createVoucher: createVoucherFallback,
        },
      });

    const out = await (service as any).createVoucherWithFallback('biz-1', null, {
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'A',
      pointOfSale: 1,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    });

    expect(mockResolveInvoiceProvider).toHaveBeenCalledTimes(2);
    expect(out.providerKey).toBe('facturante');
    expect(out.result.success).toBe(true);
  });

  it('processInvoiceJob handles lock miss and successful completion path', async () => {
    mockPrisma.invoiceJob.updateMany.mockResolvedValueOnce({ count: 0 });
    const skip = await (service as any).processInvoiceJob('job-0');
    expect(skip).toBe(false);

    mockPrisma.invoiceJob.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.invoiceJob.findUnique.mockResolvedValueOnce({
      id: 'job-1',
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'A',
      attempts: 0,
      maxAttempts: 3,
    });
    jest.spyOn(service as any, 'createInvoice').mockResolvedValue({ success: true });

    const ok = await (service as any).processInvoiceJob('job-1');

    expect(ok).toBe(true);
    expect(mockPrisma.invoiceJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
    expect(mockPrisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoiceStatus: 'INVOICED' } })
    );
  });

  it('processInvoiceJob routes unsuccessful provider result to failure handler', async () => {
    mockPrisma.invoiceJob.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoiceJob.findUnique.mockResolvedValue({
      id: 'job-x',
      businessId: 'biz-1',
      saleId: 'sale-1',
      voucherType: 'A',
      attempts: 1,
      maxAttempts: 3,
    });
    jest.spyOn(service as any, 'createInvoice').mockResolvedValue({
      success: false,
      error: 'provider failed',
      errorCategory: 'technical',
    });
    const markSpy = jest.spyOn(service as any, 'markInvoiceJobAsFailed').mockResolvedValue(undefined);

    const out = await (service as any).processInvoiceJob('job-x');

    expect(out).toBe(true);
    expect(markSpy).toHaveBeenCalled();
  });
});
