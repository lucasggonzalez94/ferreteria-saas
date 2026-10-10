import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword, verifyPassword } from '@/platform/security/passwords';
import { login } from '@/modules/identity/application/login';
import { updateProfile } from '@/modules/identity/application/update-profile';
import app from '@/app';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const emailA = `profile-a-${stamp}@test.example`;
const emailB = `profile-b-${stamp}@test.example`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const PASSWORD = 'Valid-password-123!';
let userA: string;

async function createIdentity(businessId: string, email: string) {
  const password = await hashPassword(PASSWORD);
  return uow.run({ businessId }, async tx => {
    await tx.business.create({ data: {
      id: businessId, name: 'Tenant profile', cuit: businessId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
      taxCondition: 'MONOTRIBUTO',
    } });
    return tx.user.create({ data: { businessId, email, password } });
  });
}

const origin = { Origin: 'http://localhost:3000' };

describe('AUTH-06 (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    userA = (await createIdentity(tenantA, emailA)).id;
    await createIdentity(tenantB, emailB);
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminPrisma.$disconnect();
  });

  it('actualiza nombres con trim, persiste apellido vacío como null y audita con ip/UA', async () => {
    const result = await updateProfile(
      { businessId: tenantA, actorUserId: userA },
      { firstName: '  Maria  ', lastName: '   ' },
      '10.3.3.3',
      'jest-profile',
    );
    expect(result).toMatchObject({ id: userA, email: emailA, firstName: 'Maria', lastName: null, businessId: tenantA });
    const audit = await uow.run({ businessId: tenantA }, tx =>
      tx.auditLog.findFirst({ where: { userId: userA, action: 'PROFILE_UPDATED' } }));
    expect(audit).toMatchObject({ entity: 'auth', entityId: userA, ip: '10.3.3.3', userAgent: 'jest-profile' });
  });

  it('aislamiento: el contexto del tenant B no alcanza al usuario de A (RLS)', async () => {
    // Escritura directa con contexto ajeno: RLS produce P2025 (0 filas).
    await expect(uow.run({ businessId: tenantB }, tx =>
      tx.user.update({ where: { id: userA }, data: { firstName: 'Intruso' } }),
    )).rejects.toMatchObject({ code: 'P2025' });
    // Caso de uso con actor ajeno al contexto: 404 sin tocar datos.
    await expect(updateProfile(
      { businessId: tenantB, actorUserId: userA },
      { firstName: 'Intruso' },
    )).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    const intact = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { firstName: true } }));
    expect(intact?.firstName).toBe('Maria');
  });

  it('rollback ante fallo de auditoría no persiste la actualización', async () => {
    await expect(uow.run({ businessId: tenantA }, async tx => {
      await tx.user.update({ where: { id: userA }, data: { firstName: 'Rolled' } });
      throw new Error('forced');
    })).rejects.toThrow('forced');
    const user = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findUnique({ where: { id: userA }, select: { firstName: true } }));
    expect(user?.firstName).toBe('Maria');
  });

  it('HTTP: PUT /profile exige CSRF y sesión, y valida forma (Zod)', async () => {
    // CSRF corre antes de authenticate en la cadena global: mutación sin headers → 403.
    const noCsrf = await request(app).put('/v1/auth/profile').set(origin).send({ firstName: 'X' });
    expect(noCsrf.status).toBe(403);

    const session = await login(emailA, PASSWORD);
    const csrf = { 'X-CSRF-Token': session.csrfToken, 'X-CSRF-Hash': session.csrfHash };
    const noAuth = await request(app).put('/v1/auth/profile').set({ ...csrf, ...origin }).send({ firstName: 'X' });
    expect(noAuth.status).toBe(401);

    const auth = { Authorization: `Bearer ${session.accessToken}`, ...csrf, ...origin };
    const empty = await request(app).put('/v1/auth/profile').set(auth).send({ firstName: '  ' });
    expect(empty.status).toBe(400);
    const wrongType = await request(app).put('/v1/auth/profile').set(auth).send({ firstName: 'Ana', lastName: 42 });
    expect(wrongType.status).toBe(400);

    const ok = await request(app).put('/v1/auth/profile').set(auth).send({ firstName: 'Ana', lastName: 'Paz' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id: userA, email: emailA, firstName: 'Ana', lastName: 'Paz' });
  });

  it('change-password: verifica la actual (regresión del orden invertido), revoca sesiones y audita', async () => {
    // Aislo el usuario del test de perfil: creo una identidad dedicada.
    const emailC = `profile-c-${stamp}@test.example`;
    const tenantC = crypto.randomUUID();
    const userC = (await createIdentity(tenantC, emailC)).id;
    try {
      const session = await login(emailC, PASSWORD);

      // Contraseña actual incorrecta: 401 sin efectos (sin refresh-retry del cliente aquí).
      const wrong = await request(app).post('/v1/auth/change-password')
        .set({ Authorization: `Bearer ${session.accessToken}`, 'X-CSRF-Token': session.csrfToken, 'X-CSRF-Hash': session.csrfHash, ...origin })
        .send({ currentPassword: 'Not-the-password-1!', newPassword: 'New-valid-456!' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.code).toBe('INVALID_PASSWORD');

      // Cambio exitoso: limpia cookie, revoca sesiones, audita y el access viejo muere.
      const ok = await request(app).post('/v1/auth/change-password')
        .set({ Authorization: `Bearer ${session.accessToken}`, 'X-CSRF-Token': session.csrfToken, 'X-CSRF-Hash': session.csrfHash, ...origin })
        .set('user-agent', 'jest-change')
        .send({ currentPassword: PASSWORD, newPassword: 'New-valid-456!' });
      expect(ok.status).toBe(200);
      expect(String(ok.headers['set-cookie'])).toContain('refreshToken=;');

      const [user, sessions, audit] = await uow.run({ businessId: tenantC }, async tx => [
        await tx.user.findUnique({ where: { id: userC }, select: { password: true } }),
        await tx.authSession.findMany({ where: { userId: userC } }),
        await tx.auditLog.findFirst({ where: { userId: userC, action: 'PASSWORD_CHANGED' } }),
      ]);
      expect(await verifyPassword(user!.password, 'New-valid-456!')).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.every(s => s.revokedAt !== null)).toBe(true);
      expect(audit).toMatchObject({ entity: 'auth', entityId: userC, userAgent: 'jest-change' });

      // El access token previo queda inválido porque su sesión fue revocada.
      const after = await request(app).put('/v1/auth/profile')
        .set({ Authorization: `Bearer ${session.accessToken}`, 'X-CSRF-Token': session.csrfToken, 'X-CSRF-Hash': session.csrfHash, ...origin })
        .send({ firstName: 'X' });
      expect(after.status).toBe(401);

      await expect(login(emailC, PASSWORD)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      await expect(login(emailC, 'New-valid-456!')).resolves.toMatchObject({ user: { id: userC } });
    } finally {
      await adminPrisma.business.deleteMany({ where: { id: tenantC } });
    }
  });

  it('la política de contraseña exige 8+ con minúscula, mayúscula, número y especial', async () => {
    const session = await login(emailB, PASSWORD);
    const auth = {
      Authorization: `Bearer ${session.accessToken}`,
      'X-CSRF-Token': session.csrfToken,
      'X-CSRF-Hash': session.csrfHash,
      ...origin,
    };
    const attempt = (newPassword: string) => request(app).post('/v1/auth/change-password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword });

    expect((await attempt('Sh0!')).status).toBe(400); // forma: < 8
    const noSpecial = await attempt('Password123');
    expect(noSpecial.status).toBe(400);
    expect(noSpecial.body.error.code).toBe('INVALID_PASSWORD');
    const noUpper = await attempt('password1!');
    expect(noUpper.status).toBe(400);

    const okPass = await attempt('Weak-ok-1!');
    expect(okPass.status).toBe(200); // 8+ cumple: 'Weak-ok-1!' tiene 10 caracteres con todo
  });
});
