import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { hashPassword } from '@/platform/security/passwords';
import { hashOpaqueToken } from '@/platform/security/jwt';
import { cleanupConsumedRefreshTokens } from '@/modules/identity/application/cleanup-consumed-tokens';

const uow = new TenantUnitOfWork(prisma);
const stamp = crypto.randomUUID();
const tenantId = crypto.randomUUID();

describe('Retención de consumed_refresh_tokens (PostgreSQL real)', () => {
  beforeAll(async () => {
    const password = await hashPassword('Valid-password-123!');
    await uow.run({ businessId: tenantId }, async tx => {
      await tx.business.create({ data: {
        id: tenantId, name: 'Tenant cleanup',
        cuit: tenantId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11), taxCondition: 'MONOTRIBUTO',
      } });
      const user = await tx.user.create({
        data: { businessId: tenantId, email: `cleanup-${stamp}@test.example`, password },
      });
      const session = await tx.authSession.create({ data: {
        id: crypto.randomUUID(), businessId: tenantId, userId: user.id, securityVersion: 1,
        tokenHash: hashOpaqueToken(`active-${stamp}`),
        expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000),
      } });
      // Uno vencido (borrable) y uno vigente (la ventana absoluta aún corre).
      await tx.consumedRefreshToken.create({ data: {
        businessId: tenantId, sessionId: session.id,
        tokenHash: hashOpaqueToken(`expired-${stamp}`), expiresAt: new Date(Date.now() - 1000),
      } });
      await tx.consumedRefreshToken.create({ data: {
        businessId: tenantId, sessionId: session.id,
        tokenHash: hashOpaqueToken(`fresh-${stamp}`), expiresAt: new Date(Date.now() + 3_600_000),
      } });
    });
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: tenantId } });
    await adminPrisma.$disconnect();
  });

  it('purga sólo los tokens cuya vigencia absoluta ya venció, vía capacidad privada', async () => {
    const purged = await cleanupConsumedRefreshTokens();
    expect(purged).toBeGreaterThanOrEqual(1);
    const remaining = await uow.run({ businessId: tenantId }, tx =>
      tx.consumedRefreshToken.findMany({ select: { tokenHash: true } }));
    const hashes = remaining.map(r => r.tokenHash);
    expect(hashes).not.toContain(hashOpaqueToken(`expired-${stamp}`));
    expect(hashes).toContain(hashOpaqueToken(`fresh-${stamp}`));
    // Idempotente: una segunda corrida no borra nada nuevo.
    await expect(cleanupConsumedRefreshTokens()).resolves.toBe(0);
  });
});
