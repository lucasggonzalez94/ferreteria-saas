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
