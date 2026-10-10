import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { hashPassword } from '../../../platform/security/passwords';
import { validatePassword } from '../domain/password-policy';
import { AuditStore } from '../../audit';
import { EmailJobStore } from '../../notifications';

export interface RegisterUserInput {
  email: string;
  username?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roleIds?: string[];
}

export interface RegisterUserResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  businessId: string;
}

/**
 * Alta administrativa de usuario dentro del tenant del actor (AUTH-07).
 * El tenant y el actor provienen de la sesión, nunca del body.
 * Usuario + roles + auditoría + email de bienvenida durable confirman o
 * revierten juntos en la misma unidad de trabajo (sin más persistencia parcial).
 *
 * Email y username son únicos GLOBALES por decisión de tenant-isolation; bajo
 * RLS el tenant no ve usuarios de otros negocios, por lo que la unicidad la
 * garantiza la constraint y se traduce P2002 al error de negocio (válido
 * también para la carrera de doble submit).
 */
export async function registerUser(
  ctx: { businessId: string; actorUserId: string },
  input: RegisterUserInput,
  ip?: string,
  userAgent?: string,
): Promise<RegisterUserResult> {
  const validation = validatePassword(input.password);
  if (!validation.valid) {
    throw AppError.badRequest('INVALID_PASSWORD', 'Password does not meet requirements', {
      errors: validation.errors,
    });
  }

  const email = input.email.trim().toLowerCase();
  const roleIds = [...new Set(input.roleIds ?? [])];
  const hashed = await hashPassword(input.password);

  const username = input.username?.trim() || null;

  return unitOfWork.run(ctx, async tx => {
    // Pre-chequeo confinado por RLS: preciso dentro del tenant. La unicidad
    // GLOBAL sigue garantizada por las constraints; un duplicado cross-tenant o
    // una carrera llegan al P2002 y se responden como 409 genérico (sin filtrar
    // la existencia del email/username en otros negocios).
    const emailTaken = await tx.user.findFirst({ where: { email }, select: { id: true } });
    if (emailTaken) throw AppError.conflict('EMAIL_EXISTS', 'Email already registered');
    if (username) {
      const usernameTaken = await tx.user.findFirst({ where: { username }, select: { id: true } });
      if (usernameTaken) throw AppError.conflict('USERNAME_EXISTS', 'Username already registered');
    }

    if (roleIds.length > 0) {
      // RLS confina la lectura al tenant del contexto: un rol ajeno falta.
      const roles = await tx.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } });
      if (roles.length !== roleIds.length) {
        throw AppError.badRequest('INVALID_ROLES', 'One or more roles do not belong to this business');
      }
    }

    let user;
    try {
      user = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          businessId: ctx.businessId,
          email,
          username,
          password: hashed,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
        },
      });
    } catch (error) {
      // Carrera o duplicado cross-tenant (RLS oculta la fila al pre-chequeo y
      // el driver no informa el campo violado): conflicto genérico.
      if ((error as { code?: string }).code === 'P2002') {
        throw AppError.conflict('DUPLICATE_ERROR', 'Duplicate value');
      }
      throw error;
    }

    if (roleIds.length > 0) {
      await tx.userRole.createMany({
        data: roleIds.map(roleId => ({ businessId: ctx.businessId, userId: user.id, roleId })),
      });
    }

    await new AuditStore(tx).log({
      businessId: ctx.businessId,
      userId: ctx.actorUserId,
      action: 'CREATE',
      entity: 'users',
      entityId: user.id,
      after: { email: user.email, username: user.username },
      ip,
      userAgent,
    });

    // Bienvenida durable: sobrevive a una caída del proceso tras el commit.
    await new EmailJobStore(tx).enqueue({
      id: crypto.randomUUID(),
      businessId: ctx.businessId,
      recipient: user.email,
      firstName: user.firstName ?? 'Usuario',
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      businessId: user.businessId,
    };
  });
}
