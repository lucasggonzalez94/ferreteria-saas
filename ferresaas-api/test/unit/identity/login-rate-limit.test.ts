import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

class FakeRedisUnavailableError extends Error {
  constructor() {
    super('Redis unavailable');
    this.name = 'RedisUnavailableError';
  }
}

const slidingHit = jest.fn<(...args: unknown[]) => Promise<{ allowed: boolean; count: number }>>();
const slidingStatus = jest.fn<(...args: unknown[]) => Promise<{ count: number; newest: number }>>();
const slidingAdd = jest.fn<(...args: unknown[]) => Promise<number>>();
const del = jest.fn<(...args: unknown[]) => Promise<void>>();
const loggerWarn = jest.fn();

jest.mock('@/platform/cache/redis', () => ({
  redisSlidingWindowHit: (...args: unknown[]) => slidingHit(...args),
  redisSlidingWindowStatus: (...args: unknown[]) => slidingStatus(...args),
  redisSlidingWindowAdd: (...args: unknown[]) => slidingAdd(...args),
  redisDel: (...args: unknown[]) => del(...args),
  redisKey: (scope: string) => `ferresaas:test:${scope}`,
  RedisUnavailableError: FakeRedisUnavailableError,
}));

jest.mock('@/config/logger', () => ({ logger: { warn: (...args: unknown[]) => loggerWarn(...args) } }));

const CSRF_SECRET = 'unit-test-csrf-secret-min-32-chars';
const CFG = {
  ipMax: 60,
  ipWindowMs: 900_000,
  ipBurstMax: 15,
  ipBurstWindowMs: 60_000,
  accountMaxFailures: 5,
  ipAccountMaxFailures: 5,
  failureWindowMs: 900_000,
  backoffBaseMs: 30_000,
  backoffMaxMs: 900_000,
};

const mockEnv = {
  app: { isProduction: false, isTest: true, env: 'test' },
  redis: { enabled: true, url: 'redis://unit' },
  csrf: { secret: CSRF_SECRET },
  rateLimit: { login: CFG },
};

jest.mock('@/config/env', () => ({ env: mockEnv }));

import { loginRateLimiter, recordLoginFailure, clearLoginFailures } from '@/modules/identity/http/login-rate-limit';

const expectedAcctId = (email: string) =>
  crypto.createHmac('sha256', CSRF_SECRET).update('login-rate|' + email).digest('hex');

const makeReq = (body: unknown): Request => ({ ip: '10.9.8.7', body } as unknown as Request);
const makeRes = () => ({ setHeader: jest.fn() }) as unknown as Response;

