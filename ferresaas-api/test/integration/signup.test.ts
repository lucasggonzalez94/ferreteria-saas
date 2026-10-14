import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import { prisma, adminPrisma } from './setup';
import { signupBusinessOwner } from '@/modules/identity';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { verifyAccessToken } from '@/platform/security/jwt';
import { AppError } from '@/platform/errors';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();

const base = {
  businessName: 'Ferreteria Int',
  businessCuit: '20307894565',
  taxCondition: 'MONOTRIBUTO' as const,
  ownerFirstName: 'Owner',
  email: 'owner-int@test.com',
  password: 'Password123!',
};

describe('signupBusinessOwner (PostgreSQL real, rol runtime)', () => {
  beforeAll(async () => {
    // Limpieza idempotente con el rol admin (bypass) para corridas repetidas.
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM businesses WHERE cuit IN ('20307894565','20111111112','20111111113')`,
    );
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crea negocio, roles, owner, sesión, auditorías y email job en una transacción', async () => {
    const result = await signupBusinessOwner({ ...base });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.roles).toEqual(['OWNER']);

    // Las verificaciones corren dentro del contexto del tenant creado:
    // fuera de él, RLS oculta las filas (comportamiento que propio test valida).
    const [roles, assignments, session, audits, emailJob] = await uow.run(
      { businessId: result.business.id },
      async tx => Promise.all([
        tx.role.count({ where: { businessId: result.business.id } }),
        tx.userRole.count({ where: { userId: result.user.id } }),
        tx.authSession.count({ where: { userId: result.user.id } }),
        tx.auditLog.count({ where: { businessId: result.business.id } }),
        tx.emailJob.count({ where: { recipient: base.email } }),
      ]),
    );
    expect(roles).toBe(3);
    expect(assignments).toBe(1);
    expect(session).toBe(1);
    expect(audits).toBe(2);
    expect(emailJob).toBe(1);
  });

  it('el claim av del JWT coincide con la authorizationVersion FINAL (post-triggers)', async () => {
    const result = await signupBusinessOwner({
      ...base,
      email: `av-${stamp}@test.example`,
      businessCuit: '20111111112',
    });
    const claims = verifyAccessToken(result.accessToken);
    const business = await uow.run({ businessId: result.business.id }, tx =>
      tx.business.findUniqueOrThrow({
        where: { id: result.business.id },
        select: { authorizationVersion: true },
      }));
    expect(claims.av).toBe(business.authorizationVersion);
    // Y es mayor que 1: los triggers de grants iniciales ya la subieron.
    expect(business.authorizationVersion).toBeGreaterThan(1);
  });

  it('rechaza email duplicado sin dejar filas', async () => {
    await expect(
      signupBusinessOwner({ ...base, businessCuit: '20111111112' }),
    ).rejects.toThrow(AppError);
    const dupes = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) n FROM businesses WHERE cuit='20111111112'`;
    expect(Number(dupes[0].n)).toBe(0);
  });

  it('rechaza CUIT inválido por dígito verificador', async () => {
    await expect(
      signupBusinessOwner({ ...base, email: 'otro@test.com', businessCuit: '20-30789456-2' }),
    ).rejects.toMatchObject({ code: 'INVALID_CUIT' });
  });

  it('rechaza contraseña débil', async () => {
    await expect(
      signupBusinessOwner({ ...base, email: 'otro3@test.com', businessCuit: '20-30789456-3', password: 'short' }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
  });
});
