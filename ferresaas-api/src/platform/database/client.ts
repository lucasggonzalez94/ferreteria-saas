import { PrismaClient, type Prisma } from '@prisma/client';

let baseClient: PrismaClient | null = null;

/**
 * Cliente Prisma global. Se usa únicamente a través de la unidad de trabajo
 * tenant o de operaciones globales explícitas (catálogo de permisos,
 * migraciones internas). El código legacy incremental sigue importándolo
 * desde `config/database.ts` hasta completar el refactor por módulos.
 */
export function getPrismaBase(): PrismaClient {
  if (!process.env.DATABASE_RUNTIME_URL) {
    throw new Error('DATABASE_RUNTIME_URL is required for the API runtime');
  }
  baseClient ??= new PrismaClient({
    // Nunca caer en DATABASE_URL (usuario de migraciones/seed) en runtime.
    datasources: {
      db: { url: process.env.DATABASE_RUNTIME_URL },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return baseClient;
}

export type Db = Prisma.TransactionClient | PrismaClient;

export async function closeDatabase(): Promise<void> {
  if (!baseClient) return;
  await baseClient.$disconnect();
  baseClient = null;
}

let runtimeRoleChecked = false;

/**
 * PR 3.3 (hardening): la variable exige el nombre, no el rol. Este chequeo
 * confirma contra el catálogo que la conexión runtime realmente usa un rol
 * limitado: sin superuser ni BYPASSRLS, porque ambos desactivan RLS en la
 * práctica. Se ejecuta una sola vez por proceso; falla el arranque si no.
 */
export async function assertRuntimeRole(): Promise<void> {
  if (runtimeRoleChecked) return;
  const rows = await getPrismaBase().$queryRaw<Array<{
    rolname: string; rolsuper: boolean; rolbypassrls: boolean;
  }>>`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  const role = rows[0];
  if (!role) {
    throw new Error(`DATABASE_RUNTIME_URL apunta a un rol inexistente en el catálogo: ${rows.length === 0}`);
  }
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `DATABASE_RUNTIME_URL usa el rol '${role.rolname}' con superuser=${role.rolsuper} bypassrls=${role.rolbypassrls}: ` +
      'eso anula RLS. El runtime debe ser un rol limitado (ver decisions/tenant-isolation.md).',
    );
  }
  runtimeRoleChecked = true;
}
