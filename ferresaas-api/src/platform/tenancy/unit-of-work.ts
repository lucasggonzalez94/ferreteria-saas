import type { Prisma } from '@prisma/client';
import { getPrismaBase } from '../database/client';
import { AppError } from '../errors';

export interface RequestContext {
  /** Tenant confiable derivado de la sesión. Nunca se toma del body. */
  businessId?: string;
  actorUserId?: string;
  requestId?: string;
  timezone?: string;
}

export type Transaction = Prisma.TransactionClient;

export type WorkUnit<T> = (tx: Transaction) => Promise<T>;

/**
 * Punto único para ejecutar trabajo con contexto de tenant en PostgreSQL.
 * - Establece app.business_id LOCAL a cada transacción.
 * - FALLA si el tenant es requerido y no está presente.
 * - Nunca ejecuta IO externo: sólo se abre/cierra la transacción aquí.
 */
type PrismaBase = ReturnType<typeof getPrismaBase>;

export class TenantUnitOfWork {
  constructor(private readonly prisma: PrismaBase = getPrismaBase()) {}

  /**
   * UoW con tenant obligatorio (todas las mutaciones de negocio).
   * Configura `app.business_id` local a la transacción para que RLS y los
   * defaults db generated (businessId en tablas dependientes) funcionen.
   */
  async run<T>(ctx: RequestContext, work: WorkUnit<T>): Promise<T> {
    if (!ctx.businessId) {
      throw AppError.unauthorized('TENANT_CONTEXT_REQUIRED', 'Tenant context is required');
    }
    return this.prisma.$transaction(async tx => {
      // LOCAL a la transacción: no contamina conexiones del pool.
      await tx.$executeRaw`SELECT set_config('app.business_id', ${ctx.businessId}, true)`;
      return work(tx);
    }, { maxWait: 10_000 });
  }

  /**
   * UoW sin tenant fijo: bootstrap (signup/login), workers globales o
   * operaciones cross-tenant explícitas. Internamente NO fija business_id;
   * las políticas de bootstrap o el WITH CHECK por tenant aplican.
   */
  async runPublic<T>(work: WorkUnit<T>): Promise<T> {
    return this.prisma.$transaction(work, { maxWait: 10_000 });
  }

  /** Define el tenant dentro de una transacción pública ya abierta. */
  async setTenant(tx: Transaction, businessId: string): Promise<void> {
    if (!businessId) throw AppError.unauthorized('TENANT_CONTEXT_REQUIRED', 'Tenant is empty');
    await tx.$executeRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
  }
}

export const unitOfWork = new TenantUnitOfWork();
