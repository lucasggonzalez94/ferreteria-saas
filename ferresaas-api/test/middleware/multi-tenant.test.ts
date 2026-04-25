import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  business: {
    findUnique: jest.fn() as any,
  },
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));

import { AppError } from '@/utils/response';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { multiTenant, validateBusinessOwnership } from '@/middleware/multi-tenant';

describe('multi-tenant middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authenticated business context', async () => {
    const req = { user: undefined } as any;
    const next = jest.fn();

    await multiTenant(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('injects businessId and timezone from business config', async () => {
    const req = {
      user: {
        businessId: 'biz-1',
      },
    } as any;
    const next = jest.fn();
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1', timezone: 'America/Lima' });

    await multiTenant(req, {} as any, next);

    expect(req.businessId).toBe('biz-1');
    expect(req.timezone).toBe('America/Lima');
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to default timezone when business timezone is not configured', async () => {
    const req = {
      user: {
        businessId: 'biz-1',
      },
    } as any;
    const next = jest.fn();
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });

    await multiTenant(req, {} as any, next);

    expect(req.timezone).toBe(DEFAULT_TIMEZONE);
  });

  it('forwards prisma errors through next', async () => {
    const req = {
      user: {
        businessId: 'biz-1',
      },
    } as any;
    const next = jest.fn();
    const dbError = new Error('db down');
    mockPrisma.business.findUnique.mockRejectedValue(dbError);

    await multiTenant(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });

  it('validateBusinessOwnership throws on cross-business access', () => {
    expect(() => validateBusinessOwnership('biz-a', 'biz-b')).toThrow(AppError);
  });

  it('validateBusinessOwnership allows matching businessId', () => {
    expect(() => validateBusinessOwnership('biz-a', 'biz-a')).not.toThrow();
  });
});
