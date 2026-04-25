import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const n = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  customer: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
  },
  product: {
    findUnique: jest.fn() as any,
  },
  cashRegisterSession: {
    findFirst: jest.fn() as any,
  },
  sale: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  invoice: {
    upsert: jest.fn() as any,
    update: jest.fn() as any,
  },
  business: {
    findUnique: jest.fn() as any,
  },
  saleRefundItem: {
    findMany: jest.fn() as any,
  },
  saleRefund: {
    aggregate: jest.fn() as any,
  },
  $transaction: jest.fn() as any,
};

const mockLogger = {
  warn: jest.fn() as any,
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

const mockAuditService = {
  log: jest.fn() as any,
  logCreate: jest.fn() as any,
};

const mockInventoryCreateMovement = jest.fn() as any;
const mockGetRate = jest.fn() as any;
const mockGetAccountTypeByPaymentMethod = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/inventory.service', () => ({
  InventoryService: class InventoryService {
    createMovement = mockInventoryCreateMovement;
  },
}));
jest.mock('@/services/exchange-rate.service', () => ({
  ExchangeRateService: class ExchangeRateService {
    getRate = mockGetRate;
  },
}));
jest.mock('@/services/financial-account.service', () => ({
  FinancialAccountService: class FinancialAccountService {},
}));
jest.mock('@/services/financial-movement.service', () => ({
  FinancialMovementService: class FinancialMovementService {
    static getAccountTypeByPaymentMethod = mockGetAccountTypeByPaymentMethod;
  },
}));
jest.mock('@/services/invoice-pdf.service', () => ({
  InvoicePdfService: class InvoicePdfService {},
}));
jest.mock('@/services/cloudinary.service', () => ({
  CloudinaryService: {
    uploadPdfBuffer: jest.fn() as any,
  },
}));
jest.mock('@/providers/invoice/provider-resolver', () => ({
  resolveInvoiceProvider: jest.fn() as any,
}));

import { SaleService } from '@/services/sale.service';
import { CloudinaryService } from '@/services/cloudinary.service';

