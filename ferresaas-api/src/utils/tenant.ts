import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from './response';

const MODEL_KEYS = [
  'customer',
  'supplier',
  'product',
  'sale',
  'purchase',
  'financialAccount',
  'accountMovement',
  'check',
  'cashRegisterSession',
  'role',
  'permission',
  'user',
  'invoice',
  'invoiceJob',
  'discountApproval',
  'productCategory',
  'brand',
] as const;

type ModelKey = (typeof MODEL_KEYS)[number];

export type ModelName = ModelKey;

export interface TenantResourceOptions {
  model: ModelName;
  id: string;
  businessId: string;
  notFoundCode: string;
}

export async function findTenantResourceOrThrow<T>(
  prisma: PrismaClient,
  options: TenantResourceOptions
): Promise<T> {
  const { model, id, businessId, notFoundCode } = options;

  const result = await (prisma as any)[model].findFirst({
    where: {
      id,
      businessId,
    },
  });

  if (!result) {
    throw new AppError(404, notFoundCode, `${model} not found`);
  }

  return result as T;
}

export async function findTenantResourceByUniqueOrThrow<T>(
  prisma: PrismaClient,
  options: {
    model: ModelName;
    where: Record<string, unknown>;
    businessId: string;
    notFoundCode: string;
  }
): Promise<T> {
  const { model, where, businessId, notFoundCode } = options;

  const result = await (prisma as any)[model].findFirst({
    where: {
      ...where,
      businessId,
    },
  });

  if (!result) {
    throw new AppError(404, notFoundCode, `${model} not found`);
  }

  return result as T;
}

export function assertTenantOwnership<T extends { businessId: string }>(
  entity: T,
  businessId: string,
  errorCode = 'FORBIDDEN'
): void {
  if (entity.businessId !== businessId) {
    throw new AppError(403, errorCode, 'Access denied');
  }
}