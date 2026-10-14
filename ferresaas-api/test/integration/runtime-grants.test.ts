import { afterAll, describe, expect, it } from '@jest/globals';
import { prisma } from './setup';
import { closeDatabase } from '@/platform/database/client';

describe('Grants del rol runtime (PostgreSQL real)', () => {
  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
  });

  it('audit_logs es append-only para el runtime: UPDATE y DELETE son rechazados', async () => {
    // El chequeo de privilegio dispara aunque la sentencia no toque filas.
    await expect(prisma.$executeRawUnsafe('UPDATE audit_logs SET action = action WHERE false'))
      .rejects.toThrow(/permission denied/i);
    await expect(prisma.$executeRawUnsafe('DELETE FROM audit_logs WHERE false'))
      .rejects.toThrow(/permission denied/i);
  });

  it('audit_logs sigue permitiendo SELECT/INSERT al runtime (los flujos de auth auditan)', async () => {
    // INSERT lo cubren los flujos de integración (login/profile/register auditan);
    // acá basta evidenciar que SELECT no se revocó por accidente.
    await expect(prisma.$queryRawUnsafe('SELECT id FROM audit_logs LIMIT 1')).resolves.toBeDefined();
  });

  it('permissions es read-only para el runtime', async () => {
    await expect(prisma.$executeRawUnsafe('UPDATE permissions SET action = action WHERE false'))
      .rejects.toThrow(/permission denied/i);
  });

  it('email_jobs no es accesible por el runtime sin contexto tenant (RLS + FORCE, PR 3.1)', async () => {
    expect(await prisma.$queryRawUnsafe('SELECT id FROM email_jobs LIMIT 5')).toEqual([]);
    await expect(prisma.$executeRawUnsafe(`INSERT INTO email_jobs (id, "businessId", recipient, "firstName") VALUES ('x1','y1','a@b.c','n')`))
      .rejects.toThrow();
  });

  it('las funciones SECURITY DEFINER son owned por el definer dedicado (PR 3.2)', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{
      proname: string; owner: string; rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean;
    }>>(`
      SELECT p.proname, r.rolname AS owner, r.rolcanlogin, r.rolsuper, r.rolbypassrls
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_roles r ON r.oid = p.proowner
       WHERE n.nspname = 'private' AND p.prosecdef`);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const row of rows) {
      expect(row.owner).toBe('ferresaas_secdef');
      expect(row.rolcanlogin).toBe(false);
      expect(row.rolsuper).toBe(false);
      expect(row.rolbypassrls).toBe(true);
    }
  });

  it('el definer tiene USAGE explícito sobre public sin depender de PUBLIC', async () => {
    const rows = await prisma.$queryRaw<Array<{ granted: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_namespace n
        CROSS JOIN LATERAL aclexplode(n.nspacl) acl
        JOIN pg_roles r ON r.oid = acl.grantee
        WHERE n.nspname = 'public'
          AND r.rolname = 'ferresaas_secdef'
          AND acl.privilege_type = 'USAGE'
      ) AS granted`;
    expect(rows).toEqual([{ granted: true }]);
  });
});