describe('SaleService create/confirm/refund', () => {
  let service: SaleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaleService();
  });

  it('create valida cliente y producto antes de crear borrador', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.create('biz-1', 'user-1', {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 21 }],
      })
    ).rejects.toThrow('Customer not found');

    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', businessId: 'biz-1' });
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      businessId: 'biz-1',
      isActive: false,
      name: 'Martillo',
    });

    await expect(
      service.create('biz-1', 'user-1', {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 21 }],
      })
    ).rejects.toThrow('Product Martillo is inactive');
  });

  it('create persiste venta draft y devuelve getById', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      businessId: 'biz-1',
      isActive: true,
      name: 'Martillo',
    });

    const tx = {
      sale: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'sale-1' }),
      },
      saleItem: {
        createMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'sale-1' } as any);

    const result = await service.create('biz-1', 'user-1', {
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 100, taxRate: 21 }],
      notes: 'venta prueba',
    });

    expect(tx.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) })
    );
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith('biz-1', 'sale-1');
    expect(result).toEqual({ id: 'sale-1' });
  });

  it('create rechaza cliente/producto de otro negocio y producto inexistente', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', businessId: 'other-biz' });

    await expect(
      service.create('biz-1', 'user-1', {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 21 }],
      })
    ).rejects.toThrow('Access denied');

    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', businessId: 'biz-1' });
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.create('biz-1', 'user-1', {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 21 }],
      })
    ).rejects.toThrow('Product prod-1 not found');

    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      businessId: 'other-biz',
      isActive: true,
    });
    await expect(
      service.create('biz-1', 'user-1', {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 21 }],
      })
    ).rejects.toThrow('Access denied');
  });

  it('confirm rechaza pagos insuficientes', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      status: 'DRAFT',
      total: n(100),
      items: [],
    } as any);

    await expect(
      service.confirm('biz-1', 'user-1', 'sale-1', {
        payments: [{ method: 'CASH_ARS', amount: 50 }],
      })
    ).rejects.toThrow('Payment total (50) is less than sale total (100)');
  });

  it('confirm actualiza venta, pagos, cuentas e inventario', async () => {
    const sale = {
      id: 'sale-1',
      status: 'DRAFT',
      total: n(100),
      items: [{ productId: 'prod-1', quantity: n(2) }],
      customerId: null,
    };
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce(sale as any)
      .mockResolvedValueOnce({ id: 'sale-1', status: 'CONFIRMED' } as any);
    mockPrisma.cashRegisterSession.findFirst.mockResolvedValue(null);
    mockGetAccountTypeByPaymentMethod.mockReturnValue('CASH');

    const tx = {
      sale: {
        update: (jest.fn() as any).mockResolvedValue({ id: 'sale-1' }),
      },
      payment: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'pay-1' }),
      },
      financialAccount: {
        findFirst: (jest.fn() as any).mockResolvedValue({ id: 'acc-1', balance: n(1000) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'acc-1' }),
      },
      financialMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'fm-1' }),
      },
      customer: {
        findUnique: (jest.fn() as any).mockResolvedValue(null),
      },
      accountMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'am-1' }),
      },
      cashMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'cm-1' }),
      },
      exchangeRateSnapshot: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'fx-1' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.confirm('biz-1', 'user-1', 'sale-1', {
      payments: [{ method: 'CASH_ARS', amount: 100 }],
    });

    expect(tx.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) })
    );
    expect(tx.payment.create).toHaveBeenCalled();
    expect(mockInventoryCreateMovement).toHaveBeenCalledWith(
      'biz-1',
      'user-1',
      expect.objectContaining({ type: 'SALE', quantity: -2 })
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALE_CONFIRM', entityId: 'sale-1' })
    );
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'sale-1', status: 'CONFIRMED' });
  });

  it('confirm cubre USD, cuenta corriente, ajuste de vuelto y warning de facturacion', async () => {
    const sale = {
      id: 'sale-2',
      status: 'DRAFT',
      total: n(200),
      items: [{ productId: 'prod-1', quantity: n(1) }],
      customerId: 'cust-1',
    };
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce(sale as any)
      .mockResolvedValueOnce({ id: 'sale-2', status: 'CONFIRMED' } as any);
    const enqueueSpy = jest.spyOn(service as any, 'enqueueInvoiceJob').mockResolvedValue({ id: 'job-2' });
    const processSpy = jest
      .spyOn(service, 'processPendingInvoiceJobs')
      .mockRejectedValue(new Error('provider down'));

    mockPrisma.cashRegisterSession.findFirst.mockResolvedValue({ id: 'cr-1', status: 'OPEN' });
    mockGetAccountTypeByPaymentMethod.mockReturnValue('BANK');
    mockGetRate.mockResolvedValue({ rate: 1000, source: 'dolarapi' });

    const tx = {
      sale: {
        update: (jest.fn() as any).mockResolvedValue({ id: 'sale-2' }),
      },
      payment: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'pay-2' }),
      },
      financialAccount: {
        findFirst: (jest.fn() as any).mockResolvedValue({ id: 'acc-bank', balance: n(1000) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'acc-bank' }),
      },
      financialMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'fm-2' }),
      },
      customer: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cust-1', currentBalance: n(300) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'cust-1' }),
      },
      accountMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'am-2' }),
      },
      cashMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'cm-2' }),
      },
      exchangeRateSnapshot: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'fx-2' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.confirm('biz-1', 'user-1', 'sale-2', {
      payments: [
        { method: 'CASH_USD', amount: 200, amountUSD: 1 },
        { method: 'ACCOUNT', amount: 20 },
      ],
      changeGiven: 25,
      invoiceType: 'A',
    });

    expect(tx.exchangeRateSnapshot.create).toHaveBeenCalled();
    expect(tx.accountMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { currentBalance: 420 },
    });
    expect(tx.cashMovement.create).toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith('biz-1', 'sale-2', 'A');
    expect(processSpy).toHaveBeenCalledWith(1);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'sale-2', status: 'CONFIRMED' });
  });

  it('refund valida venta confirmada y distribucion de pagos', async () => {
    mockPrisma.sale.findUnique.mockResolvedValue(null);
    await expect(
      service.refund('biz-1', 'user-1', 'sale-1', {
        items: [],
        refundPayments: [],
        reason: 'x',
      })
    ).rejects.toThrow('Sale not found');

    mockPrisma.sale.findUnique.mockResolvedValue({ id: 'sale-1', businessId: 'biz-1', status: 'DRAFT' });
    await expect(
      service.refund('biz-1', 'user-1', 'sale-1', {
        items: [],
        refundPayments: [],
        reason: 'x',
      })
    ).rejects.toThrow('Only confirmed sales can be refunded');

    mockPrisma.sale.findUnique.mockResolvedValue({
      id: 'sale-1',
      businessId: 'biz-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      customerId: null,
      customer: null,
      cashRegisterId: null,
      cashRegister: null,
      payments: [{ method: 'CASH_ARS', amount: n(100) }],
      total: n(100),
      items: [
        {
          id: 'si-1',
          productId: 'prod-1',
          quantity: n(1),
          unitPrice: n(100),
          subtotal: n(100),
          product: { id: 'prod-1', name: 'Martillo', unit: 'u' },
        },
      ],
    });
    mockPrisma.saleRefundItem.findMany.mockResolvedValue([]);

    await expect(
      service.refund('biz-1', 'user-1', 'sale-1', {
        items: [{ saleItemId: 'si-1', quantity: 1 }],
        refundPayments: [{ method: 'CASH_ARS', amount: 90 }],
        reason: 'defecto',
      })
    ).rejects.toThrow('Refund payment distribution does not match total');
  });

  it('refund procesa devolucion, stock y movimientos financieros', async () => {
    mockPrisma.sale.findUnique.mockResolvedValue({
      id: 'sale-1',
      businessId: 'biz-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      customerId: null,
      customer: null,
      cashRegisterId: null,
      cashRegister: null,
      payments: [{ method: 'CASH_ARS', amount: n(100) }],
      total: n(100),
      items: [
        {
          id: 'si-1',
          productId: 'prod-1',
          quantity: n(1),
          unitPrice: n(100),
          subtotal: n(100),
          product: { id: 'prod-1', name: 'Martillo', unit: 'u' },
        },
      ],
    });
    mockPrisma.saleRefundItem.findMany.mockResolvedValue([]);
    mockPrisma.saleRefund.aggregate.mockResolvedValue({ _sum: { total: n(0) } });
    mockGetAccountTypeByPaymentMethod.mockReturnValue('CASH');

    const tx = {
      saleRefund: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'refund-1' }),
      },
      saleRefundItem: {
        createMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
      },
      saleRefundPayment: {
        createMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'im-1' }),
      },
      product: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'prod-1', stockQuantity: n(5) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'prod-1' }),
      },
      financialAccount: {
        findFirst: (jest.fn() as any).mockResolvedValue({ id: 'acc-1', balance: n(500) }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'acc-1' }),
      },
      financialMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'fm-1' }),
      },
      cashMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'cm-1' }),
      },
      customer: {
        findUnique: (jest.fn() as any).mockResolvedValue(null),
        update: (jest.fn() as any).mockResolvedValue({ id: 'cust-1' }),
      },
      accountMovement: {
        create: (jest.fn() as any).mockResolvedValue({ id: 'am-1' }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'sale-1' } as any);

    const result = await service.refund('biz-1', 'user-1', 'sale-1', {
      items: [{ saleItemId: 'si-1', quantity: 1 }],
      refundPayments: [{ method: 'CASH_ARS', amount: 100 }],
      reason: 'defecto',
    });

    expect(tx.saleRefund.create).toHaveBeenCalled();
    expect(tx.inventoryMovement.create).toHaveBeenCalled();
    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockQuantity: 6 } })
    );
    expect(tx.financialMovement.create).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALE_REFUND', entityId: 'sale-1' })
    );
    expect(getByIdSpy).toHaveBeenCalledWith('biz-1', 'sale-1');
    expect(result).toEqual({ id: 'sale-1' });
  });

  it('createAdjustmentNote valida venta confirmada y factura base', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      status: 'DRAFT',
      invoices: [],
    } as any);

    await expect(
      service.createAdjustmentNote('biz-1', 'user-1', 'sale-1', {
        kind: 'CREDIT',
        letter: 'A',
        reason: 'ajuste',
      })
    ).rejects.toThrow('Sale must be confirmed before issuing notes');

    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      status: 'CONFIRMED',
      invoices: [],
    } as any);

    await expect(
      service.createAdjustmentNote('biz-1', 'user-1', 'sale-1', {
        kind: 'DEBIT',
        letter: 'A',
        reason: 'ajuste',
      })
    ).rejects.toThrow('Cannot issue ND_A without an issued A invoice for this sale');
  });

  it('createAdjustmentNote encola job, intenta proceso inmediato y audita', async () => {
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce({
        id: 'sale-1',
        status: 'CONFIRMED',
        invoices: [
          {
            id: 'inv-a',
            provider: 'mock',
            voucherType: 'A',
            status: 'ISSUED',
            number: 123,
            pointOfSale: 1,
          },
        ],
      } as any)
      .mockResolvedValueOnce({ id: 'sale-1' } as any);
    mockPrisma.invoice.upsert.mockResolvedValue({ id: 'inv-note' });
    const enqueueSpy = jest.spyOn(service as any, 'enqueueInvoiceJob').mockResolvedValue({ id: 'job-1' });
    const processSpy = jest
      .spyOn(service, 'processPendingInvoiceJobs')
      .mockRejectedValue(new Error('provider timeout'));

    const result = await service.createAdjustmentNote('biz-1', 'user-1', 'sale-1', {
      kind: 'CREDIT',
      letter: 'A',
      reason: 'nota de credito',
    });

    expect(mockPrisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ voucherType: 'NC_A', relatedInvoiceId: 'inv-a' }),
      })
    );
    expect(enqueueSpy).toHaveBeenCalledWith('biz-1', 'sale-1', 'NC_A');
    expect(processSpy).toHaveBeenCalledWith(1);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INVOICE_CREDIT_NOTE_CREATE', entityId: 'sale-1' })
    );
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'sale-1' });
  });

  it('downloadInvoicePdf valida estado y usa pdf remoto si existe', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      invoices: [],
    } as any);

    await expect(service.downloadInvoicePdf('biz-1', 'sale-1', 'inv-x')).rejects.toThrow(
      'Invoice not found'
    );

    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      invoices: [{ id: 'inv-1', status: 'PENDING', voucherType: 'A' }],
    } as any);
    await expect(service.downloadInvoicePdf('biz-1', 'sale-1', 'inv-1')).rejects.toThrow(
      'Invoice is not issued yet'
    );

    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('pdf-content').buffer,
    } as any);
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      invoices: [
        {
          id: 'inv-2',
          status: 'ISSUED',
          voucherType: 'A',
          pointOfSale: 1,
          number: 10,
          pdfUrl: 'https://cdn/pdf',
        },
      ],
    } as any);

    const out = await service.downloadInvoicePdf('biz-1', 'sale-1', 'inv-2');
    expect(out.filename).toBe('comprobante-A-1-10.pdf');
    expect(out.buffer).toBeInstanceOf(Buffer);
    fetchSpy.mockRestore();
  });

  it('downloadInvoicePdf regenera pdf cuando fetch remoto falla', async () => {
    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockRejectedValue(new Error('network')); 
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      invoices: [
        {
          id: 'inv-3',
          status: 'ISSUED',
          voucherType: 'B',
          pointOfSale: 2,
          number: 20,
          pdfUrl: 'https://cdn/missing',
        },
      ],
    } as any);
    const regenerateSpy = jest
      .spyOn(service as any, 'generateAndStoreInvoicePdf')
      .mockResolvedValue({ buffer: Buffer.from('generated') });

    const out = await service.downloadInvoicePdf('biz-1', 'sale-1', 'inv-3');
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(regenerateSpy).toHaveBeenCalled();
    expect(out.filename).toBe('comprobante-B-2-20.pdf');
    fetchSpy.mockRestore();
  });

  it('cancel solo permite ventas draft y audita cancelacion', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({ id: 'sale-1', status: 'CONFIRMED' } as any);
    await expect(service.cancel('biz-1', 'user-1', 'sale-1')).rejects.toThrow(
      'Cannot cancel confirmed sale'
    );

    jest.spyOn(service, 'getById').mockResolvedValue({ id: 'sale-1', status: 'DRAFT' } as any);
    mockPrisma.sale.update.mockResolvedValue({ id: 'sale-1', status: 'CANCELLED' });

    const cancelled = await service.cancel('biz-1', 'user-1', 'sale-1');
    expect(mockPrisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { status: 'CANCELLED' },
    });
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALE_CANCEL', entityId: 'sale-1' })
    );
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('list aplica filtros y getById valida existencia/tenant', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    mockPrisma.sale.findMany.mockResolvedValue([{ id: 'sale-1' }]);
    mockPrisma.sale.count.mockResolvedValue(1);

    const listed = await service.list('biz-1', {
      customerId: 'cust-1',
      status: 'CONFIRMED',
      invoiceStatus: 'INVOICED',
      startDate,
      endDate,
      page: 2,
      limit: 10,
    });

    expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          customerId: 'cust-1',
          status: 'CONFIRMED',
          invoiceStatus: 'INVOICED',
          createdAt: expect.objectContaining({ gte: startDate, lte: endDate }),
        }),
        skip: 10,
        take: 10,
      })
    );
    expect(listed.meta.total).toBe(1);

    mockPrisma.sale.findUnique.mockResolvedValueOnce(null);
    await expect(service.getById('biz-1', 'sale-x')).rejects.toThrow('Sale not found');

    mockPrisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-1', businessId: 'biz-2' });
    await expect(service.getById('biz-1', 'sale-1')).rejects.toThrow('Access denied');

    mockPrisma.sale.findUnique.mockResolvedValueOnce({ id: 'sale-1', businessId: 'biz-1' });
    const byId = await service.getById('biz-1', 'sale-1');
    expect(byId.id).toBe('sale-1');
  });

  it('createInvoice valida negocio y factura base para notas', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({ id: 'sale-1', invoices: [] } as any);
    mockPrisma.business.findUnique.mockResolvedValue(null);

    await expect((service as any).createInvoice('biz-1', 'sale-1', 'A')).rejects.toThrow(
      'Business not found'
    );

    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1', invoicePointOfSale: 1, invoiceProvider: 'mock' });
    await expect((service as any).createInvoice('biz-1', 'sale-1', 'NC_A')).rejects.toThrow(
      'Cannot issue NC_A without an issued A invoice'
    );
  });

  it('createInvoice emite, guarda invoice y marca venta como facturada', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'sale-1',
      subtotal: n(100),
      taxAmount: n(21),
      total: n(121),
      customer: null,
      items: [
        {
          quantity: n(1),
          unitPrice: n(100),
          taxRate: n(21),
          subtotal: n(121),
          product: { name: 'Martillo' },
        },
      ],
      invoices: [],
    } as any);
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      invoicePointOfSale: 1,
      invoiceProvider: 'facturante',
    });
    jest.spyOn(service as any, 'createVoucherWithFallback').mockResolvedValue({
      providerKey: 'facturante',
      result: {
        success: true,
        cae: '123',
        caeExpiry: new Date('2099-01-01T00:00:00.000Z'),
        number: 456,
        qrData: 'qr',
        pdfUrl: null,
      },
    });
    mockPrisma.invoice.upsert.mockResolvedValue({ id: 'inv-1', pdfUrl: null });
    jest.spyOn(service as any, 'generateAndStoreInvoicePdf').mockResolvedValue({
      buffer: Buffer.from('pdf'),
      pdfUrl: 'https://cdn/pdf',
    });

    const out = await (service as any).createInvoice('biz-1', 'sale-1', 'A');

    expect(mockPrisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: 'biz-1',
          saleId: 'sale-1',
          provider: 'facturante',
          voucherType: 'A',
          status: 'ISSUED',
        }),
      })
    );
    expect(mockPrisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { invoiceStatus: 'INVOICED' },
    });
    expect(out.success).toBe(true);
  });

  it('generateAndStoreInvoicePdf valida negocio/invoice y guarda URL al subir', async () => {
    (service as any).invoicePdfService = {
      generateInvoicePdf: (jest.fn() as any).mockResolvedValue(Buffer.from('pdf-binary')),
    };
    mockPrisma.business.findUnique.mockResolvedValue(null);

    await expect(
      (service as any).generateAndStoreInvoicePdf('biz-1', { invoices: [] }, 'inv-x')
    ).rejects.toThrow('Business not found');

    mockPrisma.business.findUnique.mockResolvedValue({ name: 'Ferreteria', cuit: null });
    await expect(
      (service as any).generateAndStoreInvoicePdf('biz-1', { invoices: [] }, 'inv-x')
    ).rejects.toThrow('Invoice not found');

    const sale = {
      id: 'sale-1',
      createdAt: new Date(),
      subtotal: n(100),
      taxAmount: n(21),
      total: n(121),
      customer: null,
      items: [
        {
          quantity: n(1),
          unitPrice: n(100),
          subtotal: n(121),
          taxRate: n(21),
          product: { name: 'Martillo' },
        },
      ],
      invoices: [
        {
          id: 'inv-10',
          voucherType: 'A',
          pointOfSale: 1,
          number: 100,
          relatedInvoiceId: null,
          adjustmentKind: null,
          adjustmentReason: null,
          cae: '123',
          caeExpiry: new Date(),
          issuedAt: new Date(),
        },
      ],
    };

    (CloudinaryService.uploadPdfBuffer as any).mockResolvedValue({ secure_url: 'https://cdn/inv-10.pdf' });
    mockPrisma.invoice.update.mockResolvedValue({ id: 'inv-10' });

    const out = await (service as any).generateAndStoreInvoicePdf('biz-1', sale, 'inv-10');
    expect(out.pdfUrl).toBe('https://cdn/inv-10.pdf');
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-10' },
      data: { pdfUrl: 'https://cdn/inv-10.pdf' },
    });
  });

  it('generateAndStoreInvoicePdf soporta falla de Cloudinary sin romper', async () => {
    (service as any).invoicePdfService = {
      generateInvoicePdf: (jest.fn() as any).mockResolvedValue(Buffer.from('pdf-binary')),
    };
    mockPrisma.business.findUnique.mockResolvedValue({ name: 'Ferreteria', cuit: null });

    const sale = {
      id: 'sale-1',
      createdAt: new Date(),
      subtotal: n(100),
      taxAmount: n(21),
      total: n(121),
      customer: null,
      items: [
        {
          quantity: n(1),
          unitPrice: n(100),
          subtotal: n(121),
          taxRate: n(21),
          product: { name: 'Martillo' },
        },
      ],
      invoices: [
        {
          id: 'inv-11',
          voucherType: 'A',
          pointOfSale: 1,
          number: 101,
          relatedInvoiceId: null,
          adjustmentKind: null,
          adjustmentReason: null,
          cae: '123',
          caeExpiry: new Date(),
          issuedAt: new Date(),
        },
      ],
    };

    (CloudinaryService.uploadPdfBuffer as any).mockRejectedValue(new Error('upload error'));

    const out = await (service as any).generateAndStoreInvoicePdf('biz-1', sale, 'inv-11');
    expect(out.pdfUrl).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockPrisma.invoice.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-11' } })
    );
  });
});
