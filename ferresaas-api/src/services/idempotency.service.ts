import { prisma } from '../config/database';
import { addHours } from 'date-fns';

export class IdempotencyService {
  /**
   * Verificar si una operación ya fue procesada
   */
  static async check(
    businessId: string,
    clientOperationId: string
  ): Promise<{ exists: boolean; response?: { status: number; body: unknown } }> {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { clientOperationId },
    });

    if (!existing) {
      return { exists: false };
    }

    // Verificar que pertenece al mismo business
    if (existing.businessId !== businessId) {
      return { exists: false };
    }

    return {
      exists: true,
      response: {
        status: existing.responseStatus,
        body: existing.responseBody,
      },
    };
  }

  /**
   * Guardar resultado de operación idempotente
   */
  static async save(
    businessId: string,
    clientOperationId: string,
    endpoint: string,
    responseStatus: number,
    responseBody: unknown
  ): Promise<void> {
    const expiresAt = addHours(new Date(), 48); // TTL: 48 horas

    await prisma.idempotencyKey.create({
      data: {
        businessId,
        clientOperationId,
        endpoint,
        responseStatus,
        responseBody: JSON.parse(JSON.stringify(responseBody)),
        expiresAt,
      },
    });
  }

  /**
   * Limpiar keys expiradas (ejecutar periódicamente)
   */
  static async cleanup(): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
