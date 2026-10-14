import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
import app from '@/app';

const stamp = crypto.randomUUID().slice(0, 8);

const flushRateKeys = async () => {
  const keys = await redis.keys(redisKey('rate:*'));
  if (keys.length) await redis.del(...keys);
};

describe('Limiters distribuidos genéricos (Redis real)', () => {
  beforeAll(async () => {
    await redis.connect();
    await redis.ping();
    await flushRateKeys();
  });

  beforeEach(() => Object.assign(env.redis, { enabled: true }));

  afterAll(async () => {
    if (redis.status === 'ready') await flushRateKeys();
    redis.disconnect();
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  it('forgot y reset tienen contadores independientes por IP', async () => {
    const forgot = () => request(app).post('/v1/auth/forgot-password')
      .send({ email: `forgot-${stamp}@test.example` });
    const reset = () => request(app).post('/v1/auth/reset-password')
      .send({ token: 'token-invalido', newPassword: 'Valid-password-123!' });

    // forgot: límite 3/hora por IP.
    for (let i = 0; i < 3; i++) expect((await forgot()).status).toBe(200);
    const fourth = await forgot();
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe('FORGOT_RATE_LIMIT_EXCEEDED');

    // reset: no heredó los consumos de forgot; responde por token inválido.
    for (let i = 0; i < 5; i++) expect((await reset()).status).toBe(400);
    const sixth = await reset();
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RESET_RATE_LIMIT_EXCEEDED');

    // Keys namespaceadas por endpoint, con TTL (Lua atómico).
    const forgotKeys = await redis.keys(redisKey('rate:forgot-password:*'));
    const resetKeys = await redis.keys(redisKey('rate:reset-password:*'));
    expect(forgotKeys).toHaveLength(1);
    expect(resetKeys).toHaveLength(1);
    for (const key of [...forgotKeys, ...resetKeys]) {
      expect(await redis.pttl(key)).toBeGreaterThan(0);
    }
  });

  it('Redis dados de baja con límite habilitado falla cerrado con 503', async () => {
    const spy = jest.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      const res = await request(app).post('/v1/auth/forgot-password')
        .send({ email: `fc-${stamp}@test.example` });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
    } finally {
      spy.mockRestore();
    }
  });
});
