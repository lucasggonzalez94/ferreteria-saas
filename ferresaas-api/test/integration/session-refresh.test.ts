import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword } from '@/platform/security/passwords';
import { hashOpaqueToken, verifyAccessToken } from '@/platform/security/jwt';
import { login } from '@/modules/identity/application/login';
import { refreshSession } from '@/modules/identity/application/refresh-session';
import { restoreSession } from '@/modules/identity/application/restore-session';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const emailC = `session-c-${stamp}@test.example`;
const emailD = `session-d-${stamp}@test.example`;
const tenantC = crypto.randomUUID();
const tenantD = crypto.randomUUID();
let userC: string;
let userD: string;

async function createIdentity(businessId: string, email: string) {
  const password = await hashPassword('Valid-password-123!');
  return uow.run({ businessId }, async tx => {
    await tx.business.create({ data: {
      id: businessId, name: 'Tenant session', cuit: businessId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
      taxCondition: 'MONOTRIBUTO',
    } });
    return tx.user.create({ data: { businessId, email, password } });
  });
}

describe('AUTH-03 (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    userC = (await createIdentity(tenantC, emailC)).id;
    userD = (await createIdentity(tenantD, emailD)).id;
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantC, tenantD] } } });
    await adminPrisma.$disconnect();
  });

  it('refresh rota una sola vez: consume el hash viejo, emite sid estable y audita', async () => {
    const first = await login(emailC, 'Valid-password-123!');
    const oldHash = hashOpaqueToken(first.refreshToken);
    const sid = verifyAccessToken(first.accessToken).sid;

    const rotated = await refreshSession(first.refreshToken, '10.0.0.1', 'jest');
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    expect(verifyAccessToken(rotated.accessToken).sid).toBe(sid);

    const [oldSession, consumed, audit] = await uow.run({ businessId: tenantC }, async tx => [
      await tx.authSession.findUnique({ where: { tokenHash: oldHash } }),
      await tx.consumedRefreshToken.findUnique({ where: { tokenHash: oldHash } }),
      await tx.auditLog.findFirst({ where: { userId: userC, action: 'REFRESH_TOKEN' } }),
    ]);
    expect(oldSession).toBeNull(); // el hash viejo ya no identifica la sesión
    expect(consumed?.sessionId).toBe(sid);
    expect(audit).not.toBeNull();

    // El hash viejo tampoco sirve para restaurar.
    await expect(restoreSession(first.refreshToken)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('segundo refresh inmediato con el hash consumido es conflicto reintentable sin revocar', async () => {
    const first = await login(emailC, 'Valid-password-123!');
    await refreshSession(first.refreshToken);

    await expect(refreshSession(first.refreshToken)).rejects.toMatchObject({
      code: 'CONCURRENT_SESSION_UPDATE',
      statusCode: 409,
    });

    const session = await uow.run({ businessId: tenantC }, tx =>
      tx.authSession.findUnique({ where: { id: verifyAccessToken(first.accessToken).sid } }));
    expect(session?.revokedAt).toBeNull();
  });

  it('replay posterior a la ventana de carrera revoca y confirma la auditoría en el commit', async () => {
    const first = await login(emailC, 'Valid-password-123!');
    const sid = verifyAccessToken(first.accessToken).sid;
    await refreshSession(first.refreshToken);
    await uow.run({ businessId: tenantC }, tx => tx.consumedRefreshToken.update({
      where: { tokenHash: hashOpaqueToken(first.refreshToken) },
      data: { consumedAt: new Date(Date.now() - 10_000) },
    }));

    await expect(refreshSession(first.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });

    const [session, audit] = await uow.run({ businessId: tenantC }, async tx => [
      await tx.authSession.findUnique({ where: { id: sid } }),
      await tx.auditLog.findFirst({ where: { userId: userC, action: 'TOKEN_REPLAY_REVOKED' } }),
    ]);
    expect(session?.revokedAt).not.toBeNull();
    expect(audit).not.toBeNull();
  });

  it('restore no rota ni consume: el mismo refresh sigue sirviendo después', async () => {
    const first = await login(emailC, 'Valid-password-123!');
    const restored = await restoreSession(first.refreshToken);
    expect(restored.user.id).toBe(userC);
    expect(restored.accessToken).toBeTruthy();

    const stillValid = await refreshSession(first.refreshToken);
    expect(stillValid.refreshToken).not.toBe(first.refreshToken);
  });

  it('rechaza refresh con usuario inactivo o securityVersion desactualizada sin consumir el token', async () => {
    const inactive = await login(emailD, 'Valid-password-123!');
    await uow.run({ businessId: tenantD }, tx =>
      tx.user.update({ where: { id: userD }, data: { isActive: false } }));
    await expect(refreshSession(inactive.refreshToken)).rejects.toMatchObject({ code: 'USER_INACTIVE' });
    await uow.run({ businessId: tenantD }, tx =>
      tx.user.update({ where: { id: userD }, data: { isActive: true } }));

    const drifted = await login(emailD, 'Valid-password-123!');
    await uow.run({ businessId: tenantD }, tx =>
      tx.user.update({ where: { id: userD }, data: { securityVersion: { increment: 1 } } }));
    await expect(refreshSession(drifted.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
    // Ninguno de los dos hashes fue consumido.
    expect(await uow.run({ businessId: tenantD }, tx => tx.consumedRefreshToken.count())).toBe(0);
  });

  it('rechaza sesión expirada por inactividad y por límite absoluto', async () => {
    const expired = await login(emailC, 'Valid-password-123!');
    await uow.run({ businessId: tenantC }, tx => tx.authSession.update({
      where: { tokenHash: hashOpaqueToken(expired.refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    }));
    await expect(refreshSession(expired.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });

    const absolute = await login(emailC, 'Valid-password-123!');
    await uow.run({ businessId: tenantC }, tx => tx.authSession.update({
      where: { tokenHash: hashOpaqueToken(absolute.refreshToken) },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    }));
    await expect(refreshSession(absolute.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('refreshes simultáneos de tenants distintos no se pisan ni exponen datos', async () => {
    const sessionC = await login(emailC, 'Valid-password-123!');
    const sessionD = await login(emailD, 'Valid-password-123!');

    const [rotatedC, rotatedD] = await Promise.all([
      refreshSession(sessionC.refreshToken),
      refreshSession(sessionD.refreshToken),
    ]);
    expect(verifyAccessToken(rotatedC.accessToken).tid).toBe(tenantC);
    expect(verifyAccessToken(rotatedD.accessToken).tid).toBe(tenantD);

    // Los tokens consumidos de C no son visibles desde el contexto de D.
    const consumedFromD = await uow.run({ businessId: tenantD }, tx =>
      tx.consumedRefreshToken.findUnique({ where: { tokenHash: hashOpaqueToken(sessionC.refreshToken) } }));
    expect(consumedFromD).toBeNull();
  });
});
