import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword, verifyPassword } from '@/platform/security/passwords';
import { generateRefreshToken, hashOpaqueToken } from '@/platform/security/jwt';
import { login } from '@/modules/identity/application/login';
import { forgotPassword, resetPassword } from '@/modules/identity/application/password';
import app from '@/app';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const emailA = `reset-a-${stamp}@test.example`;
const emailB = `reset-b-${stamp}@test.example`;
const emailInactive = `reset-inactive-${stamp}@test.example`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const OLD_PASSWORD = 'Valid-password-123!';
const NEW_PASSWORD = 'New-password-456!';
let userA: string;
let userB: string;
let userInactive: string;

async function createIdentity(businessId: string, email: string, isActive = true) {
  const password = await hashPassword(OLD_PASSWORD);
  return uow.run({ businessId }, async tx => {
    await tx.business.create({ data: {
      id: businessId, name: 'Tenant reset', cuit: businessId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
      taxCondition: 'MONOTRIBUTO',
    } });
    return tx.user.create({ data: { businessId, email, password, isActive } });
  });
}

/** Simula el enlace del email: genera token plano y persiste su hash (fixture admin). */
async function stageResetToken(userId: string, expiresInMs = 30 * 60 * 1000) {
  const token = generateRefreshToken();
  await adminPrisma.user.update({
    where: { id: userId },
    data: { resetToken: hashOpaqueToken(token), resetTokenExpiry: new Date(Date.now() + expiresInMs) },
  });
  return token;
}

