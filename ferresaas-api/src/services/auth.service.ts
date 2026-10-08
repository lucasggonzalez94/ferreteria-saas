import { unitOfWork } from '../platform/tenancy/unit-of-work';
import { AppError } from '../utils/response';
import { hashPassword } from '../platform/security/passwords';
import { validatePassword } from '../modules/identity/domain/password-policy';
import { AuditStore } from '../modules/audit/infrastructure/audit-store';
import { EmailService } from './email.service';

/**
 * AUTH legacy pendiente de migración (AUTH-06/07/08).
 * Las operaciones de sesión (signup/login/refresh/restore/logout/password)
 * están migradas a `modules/identity`.
 */
export class AuthService {
  private emailService = new EmailService();

  /** Alta de usuario dentro de un negocio (uso admin). Ruta protegida. */
  async register(params: {
    businessId: string;
    email: string;
    username?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    roleIds?: string[];
  }) {
    const validation = validatePassword(params.password);
    if (!validation.valid) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Password does not meet requirements', {
        errors: validation.errors,
      });
    }

    const email = params.email.trim().toLowerCase();
    const hashed = await hashPassword(params.password);

    return unitOfWork.run({ businessId: params.businessId }, async tx => {
      const exists = await tx.user.findFirst({ where: { email }, select: { id: true } });
      if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');

      if (params.roleIds?.length) {
        const roles = await tx.role.findMany({
          where: { id: { in: params.roleIds }, businessId: params.businessId },
        });
        if (roles.length !== params.roleIds.length) {
          throw new AppError(400, 'INVALID_ROLES', 'One or more roles do not belong to this business');
        }
      }

      const user = await tx.user.create({
        data: {
          businessId: params.businessId,
          email,
          username: params.username,
          password: hashed,
          firstName: params.firstName,
          lastName: params.lastName,
        },
      });

      if (params.roleIds?.length) {
        await tx.userRole.createMany({
          data: params.roleIds.map(roleId => ({ businessId: params.businessId, userId: user.id, roleId })),
        });
      }

      await new AuditStore(tx).logCreate(params.businessId, undefined, 'users', user.id, {
        email: user.email,
        username: user.username,
      });

      return user;
    }).then(async user => {
      // IO externo fuera de la transacción; un fallo de email no revierte el alta.
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.firstName || 'Usuario');
      } catch {
        // intencional: no bloquear el alta por el correo
      }
      return user;
    });
  }

  async updateProfile(businessId: string, userId: string, firstName: string, lastName?: string) {
    return unitOfWork.run({ businessId, actorUserId: userId }, async tx => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { firstName: firstName.trim(), lastName: lastName?.trim() || null },
        select: { id: true, email: true, firstName: true, lastName: true, businessId: true },
      });
      await new AuditStore(tx).log({
        businessId,
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'auth',
      });
      return user;
    });
  }
}
