import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import type * as EnvConfig from '@/config/env';

// Redis real (integración) habilitado; el resto de la config igual.
jest.mock('@/config/env', () => {
  const actual = jest.requireActual<typeof EnvConfig>('@/config/env');
  Object.assign(actual.env.redis, { enabled: true, url: 'redis://127.0.0.1:56379' });
  return actual;
});

import { env } from '@/config/env';
import { redis, redisKey } from '@/platform/cache/redis';
import { closeDatabase } from '@/platform/database/client';
import { hashPassword } from '@/platform/security/passwords';
import { recordLoginFailure } from '@/modules/identity/http/login-rate-limit';
import app from '@/app';

const stamp = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const userOne = { email: `lr1-${stamp}@test.example`, password: 'Valid-password-123!' };
const userTwo = { email: `lr2-${stamp}@test.example`, password: 'Valid-password-123!' };

type LoginCfg = typeof env.rateLimit.login;
const ORIGINAL_CFG: LoginCfg = { ...env.rateLimit.login };
const TEST_CFG: LoginCfg = {
  ipMax: 100,
  ipWindowMs: 900_000,
  ipBurstMax: 100,
  ipBurstWindowMs: 60_000,
  accountMaxFailures: 2,
  ipAccountMaxFailures: 2,
  failureWindowMs: 900_000,
  backoffBaseMs: 1_000,
  backoffMaxMs: 5_000,
};

const setCfg = (partial: Partial<LoginCfg>) => Object.assign(env.rateLimit.login, { ...TEST_CFG, ...partial });

const flushLoginKeys = async () => {
  const keys = await redis.keys(redisKey('login:*'));
  if (keys.length) await redis.del(...keys);
};

const attempt = (email: string, password: string) =>
  request(app).post('/v1/auth/login')
    .set('Origin', 'http://localhost:3000')
    .send({ email, password });

describe('Login rate limiting multidimensional (Redis real)', () => {
  beforeAll(async () => {
    const password = await hashPassword(userOne.password);
    await adminPrisma.business.create({ data: {
      id: tenantId, name: 'Tenant login-rate',
      cuit: tenantId.replace(/\D/g, '').padEnd(11, '2').slice(0, 11), taxCondition: 'MONOTRIBUTO',
    } });
    await adminPrisma.user.create({ data: { businessId: tenantId, email: userOne.email, password } });
    await adminPrisma.user.create({ data: { businessId: tenantId, email: userTwo.email, password } });
    await redis.connect();
    await redis.ping();
    await flushLoginKeys();
  });

  beforeEach(async () => {
    Object.assign(env.redis, { enabled: true });
    setCfg({});
    await flushLoginKeys();
  });

  afterEach(() => Object.assign(env.rateLimit.login, ORIGINAL_CFG));

  afterAll(async () => {
    if (redis.status === 'ready') await flushLoginKeys();
    redis.disconnect();
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: tenantId } });
    await adminPrisma.$disconnect();
  });

  it('red compartida: una cuenta bloqueada por IP+cuenta no afecta a otra cuenta de la misma IP', async () => {
    expect((await attempt(userOne.email, 'mala')).status).toBe(401);
    expect((await attempt(userOne.email, 'mala')).status).toBe(401);
    // Umbral 2 fallos por IP+cuenta: la siguiente de la cuenta 1 se frena.
    const blocked = await attempt(userOne.email, 'mala');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('LOGIN_IP_ACCOUNT_RATE_LIMIT_EXCEEDED');

    // La cuenta 2 desde la MISMA IP sigue pudiendo intentar (sólo 1 fallo propio).
    expect((await attempt(userTwo.email, 'mala')).status).toBe(401);
  });

  it('fuerza bruta: umbral duro por IP+cuenta devuelve 429 con Retry-After', async () => {
    expect((await attempt(userOne.email, 'mala')).status).toBe(401);
    expect((await attempt(userOne.email, 'mala')).status).toBe(401);
    const blocked = await attempt(userOne.email, 'mala');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('password spraying: el volumen total por IP sigue mandando con cuentas distintas', async () => {
    setCfg({ ipMax: 3, accountMaxFailures: 100, ipAccountMaxFailures: 100 });
    expect((await attempt(`spray-a-${stamp}@test.example`, 'mala')).status).toBe(401);
    expect((await attempt(`spray-b-${stamp}@test.example`, 'mala')).status).toBe(401);
    expect((await attempt(`spray-c-${stamp}@test.example`, 'mala')).status).toBe(401);
    const blocked = await attempt(`spray-d-${stamp}@test.example`, 'mala');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('LOGIN_IP_RATE_LIMIT_EXCEEDED');
  });

  it('DoS dirigido distribuido: la cuenta entra en backoff progresivo (nunca bloqueo absoluto)', async () => {
    // Fallos "desde otras IPs" (bypass del límite de IP): se registran directos.
    await recordLoginFailure('198.51.100.10', userOne.email);
    await recordLoginFailure('203.0.113.55', userOne.email);
    const throttled = await attempt(userOne.email, userOne.password);
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe('LOGIN_ACCOUNT_THROTTLED');
    // El retryAfter informa cuándo un legítimo puede reintentar: recuperación,
    // no candado permanente (= no hay DoS dirigido absoluto).
    expect(throttled.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('login exitoso limpia fallos por cuenta e IP+cuenta pero NO el volumen por IP', async () => {
    expect((await attempt(userOne.email, 'mala')).status).toBe(401);
    expect((await attempt(userOne.email, userOne.password)).status).toBe(200);

    expect(await redis.keys(redisKey('login:acct:*'))).toHaveLength(0);
    expect(await redis.keys(redisKey('login:ipacct:*'))).toHaveLength(0);
    const volKeys = await redis.keys(redisKey('login:ip:vol:*'));
    expect(volKeys).toHaveLength(1);
    expect(await redis.zcard(volKeys[0])).toBe(2);
  });

  it('Redis caído en el chequeo: fail-closed 503', async () => {
    const spy = jest.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      const res = await attempt(userOne.email, userOne.password);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
    } finally {
      spy.mockRestore();
    }
  });

  it('Redis caído al REGISTRAR un fallo real: fail-closed 503 (no deja pasar el login fallido)', async () => {
    // El script de registro (ADD) termina en ZCARD; interceptamos sólo ése,
    // dejando pasar los evals del middleware (chequeo).
    const original = redis.eval.bind(redis);
    const spy = jest.spyOn(redis, 'eval').mockImplementation(((script: unknown, ...rest: unknown[]) => {
      const text = typeof script === 'string' ? script : '';
      if (text.includes("return redis.call('ZCARD', KEYS[1])")) {
        return Promise.reject(new Error('ECONNREFUSED'));
      }
      return (original as (...args: unknown[]) => Promise<unknown>)(script, ...rest);
    }) as typeof redis.eval);
    try {
      const res = await attempt(userOne.email, 'mala');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
    } finally {
      spy.mockRestore();
    }
  });
});