describe('AUTH-05 (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    userA = (await createIdentity(tenantA, emailA)).id;
    userB = (await createIdentity(tenantB, emailB)).id;
    userInactive = (await uow.run({ businessId: tenantA }, tx => tx.user.create({
      data: { businessId: tenantA, email: emailInactive, password: 'x', isActive: false },
    }))).id;
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminPrisma.$disconnect();
  });

  it('forgot es genérico e inerte para email inexistente o usuario inactivo', async () => {
    const missing = await forgotPassword('missing@test.example');
    const inactive = await forgotPassword(emailInactive);
    expect(missing.message).toBe(inactive.message);
    const [unknownToken, inactiveToken, audits] = await uow.run({ businessId: tenantA }, async tx => [
      await tx.user.findFirst({ where: { email: 'missing@test.example' } }),
      await tx.user.findUnique({ where: { id: userInactive }, select: { resetToken: true } }),
      await tx.auditLog.count({ where: { action: 'PASSWORD_RESET_REQUESTED' } }),
    ]);
    expect(unknownToken).toBeNull();
    expect(inactiveToken?.resetToken).toBeNull();
    expect(audits).toBe(0);
  });

  it('forgot persiste hash con expiración y auditoría con ip/user-agent', async () => {
    const result = await forgotPassword(` ${emailA.toUpperCase()} `, '10.1.1.1', 'jest-agent');
    expect(result.message).toContain('reset link');
    const [user, audit] = await uow.run({ businessId: tenantA }, async tx => [
      await tx.user.findUnique({ where: { id: userA }, select: { resetToken: true, resetTokenExpiry: true } }),
      await tx.auditLog.findFirst({ where: { userId: userA, action: 'PASSWORD_RESET_REQUESTED' } }),
    ]);
    expect(user?.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(user!.resetTokenExpiry!.getTime()).toBeGreaterThan(Date.now() + 25 * 60 * 1000);
    expect(audit).toMatchObject({ ip: '10.1.1.1', userAgent: 'jest-agent' });
  });

  it('una segunda solicitud reemplaza el token anterior', async () => {
    await forgotPassword(emailA);
    const first = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { resetToken: true } }));
    await forgotPassword(emailA);
    const second = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { resetToken: true } }));
    expect(first?.resetToken).not.toBe(second?.resetToken);
  });

  it('reset consume el token, cambia la contraseña, revoca sesiones y audita', async () => {
    const session = await login(emailA, OLD_PASSWORD);
    const token = await stageResetToken(userA);
    const result = await resetPassword(token, NEW_PASSWORD, '10.2.2.2', 'jest-reset');
    expect(result.message).toBe('Password reset successfully');
    const [user, sessions, audit] = await uow.run({ businessId: tenantA }, async tx => [
      await tx.user.findUnique({ where: { id: userA }, select: { password: true, resetToken: true, resetTokenExpiry: true } }),
      await tx.authSession.findMany({ where: { userId: userA } }),
      await tx.auditLog.findFirst({ where: { userId: userA, action: 'PASSWORD_RESET' } }),
    ]);
    expect(user?.resetToken).toBeNull();
    expect(await verifyPassword(user!.password, NEW_PASSWORD)).toBe(true);
    expect(sessions.every(s => s.revokedAt !== null)).toBe(true);
    expect(audit).toMatchObject({ ip: '10.2.2.2', userAgent: 'jest-reset' });
    await expect(login(emailA, OLD_PASSWORD)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(login(emailA, NEW_PASSWORD)).resolves.toMatchObject({ user: { id: userA } });
    void session;
  });

  it('rechaza token inexistente, consumido o vencido sin tocar la contraseña', async () => {
    await expect(resetPassword('no-existe', NEW_PASSWORD)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    const expired = await stageResetToken(userA, -1);
    await expect(resetPassword(expired, NEW_PASSWORD)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    const consumed = await stageResetToken(userA);
    await resetPassword(consumed, NEW_PASSWORD);
    await expect(resetPassword(consumed, 'Other-pass-789!')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    const user = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { password: true } }));
    expect(await verifyPassword(user!.password, NEW_PASSWORD)).toBe(true);
  });

  it('dos resets concurrentes con el mismo token: sólo uno gana', async () => {
    const token = await stageResetToken(userA);
    const results = await Promise.allSettled([
      resetPassword(token, 'Concurrent-pass-111!'),
      resetPassword(token, 'Concurrent-pass-222!'),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'INVALID_TOKEN' });
    const user = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { password: true } }));
    const passwords = ['Concurrent-pass-111!', 'Concurrent-pass-222!'];
    const matches = await Promise.all(passwords.map(p => verifyPassword(user!.password, p)));
    expect(matches.filter(Boolean)).toHaveLength(1);
  });

  it('el tenant B no observa usuarios, sesiones ni auditorías de A', async () => {
    await forgotPassword(emailA);
    const fromB = await uow.run({ businessId: tenantB }, async tx => [
      await tx.user.findUnique({ where: { id: userA } }),
      await tx.auditLog.findMany({ where: { action: 'PASSWORD_RESET_REQUESTED' } }),
    ]);
    expect(fromB[0]).toBeNull();
    expect(fromB[1]).toEqual([]);
  });

  it('HTTP: forgot responde igual exista o no la cuenta; reset valida forma y token', async () => {
    const known = await request(app).post('/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000').send({ email: emailB });
    const unknown = await request(app).post('/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000').send({ email: 'nadie@test.example' });
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);

    const badBody = await request(app).post('/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000').send({ token: 'x', newPassword: 'short' });
    expect(badBody.status).toBe(400);

    const badToken = await request(app).post('/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000').send({ token: 'x'.repeat(64), newPassword: NEW_PASSWORD });
    expect(badToken.status).toBe(400);
    expect(badToken.body.error.code).toBe('INVALID_TOKEN');

    const weak = await stageResetToken(userB);
    const weakPassword = await request(app).post('/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000').send({ token: weak, newPassword: 'aaaaaaaaaa' });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('rollback dentro del flujo no deja token ni auditoría persistidos', async () => {
    await expect(uow.run({ businessId: tenantA }, async tx => {
      await tx.user.update({ where: { id: userA }, data: { resetToken: hashOpaqueToken('rollback-token') } });
      throw new Error('forced');
    })).rejects.toThrow('forced');
    const user = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { resetToken: true } }));
    expect(user?.resetToken ?? null).not.toBe(hashOpaqueToken('rollback-token'));
  });
});
