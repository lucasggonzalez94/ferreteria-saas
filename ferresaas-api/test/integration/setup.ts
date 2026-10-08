/**
 * Tests de integración contra PostgreSQL real (docker-compose.integration.yml).
 * Se ejecutan con la DATABASE_URL apuntando al usuario runtime limitado,
 * de modo que RLS aplica como en producción. Run: npm run test:integration
 */
import { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-min-32-chars!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-min-32-chars!!';
process.env.CSRF_SECRET = 'test-csrf-secret-key-min-32-chars!!!';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';
process.env.REDIS_ENABLED = 'false';
// La conexión de migraciones (admin) sólo para setup; runtime usa runtime role.
// El client de platform usa DATABASE_RUNTIME_URL (rol limitado) si existe;
// el rol admin sólo se usa para la limpieza de fixtures entre corridas.
process.env.DATABASE_RUNTIME_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ferresaas_runtime:runtime_test_password@localhost:55432/ferresaas_test';
process.env.DATABASE_URL = process.env.DATABASE_RUNTIME_URL;
process.env.ADMIN_DATABASE_URL =
  process.env.ADMIN_DATABASE_URL ??
  'postgresql://integration:integration@localhost:55432/ferresaas_test';

export const prisma = new PrismaClient();
export const adminPrisma = new PrismaClient({
  datasources: { db: { url: process.env.ADMIN_DATABASE_URL } },
});
