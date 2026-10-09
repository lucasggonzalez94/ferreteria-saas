import { addMinutes } from 'date-fns';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { hashPassword, verifyPassword } from '../../../platform/security/passwords';
import { generateRefreshToken, hashOpaqueToken } from '../../../platform/security/jwt';
import { logger } from '../../../config/logger';
import { validatePassword } from '../domain/password-policy';
import { AuditStore } from '../../audit';
import { EmailSender } from '../../notifications';
import { SessionStore } from '../infrastructure/session-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';

const email = new EmailSender();

const RESET_TOKEN_TTL_MINUTES = 30;
const GENERIC_FORGOT_MESSAGE = 'If the email exists, a reset link will be sent';

export async function forgotPassword(
  emailRaw: string,
  ip?: string,
  userAgent?: string,
): Promise<{ message: string }> {
  const emailAddress = emailRaw.trim().toLowerCase();
  const delivery = await unitOfWork.runPublic(async tx => {
    const resolved = await new BootstrapStore(tx).credentials(emailAddress);
    // No enumeración: cuenta inexistente o inactiva responden igual y sin efectos.
    if (!resolved || !resolved.active) return null;
    await unitOfWork.setTenant(tx, resolved.business_id);
    const user = await tx.user.findUnique({ where: { id: resolved.id } });
    if (!user) return null;
    const token = generateRefreshToken();
    await tx.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashOpaqueToken(token),
        resetTokenExpiry: addMinutes(new Date(), RESET_TOKEN_TTL_MINUTES),
      },
    });
    await new AuditStore(tx).log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'auth',
      entityId: user.id,
      ip,
      userAgent,
    });
    return { to: user.email, token };
  });
  // IO externo fuera de la transacción; el token ya quedó persistido y un
  // reintento del usuario lo reemplaza (self-service recovery).
  if (delivery) await email.sendPasswordResetEmail(delivery.to, delivery.token);
  return { message: GENERIC_FORGOT_MESSAGE };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  ip?: string,
  userAgent?: string,
): Promise<{ message: string }> {
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw AppError.badRequest('INVALID_PASSWORD', 'Password does not meet requirements', {
      errors: validation.errors,
    });
  }
  const tokenHash = hashOpaqueToken(token);
  const notifyTo = await unitOfWork.runPublic(async tx => {
    const resolved = await new BootstrapStore(tx).resetByHash(tokenHash);
    if (!resolved) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    await unitOfWork.setTenant(tx, resolved.business_id);
    const user = await tx.user.findFirst({
      where: { resetToken: tokenHash, resetTokenExpiry: { gt: new Date() }, isActive: true },
    });
    if (!user) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    // Consumo atómico: un solo request puede reemplazar el hash por null.
    // Dos resets concurrentes con el mismo token compiten aquí y sólo uno gana.
    const consumed = await tx.user.updateMany({
      where: { id: user.id, resetToken: tokenHash },
      data: { password: await hashPassword(newPassword), resetToken: null, resetTokenExpiry: null },
    });
    if (consumed.count !== 1) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    await new SessionStore(tx).revokeAllForUser(user.id);
    await new AuditStore(tx).log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'auth',
      entityId: user.id,
      ip,
      userAgent,
    });
    return user.email;
  });
  // La notificación no puede revertir la mutación ya confirmada: se registra y
  // se responde éxito; el cambio ya es efectivo aunque el aviso falle.
  try {
    await email.sendPasswordChangedEmail(notifyTo);
  } catch (error) {
    logger.error({ error, to: notifyTo }, 'Password changed notification failed after commit');
  }
  return { message: 'Password reset successfully' };
}

export async function changePassword(
  businessId: string,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const notifyTo = await unitOfWork.run({ businessId, actorUserId: userId }, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    const ok = await verifyPassword(user.password, currentPassword);
    if (!ok) throw AppError.unauthorized('INVALID_PASSWORD', 'Current password is incorrect');
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw AppError.badRequest('INVALID_PASSWORD', 'New password does not meet requirements', {
        errors: validation.errors,
      });
    }
    const same = await verifyPassword(user.password, newPassword);
    if (same) throw AppError.badRequest('SAME_PASSWORD', 'New password must be different');
    await tx.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    await new SessionStore(tx).revokeAllForUser(user.id);
    await new AuditStore(tx).log({
      businessId: user.businessId,
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'auth',
    });
    return user.email;
  });
  // IO externo fuera de la transacción; misma política que resetPassword.
  try {
    await email.sendPasswordChangedEmail(notifyTo);
  } catch (error) {
    logger.error({ error, to: notifyTo }, 'Password changed notification failed after commit');
  }
  return { message: 'Password changed successfully' };
}
