import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword, verifyPassword } from '@/platform/security/passwords';
import { login } from '@/modules/identity/application/login';
import { registerUser } from '@/modules/identity/application/register-user';
import app from '@/app';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const PASSWORD = 'Valid-password-123!';
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const emailA = `reg-admin-a-${stamp}@test.example`;
const emailNoPermA = `reg-noperm-a-${stamp}@test.example`;
const emailB = `reg-admin-b-${stamp}@test.example`;

let actorA: string;
let roleCashierA: string;
let roleAdminB: string;

/** Tenant con roles ADMIN (users:create) y CASHIER (sin permiso) y dos usuarios. */
async function setupTenantA() {
  const password = await hashPassword(PASSWORD);
  return uow.run({ businessId: tenantA }, async tx => {
    await tx.business.create({
      data: {
        id: tenantA,
        name: 'Tenant A',
        cuit: tenantA.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
        taxCondition: 'MONOTRIBUTO',
      },
    });
    const permission = await adminPrisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'create' } },
      create: { resource: 'users', action: 'create' },
      update: {},
    });
    const adminRole = await tx.role.create({ data: { businessId: tenantA, name: 'ADMIN' } });
    const cashierRole = await tx.role.create({ data: { businessId: tenantA, name: 'CASHIER' } });
    await tx.rolePermission.create({
      data: { businessId: tenantA, roleId: adminRole.id, permissionId: permission.id },
    });
    const actor = await tx.user.create({ data: { businessId: tenantA, email: emailA, password } });
    await tx.userRole.create({ data: { businessId: tenantA, userId: actor.id, roleId: adminRole.id } });
    const noPerm = await tx.user.create({ data: { businessId: tenantA, email: emailNoPermA, password } });
    await tx.userRole.create({ data: { businessId: tenantA, userId: noPerm.id, roleId: cashierRole.id } });
    return { actor, adminRole, cashierRole };
  });
}

async function setupTenantB() {
  const password = await hashPassword(PASSWORD);
  return uow.run({ businessId: tenantB }, async tx => {
    await tx.business.create({
      data: {
        id: tenantB,
        name: 'Tenant B',
        cuit: tenantB.replace(/\D/g, '').padEnd(11, '2').slice(0, 11),
        taxCondition: 'MONOTRIBUTO',
      },
    });
    const role = await tx.role.create({ data: { businessId: tenantB, name: 'ADMIN' } });
    await tx.user.create({ data: { businessId: tenantB, email: emailB, password } });
    return role;
  });
}

const origin = { Origin: 'http://localhost:3000' };

async function sessionOf(email: string) {
  const session = await login(email, PASSWORD);
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'X-CSRF-Token': session.csrfToken,
    'X-CSRF-Hash': session.csrfHash,
    ...origin,
  };
}

