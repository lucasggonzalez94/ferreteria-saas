import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import { prisma, adminPrisma } from './setup';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';
import { AppError } from '@/platform/errors';

const uow = new TenantUnitOfWork(prisma);

async function createTenant(name: string) {
  // La creación del tenant ocurre como bootstrap con contexto = nuevo tenant.
  const businessId = crypto.randomUUID();
  await uow.run({ businessId }, async tx => {
    await tx.business.create({
      data: { id: businessId, name, cuit: crypto.randomUUID().replace(/\D/g, '').padEnd(11, '7').slice(0, 11), taxCondition: 'MONOTRIBUTO' },
    });
  });
  return businessId;
}

async function createProductRaw(businessId: string, name: string) {
  return uow.run({ businessId }, tx =>
    tx.product.create({
      data: {
        businessId,
        internalSku: `SKU-${name}`,
        name,
        unit: 'u',
        cost: 1,
        price: 1,
        taxRate: 0,
      },
    }),
  );
}

describe('RLS tenant isolation (PostgreSQL real)', () => {
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    tenantA = await createTenant('Tenant A');
    tenantB = await createTenant('Tenant B');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  it('sin contexto tenant, las queries no ven filas de ningún tenant', async () => {
    await createProductRaw(tenantA, 'prod-a');
    const rows = await uow.runPublic(tx => tx.product.findMany());
    expect(rows.filter(p => p.businessId === tenantA)).toHaveLength(0);
  });

  it('run sin businessId falla antes de tocar la base', async () => {
    await expect(uow.run({} as any, async () => 1)).rejects.toThrow(AppError);
  });

  it('tenant A no ve productos de tenant B', async () => {
    await createProductRaw(tenantA, 'a-only');
    await createProductRaw(tenantB, 'b-only');
    const rowsA = await uow.run({ businessId: tenantA }, tx => tx.product.findMany());
    expect(rowsA.map(p => p.name).sort()).toEqual(expect.arrayContaining(['a-only']));
    expect(rowsA.some(p => p.businessId === tenantB)).toBe(false);
  });

  it('no se puede insertar una fila con businessId distinto al contexto', async () => {
    await expect(
      uow.run({ businessId: tenantA }, tx =>
        tx.product.create({
          data: { businessId: tenantB, internalSku: 'x-sku', name: 'x', unit: 'u', cost: 1, price: 1, taxRate: 0 },
        }),
      ),
    ).rejects.toThrow();
  });

  it('el contexto local no contamina el pool: una transacción posterior sin tenant no ve filas', async () => {
    await uow.run({ businessId: tenantA }, tx => tx.product.findMany());
    const rows = await uow.runPublic(tx => tx.product.findMany());
    expect(rows.some(p => p.businessId === tenantA || p.businessId === tenantB)).toBe(false);
  });

  it('update/delete cruzado es inalcanzable por RLS (0 filas afectadas)', async () => {
    const product = await createProductRaw(tenantB, 'victima');
    const updated = await uow.run({ businessId: tenantA }, tx =>
      tx.product.updateMany({ where: { id: product.id }, data: { name: 'hackeado' } }),
    );
    expect(updated.count).toBe(0);
    const intact = await uow.run({ businessId: tenantB }, tx =>
      tx.product.findUnique({ where: { id: product.id } }),
    );
    expect(intact?.name).toBe('victima');
  });

  it('todas las tablas públicas clasificadas tienen RLS habilitado', async () => {
    const missing = await adminPrisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('_prisma_migrations', 'permissions', 'email_jobs')
        AND NOT rowsecurity`;
    expect(missing).toEqual([]);
  });
});
