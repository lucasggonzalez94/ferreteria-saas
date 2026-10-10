import crypto from 'node:crypto';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import type * as EnvConfig from '@/config/env';

// Sólo configuración del endpoint aislado; PostgreSQL, Redis y auth son reales.
jest.mock('@/config/env', () => {
  const actual = jest.requireActual<typeof EnvConfig>('@/config/env');
  Object.assign(actual.env.redis, { enabled: true, url: 'redis://127.0.0.1:56379' });
  return actual;
});

import { env } from '@/config/env';
import { redis } from '@/platform/cache/redis';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword } from '@/platform/security/passwords';
import { issueAccessToken, verifyAccessToken } from '@/platform/security/jwt';
import { login } from '@/modules/identity/application/login';
import app from '@/app';

const uow = new TenantUnitOfWork(prisma);
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const resourceA = `auth08_a_${tenantA}`;
const resourceB = `auth08_b_${tenantB}`;
const permissionA = `${resourceA}:read`;
const permissionB = `${resourceB}:read`;
const PASSWORD = 'Valid-password-123!';
const cacheKeys = new Set<string>();
let userA: string;
let userB: string;
let roleA: string;
let roleB: string;
let permissionId: string;

async function createIdentity(businessId: string, permission: string, roleName: string) {
  const password = await hashPassword(PASSWORD);
  return uow.run({ businessId }, async tx => {
    await tx.business.create({ data: {
      id: businessId, name: 'AUTH-08 tenant',
      cuit: businessId.replace(/\D/g, '').padEnd(11, '8').slice(0, 11), taxCondition: 'MONOTRIBUTO',
    } });
    const catalogPermission = await tx.permission.findUniqueOrThrow({
      where: { resource_action: { resource: permission, action: 'read' } },
    });
    const user = await tx.user.create({ data: {
      businessId, email: `me-${businessId}@test.example`, password, firstName: 'Ana',
    } });
    const role = await tx.role.create({ data: { businessId, name: roleName } });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.rolePermission.create({ data: { roleId: role.id, permissionId: catalogPermission.id } });
    return { user, role, permissionId: catalogPermission.id };
  });
}

function me(accessToken?: string) {
  const call = request(app).get('/v1/auth/me');
  return accessToken ? call.set('Authorization', `Bearer ${accessToken}`) : call;
}

function sessionA() {
  return login(`me-${tenantA}@test.example`, PASSWORD);
}

function claimsOf(accessToken: string) {
  const { sub, sid, tid, sv, av, typ } = verifyAccessToken(accessToken);
  return { sub, sid, tid, sv, av, typ };
}

async function cacheKey(businessId: string, userId: string) {
  const business = await uow.run({ businessId }, tx => tx.business.findUniqueOrThrow({
    where: { id: businessId }, select: { authorizationVersion: true },
  }));
  const key = `ferresaas:authz:${businessId}:${userId}:${business.authorizationVersion}`;
  cacheKeys.add(key);
  return key;
}

