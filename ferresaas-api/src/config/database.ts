import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Singleton de Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.app.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.app.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
