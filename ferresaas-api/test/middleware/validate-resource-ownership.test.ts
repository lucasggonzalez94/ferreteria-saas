import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const makeModel = () => ({
  findUnique: jest.fn() as any,
});

const mockPrisma = {
  product: makeModel(),
  sale: makeModel(),
  customer: makeModel(),
  supplier: makeModel(),
  category: makeModel(),
  brand: makeModel(),
  purchase: makeModel(),
  invoice: makeModel(),
  cashRegisterSession: makeModel(),
  discountApproval: makeModel(),
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));

import { AppError } from '@/utils/response';
import { validateResourceOwnership } from '@/middleware/validate-resource-ownership';

describe('validate-resource-ownership middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires resource id param', async () => {
    const middleware = validateResourceOwnership('product');
    const req = { params: {}, businessId: 'biz-1' } as any;
    const next = jest.fn();

    await middleware(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('MISSING_PARAM');
  });

  it('requires business context', async () => {
    const middleware = validateResourceOwnership('product');
    const req = { params: { id: 'product-1' } } as any;
    const next = jest.fn();

    await middleware(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('returns invalid model error for unknown model key', async () => {
    const middleware = validateResourceOwnership('unknown-model' as any);
    const req = { params: { id: 'x-1' }, businessId: 'biz-1' } as any;
    const next = jest.fn();

    await middleware(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('INVALID_MODEL');
  });

  it('returns not found when resource does not exist', async () => {
    const middleware = validateResourceOwnership('product');
    const req = { params: { id: 'product-1' }, businessId: 'biz-1' } as any;
    const next = jest.fn();
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await middleware(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('NOT_FOUND');
  });

  it('blocks access when resource belongs to another business', async () => {
    const middleware = validateResourceOwnership('product');
    const req = { params: { id: 'product-1' }, businessId: 'biz-1' } as any;
    const next = jest.fn();
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'product-1', businessId: 'biz-2' });

    await middleware(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('FORBIDDEN');
  });

  it('attaches resource and continues for valid ownership', async () => {
    const middleware = validateResourceOwnership('product', 'productId');
    const req = { params: { productId: 'product-1' }, businessId: 'biz-1' } as any;
    const next = jest.fn();
    const resource = { id: 'product-1', businessId: 'biz-1' };
    mockPrisma.product.findUnique.mockResolvedValue(resource);

    await middleware(req, {} as any, next);

    expect(req.resource).toEqual(resource);
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards unexpected database errors', async () => {
    const middleware = validateResourceOwnership('product');
    const req = { params: { id: 'product-1' }, businessId: 'biz-1' } as any;
    const next = jest.fn();
    const dbError = new Error('query failed');
    mockPrisma.product.findUnique.mockRejectedValue(dbError);

    await middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
