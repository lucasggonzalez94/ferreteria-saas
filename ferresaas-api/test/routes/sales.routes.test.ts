import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

const mockSaleService = {
  list: jest.fn() as any,
  create: jest.fn() as any,
  listInvoiceJobs: jest.fn() as any,
  listInvoices: jest.fn() as any,
  getInvoiceById: jest.fn() as any,
  getInvoiceJobStats: jest.fn() as any,
  retryInvoiceJob: jest.fn() as any,
};

const mockIdempotencyService = {
  check: jest.fn() as any,
  save: jest.fn() as any,
};

const authState = {
  user: { id: 'user-1', businessId: 'biz-1' },
  businessId: 'biz-1',
};

jest.mock('@/services/sale.service', () => ({
  SaleService: class SaleService {
    list = mockSaleService.list;
    create = mockSaleService.create;
    listInvoiceJobs = mockSaleService.listInvoiceJobs;
    listInvoices = mockSaleService.listInvoices;
    getInvoiceById = mockSaleService.getInvoiceById;
    getInvoiceJobStats = mockSaleService.getInvoiceJobStats;
    retryInvoiceJob = mockSaleService.retryInvoiceJob;
  },
}));
jest.mock('@/services/idempotency.service', () => ({ IdempotencyService: mockIdempotencyService }));
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = authState.user;
    (req as any).businessId = authState.businessId;
    next();
  },
}));
jest.mock('@/middleware/multi-tenant', () => ({
  multiTenant: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).businessId = authState.businessId;
    next();
  },
}));
jest.mock('@/middleware/rbac', () => ({
  requirePermissions:
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/routes/sales.schemas', () => ({
  createSaleSchema: { parse: (v: unknown) => v },
  confirmSaleSchema: { parse: (v: unknown) => v },
  salesFiltersSchema: { parse: (v: unknown) => v },
  invoiceJobFiltersSchema: { parse: (v: unknown) => v },
  invoiceJobParamsSchema: { parse: (v: unknown) => v },
  createAdjustmentNoteSchema: { parse: (v: unknown) => v },
  invoiceFiltersSchema: { parse: (v: unknown) => v },
  invoiceParamsSchema: { parse: (v: unknown) => v },
  refundSaleSchema: { parse: (v: unknown) => v },
}));

import salesRouter from '@/routes/sales.routes';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/sales', salesRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode || 500).json({ success: false, error: { code: err?.code, message: err?.message } });
  });
  return app;
};

describe('sales.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.businessId = 'biz-1';
    authState.user = { id: 'user-1', businessId: 'biz-1' };
  });

  it('GET /sales devuelve listado paginado', async () => {
    mockSaleService.list.mockResolvedValue({
      items: [{ id: 's-1' }],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const app = createApp();
    const res = await request(app).get('/sales').query({ page: 1, limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /sales usa respuesta idempotente existente cuando aplica', async () => {
    mockIdempotencyService.check.mockResolvedValue({
      exists: true,
      response: { status: 200, body: { success: true, data: { id: 'existing-sale' } } },
    });

    const app = createApp();
    const res = await request(app).post('/sales').send({ clientOperationId: 'op-1' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('existing-sale');
    expect(mockSaleService.create).not.toHaveBeenCalled();
  });

  it('POST /sales crea venta y guarda idempotencia cuando no existe', async () => {
    mockIdempotencyService.check.mockResolvedValue({ exists: false });
    mockSaleService.create.mockResolvedValue({ id: 'sale-2' });

    const app = createApp();
    const res = await request(app).post('/sales').send({ clientOperationId: 'op-2' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('sale-2');
    expect(mockIdempotencyService.save).toHaveBeenCalled();
  });
});