describe('AUTH-07 registro administrativo (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    const a = await setupTenantA();
    actorA = a.actor.id;
    roleCashierA = a.cashierRole.id;
    roleAdminB = (await setupTenantB()).id;
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await adminPrisma.$disconnect();
  });

  it('crea usuario con roles, auditoría con actor e email de bienvenida durable en un solo tx', async () => {
    const result = await registerUser(
      { businessId: tenantA, actorUserId: actorA },
      {
        email: `  NUEVO-${stamp}@Test.Example `,
        username: `nuevo.${stamp.slice(0, 8)}`,
        password: 'Clave-nueva-1!',
        firstName: '  Ana  ',
        lastName: ' Paz ',
        roleIds: [roleCashierA, roleCashierA], // duplicado deliberado: se deduplica
      },
      '10.9.9.9',
      'jest-register',
    );
    expect(result).toMatchObject({
      email: `nuevo-${stamp}@test.example`,
      firstName: 'Ana',
      lastName: 'Paz',
      businessId: tenantA,
    });

    const state = await uow.run({ businessId: tenantA }, async tx => {
      const user = await tx.user.findUnique({
        where: { id: result.id },
        select: { password: true, roles: { select: { roleId: true } } },
      });
      const audit = await tx.auditLog.findFirst({
        where: { entity: 'users', entityId: result.id, action: 'CREATE' },
      });
      const job = await tx.emailJob.findFirst({ where: { recipient: result.email } });
      return { user, audit, job };
    });
    expect(await verifyPassword(state.user!.password, 'Clave-nueva-1!')).toBe(true);
    expect(state.user!.roles).toEqual([{ roleId: roleCashierA }]);
    expect(state.audit).toMatchObject({ userId: actorA, ip: '10.9.9.9', userAgent: 'jest-register' });
    expect(state.job).toMatchObject({ status: 'PENDING', firstName: 'Ana' });
  });

  it('rechaza roles de otro tenant y no persiste nada (rollback completo)', async () => {
    await expect(registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: `forbidden-${stamp}@test.example`, password: 'Clave-nueva-1!', roleIds: [roleAdminB] },
    )).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ROLES' });

    const leftover = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findFirst({ where: { email: `forbidden-${stamp}@test.example` } }));
    expect(leftover).toBeNull();
  });

  it('email tomado en OTRO tenant devuelve 409 sin filtrar su existencia (unicidad global bajo RLS)', async () => {
    await expect(registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: emailB, password: 'Clave-nueva-1!' },
    )).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_ERROR' });
  });

  it('email tomado en el MISMO tenant devuelve 409 EMAIL_EXISTS (pre-chequeo RLS-visible)', async () => {
    await expect(registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: emailA, password: 'Clave-nueva-1!' },
    )).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_EXISTS' });
  });

  it('username duplicado devuelve 409 USERNAME_EXISTS', async () => {
    const username = `dup.${stamp.slice(0, 8)}`;
    await registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: `u1-${stamp}@test.example`, username, password: 'Clave-nueva-1!' },
    );
    await expect(registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: `u2-${stamp}@test.example`, username, password: 'Clave-nueva-1!' },
    )).rejects.toMatchObject({ statusCode: 409, code: 'USERNAME_EXISTS' });
  });

  it('rechaza contraseña que no cumple la política de dominio', async () => {
    await expect(registerUser(
      { businessId: tenantA, actorUserId: actorA },
      { email: `weak-${stamp}@test.example`, password: 'sin-especial-123' },
    )).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PASSWORD' });
  });

  it('HTTP: CSRF y permiso users:create protegen el alta; 201 responde el contrato vigente', async () => {
    const payload = { email: `http-${stamp}@test.example`, password: 'Clave-nueva-1!' };

    const noCsrf = await request(app).post('/v1/auth/register').set(origin).send(payload);
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toContain('CSRF');

    // CSRF válido pero sin Bearer: authenticate rechaza antes de RBAC.
    const csrfOnly = await sessionOf(emailA);
    delete (csrfOnly as Record<string, string>).Authorization;
    const noAuth = await request(app).post('/v1/auth/register').set(csrfOnly).send(payload);
    expect(noAuth.status).toBe(401);

    const forbidden = await request(app).post('/v1/auth/register')
      .set(await sessionOf(emailNoPermA))
      .send(payload);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).post('/v1/auth/register').set(await sessionOf(emailA)).send(payload);
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ email: payload.email, businessId: tenantA });
    expect(ok.body.data.password).toBeUndefined();
  });

  it('HTTP: doble submit concurrente del mismo email converge en un único alta', async () => {
    const headers = await sessionOf(emailA);
    const payload = { email: `race-${stamp}@test.example`, password: 'Clave-nueva-1!' };
    const [first, second] = await Promise.all([
      request(app).post('/v1/auth/register').set(headers).send(payload),
      request(app).post('/v1/auth/register').set(headers).send(payload),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const created = await uow.run({ businessId: tenantA }, tx =>
      tx.user.findMany({ where: { email: payload.email }, select: { id: true } }));
    expect(created).toHaveLength(1);
  });
});
