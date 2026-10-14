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
import { hashPassword } from '@/platform/security/passwords';
import app from '@/app';

const stamp = crypto.randomUUID().slice(0, 8);
const email = `rl-${stamp}@test.example`;
const tenantId = crypto.randomUUID();

const rateKeys = async () => redis.keys(redisKey('rate:login:*'));

describe('Rate limiter distribuido (Redis real)', () => {
  beforeAll(async () => {
    const password = await hashPassword('Valid-password-123!');
    await adminPrisma.business.create({ data: {
      id: tenantId, name: 'Tenant rate-limit',
      cuit: tenantId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11), taxCondition: 'MONOTRIBUTO',
    } });
    await adminPrisma.user.create({ data: { businessId: tenantId, email, password } });
    await redis.connect();
    await redis.ping();
    // Las ventanas de login duran 15 min: una corrida previa puede haber dejado la key.
    const leftovers = await rateKeys();
    if (leftovers.length) await redis.del(...leftovers);
  });

  beforeEach(() => Object.assign(env.redis, { enabled: true }));

  afterAll(async () => {
    if (redis.status === 'ready') {
      const keys = await rateKeys();
      if (keys.length) await redis.del(...keys);
    }
    redis.disconnect();
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: tenantId } });
    await adminPrisma.$disconnect();
  });

  it('bloquea la 6ta request de login en la ventana y la key namespaceada tiene TTL (operación atómica)', async () => {
    const attempt = () => request(app).post('/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: 'invalida' });

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401]);

    const sixth = await attempt();
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('LOGIN_RATE_LIMIT_EXCEEDED');

    // La key creada por el Lua lleva namespace de entorno y TTL desde el primer hit.
    const keys = await rateKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^ferresaas:test:rate:login:/);
    expect(await redis.pttl(keys[0])).toBeGreaterThan(0);
    expect(Number(await redis.get(keys[0]))).toBe(6);
  });

  it('incrementos concurrentes no pierden conteo (INCR atómico en Lua)', async () => {
    const parallel = await Promise.all(
      Array.from({ length: 4 }, () => request(app).post('/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email, password: 'invalida' })),
    );
    // Ya hay 6 hits del test anterior: 4 más superan el límite de 5 => todos 429,
    // pero el contador debe reflejar exactamente los 10 hits (sin pérdidas).
    expect(parallel.every(res => res.status === 429)).toBe(true);
    const [key] = await rateKeys();
    expect(Number(await redis.get(key))).toBe(10);
    // Los hits bloqueados no prolongan la ventana: el TTL sigue contando.
    expect(await redis.pttl(key)).toBeGreaterThan(0);
  });

  it('Redis dados de baja con límite habilitado falla cerrado con 503 (no deja pasar login)', async () => {
    // Comando real del cliente rechazando (Redis caído): el wrapper lo traduce
    // a RedisUnavailableError y el limiter decide fail-closed.
    const spy = jest.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      const res = await request(app).post('/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email, password: 'Valid-password-123!' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
    } finally {
      spy.mockRestore();
    }
  });
});