describe('AUTH-08: identidad actual (PostgreSQL runtime + Redis reales)', () => {
  beforeAll(async () => {
    await adminPrisma.permission.createMany({ data: [
      { resource: resourceA, action: 'read' }, { resource: resourceB, action: 'read' },
    ] });
    const a = await createIdentity(tenantA, resourceA, 'ME_A');
    const b = await createIdentity(tenantB, resourceB, 'ME_B');
    userA = a.user.id;
    userB = b.user.id;
    roleA = a.role.id;
    roleB = b.role.id;
    permissionId = a.permissionId;
    await redis.connect();
    await redis.ping();
  });

  beforeEach(() => Object.assign(env.redis, { enabled: true }));

  afterAll(async () => {
    if (redis.status === 'ready' && cacheKeys.size) await redis.del(...cacheKeys);
    redis.disconnect();
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminPrisma.permission.deleteMany({ where: { resource: { in: [resourceA, resourceB] } } });
    await adminPrisma.$disconnect();
  });

  it('devuelve sólo el contrato público, no-store, sin cookies ni efectos sobre la sesión', async () => {
    const session = await sessionA();
    const sid = verifyAccessToken(session.accessToken).sid;
    const state = () => uow.run({ businessId: tenantA }, async tx => ({
      session: await tx.authSession.findUniqueOrThrow({ where: { id: sid } }),
      audits: await tx.auditLog.count(),
    }));
    const before = await state();
    const result = await me(session.accessToken);
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(result.body).toEqual({ success: true, data: {
      id: userA, businessId: tenantA, email: `me-${tenantA}@test.example`, firstName: 'Ana',
      roles: ['ME_A'], permissions: [permissionA],
    } });
    expect(await state()).toEqual(before);
    await cacheKey(tenantA, userA);
  });

  it('rechaza ausencia de Bearer, JWT inválido, expirado y refresh en cookie sin access', async () => {
    const session = await sessionA();
    const expired = issueAccessToken(claimsOf(session.accessToken), -1);
    const responses = await Promise.all([
      me(), me('invalid'), me(expired), me().set('Cookie', `refreshToken=${session.refreshToken}`),
    ]);
    expect(responses.map(res => res.status)).toEqual([401, 401, 401, 401]);
    expect(responses.map(res => res.body.error.code)).toEqual(['UNAUTHORIZED', 'INVALID_TOKEN', 'INVALID_TOKEN', 'UNAUTHORIZED']);
    expect(responses.every(res => res.headers['cache-control'] === 'no-store')).toBe(true);
  });

  it('ignora tenant/actor del cliente y rechaza claims que mezclan sesión A con tenant o usuario B', async () => {
    const session = await sessionA();
    const claims = claimsOf(session.accessToken);
    const result = await me(session.accessToken).set('X-Business-Id', tenantB).query({ businessId: tenantB, userId: userB });
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ id: userA, businessId: tenantA });
    expect((await me(issueAccessToken({ ...claims, tid: tenantB }, 60))).status).toBe(401);
    expect((await me(issueAccessToken({ ...claims, sub: userB }, 60))).status).toBe(401);
  });

  it.each(['revokedAt', 'expiresAt', 'absoluteExpiresAt'] as const)('rechaza sesión con %s invalidado aunque Redis tenga permisos', async field => {
    const session = await sessionA();
    expect((await me(session.accessToken)).status).toBe(200);
    const key = await cacheKey(tenantA, userA);
    expect(await redis.get(key)).not.toBeNull();
    const sid = verifyAccessToken(session.accessToken).sid;
    await uow.run({ businessId: tenantA }, tx => tx.authSession.update({
      where: { id: sid }, data: { [field]: new Date(Date.now() - 1000) },
    }));
    const result = await me(session.accessToken);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('UNAUTHORIZED');
    expect(result.headers['cache-control']).toBe('no-store');
  });

  it('usuario desactivado y securityVersion retirado no se rehabilitan por caché positiva', async () => {
    const session = await sessionA();
    expect((await me(session.accessToken)).status).toBe(200);
    await cacheKey(tenantA, userA);
    await uow.run({ businessId: tenantA }, tx => tx.user.update({ where: { id: userA }, data: { isActive: false } }));
    try {
      expect((await me(session.accessToken)).status).toBe(401);
    } finally {
      await uow.run({ businessId: tenantA }, tx => tx.user.update({ where: { id: userA }, data: { isActive: true } }));
    }
    const oldVersion = await me(session.accessToken);
    expect(oldVersion.status).toBe(401);
    expect(oldVersion.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('una nueva versión PostgreSQL retira permisos incluso con un cache hit antiguo', async () => {
    const session = await sessionA();
    const oldKey = await cacheKey(tenantA, userA);
    expect((await me(session.accessToken)).body.data.permissions).toEqual([permissionA]);
    expect(await redis.get(oldKey)).not.toBeNull();
    await uow.run({ businessId: tenantA }, tx => tx.rolePermission.deleteMany({ where: { roleId: roleA } }));
    try {
      const result = await me(session.accessToken);
      expect(result.status).toBe(200);
      expect(result.body.data.permissions).toEqual([]);
      const newKey = await cacheKey(tenantA, userA);
      expect(newKey).not.toBe(oldKey);
      expect(await redis.get(oldKey)).toContain(permissionA);
    } finally {
      await uow.run({ businessId: tenantA }, tx => tx.rolePermission.create({ data: { roleId: roleA, permissionId } }));
    }
  });

  it.each(['{broken', 'null', '{"roles":[],"permissions":[42],"isActive":true}'])('caché inválido se recupera desde PostgreSQL: %s', async value => {
    const session = await sessionA();
    const key = await cacheKey(tenantA, userA);
    await redis.set(key, value, 'EX', 60);
    const result = await me(session.accessToken);
    expect(result.status).toBe(200);
    expect(result.body.data.permissions).toEqual([permissionA]);
    expect(JSON.parse((await redis.get(key))!)).toMatchObject({ roles: ['ME_A'], permissions: [permissionA] });
  });

  it('el estado activo procede de PostgreSQL, no de un marcador negativo antiguo en Redis', async () => {
    const session = await sessionA();
    const key = await cacheKey(tenantA, userA);
    await redis.set(key, JSON.stringify({ roles: ['ME_A'], permissions: [permissionA], isActive: false }), 'EX', 60);
    const result = await me(session.accessToken);
    expect(result.status).toBe(200);
    expect(result.body.data.permissions).toEqual([permissionA]);
  });

  it('requests concurrentes A/B conservan identidad y cachés separados', async () => {
    const a = await sessionA();
    const b = await login(`me-${tenantB}@test.example`, PASSWORD);
    const responses = await Promise.all(Array.from({ length: 6 }, () => Promise.all([me(a.accessToken), me(b.accessToken)])));
    for (const [ra, rb] of responses) {
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);
      expect(ra.body.data).toMatchObject({ id: userA, businessId: tenantA, roles: ['ME_A'], permissions: [permissionA] });
      expect(rb.body.data).toMatchObject({ id: userB, businessId: tenantB, roles: ['ME_B'], permissions: [permissionB] });
    }
    expect(await cacheKey(tenantA, userA)).not.toBe(await cacheKey(tenantB, userB));
  });

  it('runtime aplica RLS a lectura/escritura y rechaza asignación y sesión cross-tenant', async () => {
    const flags = await prisma.$queryRaw<Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(flags).toEqual([{ rolname: 'ferresaas_runtime', rolsuper: false, rolbypassrls: false }]);
    const invisible = await uow.run({ businessId: tenantA }, async tx => ({
      user: await tx.user.findUnique({ where: { id: userB } }),
      role: await tx.role.findUnique({ where: { id: roleB } }),
      assignment: await tx.userRole.findMany({ where: { userId: userB } }),
      updated: await tx.user.updateMany({ where: { id: userB }, data: { firstName: 'Intruso' } }),
    }));
    expect(invisible).toEqual({ user: null, role: null, assignment: [], updated: { count: 0 } });
    await expect(uow.run({ businessId: tenantA }, tx => tx.userRole.create({ data: { userId: userA, roleId: roleB } }))).rejects.toThrow();
    await expect(uow.run({ businessId: tenantA }, tx => tx.authSession.create({ data: {
      id: crypto.randomUUID(), userId: userB, businessId: tenantA, securityVersion: 1,
      tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60000), absoluteExpiresAt: new Date(Date.now() + 60000),
    } }))).rejects.toThrow();
    expect(await uow.run({ businessId: tenantA }, tx => tx.userRole.count({ where: { userId: userA, roleId: roleB } }))).toBe(0);
  });

  it('la misma conexión no conserva tenant tras commit ni error/rollback', async () => {
    const url = new URL(process.env.DATABASE_RUNTIME_URL!);
    url.searchParams.set('connection_limit', '1');
    const single = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const work = new TenantUnitOfWork(single);
    const inspect = (tx: Parameters<Parameters<typeof work.run>[1]>[0]) => tx.$queryRaw<Array<{ pid: number; tenant: string | null }>>`
      SELECT pg_backend_pid() AS pid, NULLIF(current_setting('app.business_id', true), '') AS tenant`;
    try {
      const committed = await work.run({ businessId: tenantA }, inspect);
      const clean = await work.runPublic(inspect);
      expect(clean).toEqual([{ pid: committed[0].pid, tenant: null }]);
      let rollbackPid: number | undefined;
      await expect(work.run({ businessId: tenantB }, async tx => {
        rollbackPid = (await inspect(tx))[0].pid;
        await tx.user.update({ where: { id: userB }, data: { firstName: 'Rollback' } });
        throw new Error('forced rollback');
      })).rejects.toThrow('forced rollback');
      expect(await work.runPublic(inspect)).toEqual([{ pid: rollbackPid, tenant: null }]);
      expect(await work.runPublic(tx => tx.user.findMany())).toEqual([]);
      expect(await work.run({ businessId: tenantB }, tx => tx.user.findUnique({ where: { id: userB } }))).toMatchObject({ firstName: 'Ana' });
      await expect(work.run({}, async () => null)).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED' });
    } finally {
      await single.$disconnect();
    }
  });

  it('Redis desconectado degrada a PostgreSQL, sin rehabilitar una sesión revocada', async () => {
    const session = await sessionA();
    const sid = verifyAccessToken(session.accessToken).sid;
    redis.disconnect();
    try {
      const result = await me(session.accessToken);
      expect(result.status).toBe(200);
      expect(result.body.data.permissions).toEqual([permissionA]);
      await uow.run({ businessId: tenantA }, tx => tx.authSession.update({ where: { id: sid }, data: { revokedAt: new Date() } }));
      expect((await me(session.accessToken)).status).toBe(401);
    } finally {
      await redis.connect();
    }
  });
});
