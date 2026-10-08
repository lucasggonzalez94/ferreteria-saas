import type { PrismaClient } from '@prisma/client';
import { closeDatabase, getPrismaBase } from '../platform/database/client';

// Back-compat durante la migración: el singleton vive en platform/database.
export const prisma: PrismaClient = getPrismaBase();

process.on('beforeExit', () => {
  void closeDatabase();
});
