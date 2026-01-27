import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class AuditService {
  /**
   * Registrar acción en audit log
   */
  static async log(params: {
    businessId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          businessId: params.businessId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          before: params.before ? JSON.parse(JSON.stringify(params.before)) : null,
          after: params.after ? JSON.parse(JSON.stringify(params.after)) : null,
          ip: params.ip,
          userAgent: params.userAgent,
        },
      });

      logger.debug(
        {
          businessId: params.businessId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
        },
        'Audit log created'
      );
    } catch (error) {
      // No fallar la operación principal si falla el audit log
      logger.error({ error, params }, 'Failed to create audit log');
    }
  }

  /**
   * Helper para auditar creación
   */
  static async logCreate(
    businessId: string,
    userId: string | undefined,
    entity: string,
    entityId: string,
    data: unknown,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      businessId,
      userId,
      action: 'CREATE',
      entity,
      entityId,
      after: data,
      ip,
      userAgent,
    });
  }

  /**
   * Helper para auditar actualización
   */
  static async logUpdate(
    businessId: string,
    userId: string | undefined,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      businessId,
      userId,
      action: 'UPDATE',
      entity,
      entityId,
      before,
      after,
      ip,
      userAgent,
    });
  }

  /**
   * Helper para auditar eliminación
   */
  static async logDelete(
    businessId: string,
    userId: string | undefined,
    entity: string,
    entityId: string,
    data: unknown,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      businessId,
      userId,
      action: 'DELETE',
      entity,
      entityId,
      before: data,
      ip,
      userAgent,
    });
  }
}
