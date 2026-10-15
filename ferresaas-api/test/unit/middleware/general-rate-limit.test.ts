import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

class FakeRedisUnavailableError extends Error {
  constructor() {
    super('Redis unavailable');
    this.name = 'RedisUnavailableError';
  }
}

const slidingHit = jest.fn<(...args: unknown[]) => Promise<{ allowed: boolean; count: number }>>();

jest.mock('@/platform/cache/redis', () => ({
  redisSlidingWindowHit: (...args: unknown[]) => slidingHit(...args),
  redisKey: (scope: string) => `ferresaas:test:${scope}`,
  RedisUnavailableError: FakeRedisUnavailableError,
}));

const mockEnv = {
  app: { isProduction: false },
  redis: { enabled: true },
  rateLimit: { windowMs: 900_000, maxRequests: 100 },
};

jest.mock('@/config/env', () => ({ env: mockEnv }));

import { generalLimiter } from '@/middleware/rate-limit';

const makeReq = (): Request => ({ ip: '10.0.0.9' } as unknown as Request);
const makeRes = () => ({ setHeader: jest.fn() }) as unknown as Response;

describe('generalLimiter (ventana deslizante distribuida)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.redis.enabled = true;
    mockEnv.app.isProduction = false;
    slidingHit.mockResolvedValue({ allowed: true, count: 1 });
  });

  it('cuenta sobre la key por IP y deja pasar cuando hay cupo', async () => {
    const next = jest.fn();
    await generalLimiter(makeReq(), makeRes(), next);
    expect(slidingHit).toHaveBeenCalledWith(
      'ferresaas:test:rate:general:10.0.0.9',
      expect.objectContaining({ windowMs: 900_000, max: 100 }),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('sin cupo: 429 RATE_LIMIT_EXCEEDED con Retry-After', async () => {
    slidingHit.mockResolvedValueOnce({ allowed: false, count: 100 });
    const next = jest.fn();
    const res = makeRes();
    await generalLimiter(makeReq(), res, next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 900);
  });

  it('Redis caído: fail-closed 503 (igual política que los límites de auth)', async () => {
    slidingHit.mockRejectedValueOnce(new FakeRedisUnavailableError());
    const next = jest.fn();
    await generalLimiter(makeReq(), makeRes(), next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('RATE_LIMIT_UNAVAILABLE');
  });

  it('Redis deshabilitado: permite fuera de producción y rechaza en producción', async () => {
    mockEnv.redis.enabled = false;
    const nextDev = jest.fn();
    await generalLimiter(makeReq(), makeRes(), nextDev);
    expect(nextDev).toHaveBeenCalledWith();

    mockEnv.app.isProduction = true;
    const nextProd = jest.fn();
    await generalLimiter(makeReq(), makeRes(), nextProd);
    const err = nextProd.mock.calls[0][0] as { statusCode: number };
    expect(err.statusCode).toBe(503);
  });
});
