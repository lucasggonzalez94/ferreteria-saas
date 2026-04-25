import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

const mockProductService = {
  list: jest.fn() as any,
  getById: jest.fn() as any,
  create: jest.fn() as any,
  update: jest.fn() as any,
  delete: jest.fn() as any,
  uploadImage: jest.fn() as any,
  removeImage: jest.fn() as any,
  updatePrice: jest.fn() as any,
};

const mockProductImportService = {
  preview: jest.fn() as any,
  execute: jest.fn() as any,
};

const authState = {
  user: { id: 'user-1', businessId: 'biz-1' },
  businessId: 'biz-1',
};

jest.mock('@/services/product.service', () => ({
  ProductService: class ProductService {
    list = mockProductService.list;
    getById = mockProductService.getById;
    create = mockProductService.create;
    update = mockProductService.update;
    delete = mockProductService.delete;
    uploadImage = mockProductService.uploadImage;
    removeImage = mockProductService.removeImage;
    updatePrice = mockProductService.updatePrice;
  },
}));
jest.mock('@/services/product-import.service', () => ({
  ProductImportService: class ProductImportService {
    preview = mockProductImportService.preview;
    execute = mockProductImportService.execute;
  },
}));
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
jest.mock('@/routes/products.schemas', () => ({
  createProductSchema: { parse: (v: unknown) => v },
  updateProductSchema: { parse: (v: unknown) => v },
  updatePriceSchema: { parse: (v: unknown) => v },
  productFiltersSchema: { parse: (v: unknown) => v },
  calculateSuggestedPriceSchema: { parse: (v: unknown) => v },
}));

import productsRouter from '@/routes/products.routes';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/products', productsRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode || 500).json({ success: false, error: { code: err?.code, message: err?.message } });
  });
  return app;
};

describe('products.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.businessId = 'biz-1';
    authState.user = { id: 'user-1', businessId: 'biz-1' };
  });

  it('GET /products devuelve listado paginado', async () => {
    mockProductService.list.mockResolvedValue({
      items: [{ id: 'p-1', name: 'Martillo' }],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const app = createApp();
    const res = await request(app).get('/products').query({ page: 1, limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /products/:id valida ownership', async () => {
    const app = createApp();

    mockProductService.getById.mockResolvedValueOnce({ id: 'p-1', businessId: 'biz-2' });
    const forbidden = await request(app).get('/products/p-1');
    expect(forbidden.status).toBe(403);

    mockProductService.getById.mockResolvedValueOnce({ id: 'p-1', businessId: 'biz-1' });
    const ok = await request(app).get('/products/p-1');
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe('p-1');
  });

  it('POST /products/calculate-price retorna precio sugerido', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/products/calculate-price')
      .send({ cost: 100, taxRate: 21, marginPercent: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestedPrice).toBeGreaterThan(0);
  });
});
