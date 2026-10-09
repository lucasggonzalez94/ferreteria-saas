import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword } from '@/platform/security/passwords';
import { hashOpaqueToken, verifyAccessToken } from '@/platform/security/jwt';
import { login } from '@/modules/identity/application/login';
import { refreshSession } from '@/modules/identity/application/refresh-session';
import { restoreSession } from '@/modules/identity/application/restore-session';
import { logout } from '@/modules/identity/application/logout';
import { BootstrapStore } from '@/modules/identity/infrastructure/bootstrap-store';
import app from '@/app';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const emailA = `login-a-${stamp}@test.example`;
const emailB = `login-b-${stamp}@test.example`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
let userA: string;
let userB: string;

async function createIdentity(businessId: string, email: string) {
  const password = await hashPassword('Valid-password-123!');
  return uow.run({ businessId }, async tx => {
    await tx.business.create({ data: {
      id: businessId, name: 'Tenant login', cuit: businessId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
      taxCondition: 'MONOTRIBUTO',
    } });
    return tx.user.create({ data: { businessId, email, password } });
  });
}

describe('AUTH-02 (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    userA = (await createIdentity(tenantA, emailA)).id;
    userB = (await createIdentity(tenantB, emailB)).id;
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminPrisma.$disconnect();
  });

  it('bootstrap sólo resuelve credenciales puntuales y RLS impide lecturas directas sin contexto', async () => {
    const resolved = await uow.runPublic(tx => new BootstrapStore(tx).credentials(emailA));
    expect(resolved).toMatchObject({ id: userA, business_id: tenantA, active: true });
    const [users, sessions, businesses] = await uow.runPublic(tx => Promise.all([
      tx.user.findMany(), tx.authSession.findMany(), tx.business.findMany(),
    ]));
    expect(users).toEqual([]);
    expect(sessions).toEqual([]);
    expect(businesses).toEqual([]);
  });

  it('login persiste sesión y auditoría en A sin exponerla a B', async () => {
    const result = await login(emailA.toUpperCase(), 'Valid-password-123!');
    expect(result.user.businessId).toBe(tenantA);
    const claims = verifyAccessToken(result.accessToken);
    expect(claims).toMatchObject({ sub: userA, tid: tenantA, typ: 'access' });
    const hash = hashOpaqueToken(result.refreshToken);
    const [session, audit] = await uow.run({ businessId: tenantA }, async tx => [
      await tx.authSession.findUnique({ where: { tokenHash: hash } }),
      await tx.auditLog.findFirst({ where: { userId: userA, action: 'LOGIN' } }),
    ]);
    expect(session?.id).toBe(claims.sid);
    expect(audit).not.toBeNull();
    expect(await uow.run({ businessId: tenantB }, tx => tx.authSession.findUnique({ where: { tokenHash: hash } }))).toBeNull();
    expect(await uow.run({ businessId: tenantB }, tx => tx.auditLog.findFirst({ where: { id: audit!.id } }))).toBeNull();
  });

  it('HTTP devuelve cookie HttpOnly y respuesta no-store; access JWT autoriza una sesión vigente', async () => {
    const result = await request(app).post('/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: emailA, password: 'Valid-password-123!' });
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(String(result.headers['set-cookie'])).toContain('HttpOnly');
    expect(result.body.data.refreshToken).toBeUndefined();
    const me = await request(app).get('/v1/auth/me')
      .set('Authorization', `Bearer ${result.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.businessId).toBe(tenantA);
  });

  it('no crea sesión con contraseña incorrecta, inexistente o usuario inactivo', async () => {
    const count = await uow.run({ businessId: tenantB }, tx => tx.authSession.count());
    await expect(login(emailB, 'incorrect')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(login('missing@test.example', 'incorrect')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await uow.run({ businessId: tenantB }, tx => tx.user.update({ where: { id: userB }, data: { isActive: false } }));
    await expect(login(emailB, 'Valid-password-123!')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(await uow.run({ businessId: tenantB }, tx => tx.authSession.count())).toBe(count);
  });

  it('dos logins simultáneos generan sesiones independientes y no comparten tenant', async () => {
    const results = await Promise.all([
      login(emailA, 'Valid-password-123!'), login(emailA, 'Valid-password-123!'),
    ]);
    expect(results[0].refreshToken).not.toBe(results[1].refreshToken);
    expect(results.every(result => result.user.businessId === tenantA)).toBe(true);
    const fromB = await uow.run({ businessId: tenantB }, tx => tx.authSession.findMany());
    expect(fromB).toEqual([]);
  });

  it('restore/refresh/logout usan el tenant resuelto y revocan persistentemente', async () => {
    const first = await login(emailA, 'Valid-password-123!');
    expect((await restoreSession(first.refreshToken)).user.id).toBe(userA);
    const refreshed = await refreshSession(first.refreshToken);
    expect(refreshed.refreshToken).not.toBe(first.refreshToken);
    await logout(refreshed.refreshToken);
    await expect(restoreSession(refreshed.refreshToken)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('replay confirmado revoca la sesión sin revertir auditoría por el error HTTP', async () => {
    const first = await login(emailA, 'Valid-password-123!');
    await refreshSession(first.refreshToken);
    await uow.run({ businessId: tenantA }, tx => tx.consumedRefreshToken.update({
      where: { tokenHash: hashOpaqueToken(first.refreshToken) },
      data: { consumedAt: new Date(Date.now() - 10_000) },
    }));
    await expect(refreshSession(first.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
    const sessionId = verifyAccessToken(first.accessToken).sid;
    const [session, audit] = await uow.run({ businessId: tenantA }, async tx => [
      await tx.authSession.findUnique({ where: { id: sessionId } }),
      await tx.auditLog.findFirst({ where: { action: 'TOKEN_REPLAY_REVOKED', userId: userA }, orderBy: { createdAt: 'desc' } }),
    ]);
    expect(session?.revokedAt).not.toBeNull();
    expect(audit).not.toBeNull();
  });

  it('rollback, contexto ausente y FK cross-tenant mantienen el aislamiento', async () => {
    await expect(uow.run({} as never, async () => null)).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED' });
    const id = crypto.randomUUID();
    await expect(uow.run({ businessId: tenantA }, async tx => {
      await tx.authSession.create({ data: {
        id, businessId: tenantA, userId: userA, securityVersion: 1,
        tokenHash: hashOpaqueToken(id), expiresAt: new Date(Date.now() + 60000),
        absoluteExpiresAt: new Date(Date.now() + 60000),
      } });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await uow.run({ businessId: tenantA }, tx => tx.authSession.findUnique({ where: { id } }))).toBeNull();
    expect(await uow.runPublic(tx => tx.authSession.findUnique({ where: { id } }))).toBeNull();
    await expect(uow.run({ businessId: tenantA }, tx => tx.authSession.create({ data: {
      id: crypto.randomUUID(), businessId: tenantA, userId: userB, securityVersion: 1,
      tokenHash: hashOpaqueToken(crypto.randomUUID()), expiresAt: new Date(Date.now() + 60000),
      absoluteExpiresAt: new Date(Date.now() + 60000),
    } }))).rejects.toThrow();
  });
});
