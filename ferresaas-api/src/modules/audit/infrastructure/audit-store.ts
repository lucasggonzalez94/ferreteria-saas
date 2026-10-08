import type { Transaction } from '../../../platform/tenancy/unit-of-work';

/** Auditoría transaccional: obligatoria y dentro de la unidad de trabajo. */
export class AuditStore {
  constructor(private readonly tx: Transaction) {}

  log(input: {
    businessId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
  }) {
    return this.tx.auditLog.create({
      data: {
        businessId: input.businessId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
        after: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  logCreate(businessId: string, userId: string | undefined, entity: string, entityId: string, data: unknown) {
    return this.log({ businessId, userId, action: 'CREATE', entity, entityId, after: data });
  }
}
