import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { AuditStore } from '../../audit';

export interface UpdateProfileResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  businessId: string;
}

/**
 * Actualización del perfil propio (AUTH-06). El usuario objetivo proviene de la
 * sesión autenticada, nunca del body; RLS confina la escritura al tenant.
 * PUT es naturalmente idempotente: reintentos producen el mismo estado final.
 */
export async function updateProfile(
  ctx: { businessId: string; actorUserId: string },
  input: { firstName: string; lastName?: string },
  ip?: string,
  userAgent?: string,
): Promise<UpdateProfileResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName?.trim() || null;
  return unitOfWork.run(ctx, async tx => {
    let user;
    try {
      user = await tx.user.update({
        where: { id: ctx.actorUserId },
        data: { firstName, lastName },
        select: { id: true, email: true, firstName: true, lastName: true, businessId: true },
      });
    } catch (error) {
      // El usuario autenticado debe existir y pertenecer al tenant (RLS).
      if ((error as { code?: string }).code === 'P2025') {
        throw AppError.notFound('USER_NOT_FOUND', 'User not found');
      }
      throw error;
    }
    await new AuditStore(tx).log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PROFILE_UPDATED',
      entity: 'auth',
      entityId: user.id,
      ip,
      userAgent,
    });
    return user;
  });
}