describe('login rate limiting multidimensional (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.redis.enabled = true;
    mockEnv.app.isProduction = false;
    slidingHit.mockResolvedValue({ allowed: true, count: 1 });
    slidingStatus.mockResolvedValue({ count: 0, newest: 0 });
    slidingAdd.mockResolvedValue(1);
    del.mockResolvedValue(undefined);
  });

  it('volumen por IP al máximo: 429 LOGIN_IP_RATE_LIMIT_EXCEEDED con Retry-After', async () => {
    slidingHit.mockResolvedValueOnce({ allowed: false, count: 60 });
    const next = jest.fn();
    const res = makeRes();
    await loginRateLimiter(makeReq({ email: 'a@b.c' }), res, next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('LOGIN_IP_RATE_LIMIT_EXCEEDED');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 900);
  });

  it('ráfaga por IP al máximo: 429 aunque el volumen de 15 min tenga cupo', async () => {
    slidingHit
      .mockResolvedValueOnce({ allowed: true, count: 10 })
      .mockResolvedValueOnce({ allowed: false, count: 15 });
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: 'a@b.c' }), makeRes(), next);
    const err = next.mock.calls[0][0] as { code: string };
    expect(err.code).toBe('LOGIN_IP_RATE_LIMIT_EXCEEDED');
  });

  it('IP+cuenta en umbral: 429 LOGIN_IP_ACCOUNT_RATE_LIMIT_EXCEEDED', async () => {
    slidingStatus.mockResolvedValueOnce({ count: 5, newest: Date.now() });
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: 'victima@test.example' }), makeRes(), next);
    const err = next.mock.calls[0][0] as { code: string };
    expect(err.code).toBe('LOGIN_IP_ACCOUNT_RATE_LIMIT_EXCEEDED');
  });

  it('cuenta en backoff reciente: 429 LOGIN_ACCOUNT_THROTTLED con espera restante', async () => {
    const now = Date.now();
    // IP+cuenta por debajo del umbral; cuenta en 6 fallos (1 por encima):
    // delay = 30s * 2^1 = 60s; pasaron 5s → faltan ~55s.
    slidingStatus
      .mockResolvedValueOnce({ count: 1, newest: now }) // ip+cuenta
      .mockResolvedValueOnce({ count: 6, newest: now - 5_000 }); // cuenta
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: 'victima@test.example' }), makeRes(), next);
    const err = next.mock.calls[0][0] as { code: string; details: { retryAfterSeconds: number } };
    expect(err.code).toBe('LOGIN_ACCOUNT_THROTTLED');
    expect(err.details.retryAfterSeconds).toBeGreaterThan(40);
    expect(err.details.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('cuenta en backoff ya cumplido: el legítimo puede reintentar (recuperación, no candado)', async () => {
    const now = Date.now();
    slidingStatus
      .mockResolvedValueOnce({ count: 4, newest: now - 60_000 }) // ip+cuenta < 5
      .mockResolvedValueOnce({ count: 5, newest: now - 40_000 }); // delay requerido 30s; pasaron 40s
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: 'victima@test.example' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('sin email válido en el body: sólo aplican los controles por IP', async () => {
    const next = jest.fn();
    await loginRateLimiter(makeReq({ password: 'x' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(slidingStatus).not.toHaveBeenCalled();
  });

  it('la cuenta se deriva por HMAC con separación de dominio y nunca guarda el email en texto plano', async () => {
    slidingStatus.mockResolvedValueOnce({ count: 5, newest: Date.now() }).mockResolvedValueOnce({ count: 0, newest: 0 });
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: '  MixEd@Test.example ' }), makeRes(), next);
    const statusKey = slidingStatus.mock.calls[0][0] as string;
    expect(statusKey).toBe(`ferresaas:test:login:ipacct:10.9.8.7:${expectedAcctId('mixed@test.example')}`);
    expect(statusKey).not.toContain('@');
  });

  it('Redis deshabilitado fuera de producción: deja pasar; en producción: 503', async () => {
    mockEnv.redis.enabled = false;
    const nextDev = jest.fn();
    await loginRateLimiter(makeReq({ email: 'a@b.c' }), makeRes(), nextDev);
    expect(nextDev).toHaveBeenCalledWith();

    mockEnv.app.isProduction = true;
    const nextProd = jest.fn();
    await loginRateLimiter(makeReq({ email: 'a@b.c' }), makeRes(), nextProd);
    const err = nextProd.mock.calls[0][0] as { statusCode: number };
    expect(err.statusCode).toBe(503);
  });

  it('Redis caído en el chequeo: 503 fail-closed', async () => {
    slidingHit.mockRejectedValueOnce(new FakeRedisUnavailableError());
    const next = jest.fn();
    await loginRateLimiter(makeReq({ email: 'a@b.c' }), makeRes(), next);
    const err = next.mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('RATE_LIMIT_UNAVAILABLE');
  });

  it('recordLoginFailure escribe en cuenta e IP+cuenta con TTL (ventana + backoff máximo en cuenta)', async () => {
    await recordLoginFailure('10.9.8.7', 'user@test.example');
    expect(slidingAdd).toHaveBeenCalledTimes(2);
    const [acctKey, acctArgs] = slidingAdd.mock.calls[0] as [string, { ttlMs: number }];
    const [ipAcctKey, ipAcctArgs] = slidingAdd.mock.calls[1] as [string, { ttlMs: number }];
    expect(acctKey).toBe(`ferresaas:test:login:acct:${expectedAcctId('user@test.example')}`);
    expect(acctArgs.ttlMs).toBe(CFG.failureWindowMs + CFG.backoffMaxMs);
    expect(ipAcctKey).toBe(`ferresaas:test:login:ipacct:10.9.8.7:${expectedAcctId('user@test.example')}`);
    expect(ipAcctArgs.ttlMs).toBe(CFG.failureWindowMs);
  });

  it('recordLoginFailure propaga la caída de Redis (fail-closed del registro)', async () => {
    slidingAdd.mockRejectedValueOnce(new FakeRedisUnavailableError());
    await expect(recordLoginFailure('10.9.8.7', 'user@test.example'))
      .rejects.toBeInstanceOf(FakeRedisUnavailableError);
  });

  it('clearLoginFailures limpia cuenta e IP+cuenta y NO toca el volumen por IP', async () => {
    await clearLoginFailures('10.9.8.7', 'user@test.example');
    const keys = del.mock.calls.map(call => call[0] as string);
    expect(keys).toEqual([
      `ferresaas:test:login:acct:${expectedAcctId('user@test.example')}`,
      `ferresaas:test:login:ipacct:10.9.8.7:${expectedAcctId('user@test.example')}`,
    ]);
    expect(keys.every(key => !key.includes('ip:vol') && !key.includes('ip:burst'))).toBe(true);
  });

  it('clearLoginFailures con Redis caído degrada a log (fail-open tras login ya validado)', async () => {
    del.mockRejectedValueOnce(new FakeRedisUnavailableError());
    await expect(clearLoginFailures('10.9.8.7', 'user@test.example')).resolves.toBeUndefined();
    expect(loggerWarn).toHaveBeenCalled();
  });
});
