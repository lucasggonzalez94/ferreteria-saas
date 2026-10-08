import { PrismaClient, type Prisma } from '@prisma/client';

let baseClient: PrismaClient | null = null;

/**
 * Cliente Prisma global. Se usa únicamente a través de la unidad de trabajo
 * tenant o de operaciones globales explícitas (catálogo de permisos,
 * migraciones internas). El código legacy incremental sigue importándolo
 * desde `config/database.ts` hasta completar el refactor por módulos.
 */
export function getPrismaBase(): PrismaClient {
  baseClient ??= new PrismaClient({
    // DATABASE_RUNTIME_URL (rol ferresaas_runtime, sin bypass de RLS) tiene
    // precedencia. DATABASE_URL es el usuario admin para migraciones/seed.
    datasources: {
      db: { url: process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL },
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
