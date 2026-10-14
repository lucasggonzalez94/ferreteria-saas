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
    // R1: la relectura bajo tenant repite la condición de activo, no confía en el bootstrap.
    const user = await tx.user.findFirst({ where: { id: resolved.id, isActive: true } });
    if (!user) return null;
    const token = generateRefreshToken();
    await tx.user.update({
      where: { id: user.id, isActive: true },
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
  // reintento del usuario lo reemplaza (self-service recovery). Un fallo del
  // proveedor NUNCA cambia la respuesta: responder distinto aquí filtraría
  // qué emails existen por status/latencia (no-enumeración, también en errores).
  if (delivery) {
    try {
      await email.sendPasswordResetEmail(delivery.to, delivery.token);
    } catch (error) {
      logger.error({ error, to: delivery.to }, 'Password reset email failed after commit');
    }
  }
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
  // Hashing fuera de la transacción (R2).
  const newHash = await hashPassword(newPassword);
  const notifyTo = await unitOfWork.runPublic(async tx => {
    const resolved = await new BootstrapStore(tx).resetByHash(tokenHash);
    if (!resolved) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    await unitOfWork.setTenant(tx, resolved.business_id);
    const user = await tx.user.findFirst({
      where: { resetToken: tokenHash, resetTokenExpiry: { gt: new Date() }, isActive: true },
    });
    if (!user) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    // Consumo atómico (R1): un solo request puede reemplazar el hash por null.
    // El predicado repite expiración y actividad en el propio write: un token que
    // vence o un usuario desactivado durante el hashing no consumen de todos modos.
    const consumed = await tx.user.updateMany({
      where: { id: user.id, resetToken: tokenHash, resetTokenExpiry: { gt: new Date() }, isActive: true },
      data: { password: newHash, resetToken: null, resetTokenExpiry: null },
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
  ctx: { businessId: string; actorUserId: string },
  input: { currentPassword: string; newPassword: string },
  ip?: string,
  userAgent?: string,
): Promise<{ message: string }> {
  const { currentPassword, newPassword } = input;
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw AppError.badRequest('INVALID_PASSWORD', 'New password does not meet requirements', {
      errors: validation.errors,
    });
  }

  // Fase 1: lectura rápida tenant-scoped, sin trabajo costoso dentro.
  const stored = await unitOfWork.run(ctx, async tx =>
    tx.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { id: true, email: true, password: true, businessId: true },
    }));
  if (!stored) throw AppError.notFound('USER_NOT_FOUND', 'User not found');

  // Verificación y hashing fuera de la transacción (R2).
  const ok = await verifyPassword(stored.password, currentPassword);
  if (!ok) throw AppError.unauthorized('INVALID_PASSWORD', 'Current password is incorrect');
  const same = await verifyPassword(stored.password, newPassword);
  if (same) throw AppError.badRequest('SAME_PASSWORD', 'New password must be different');
  const newHash = await hashPassword(newPassword);

  const notifyTo = await unitOfWork.run(ctx, async tx => {
    // R1 compare-and-set: si otra request cambió el hash entre la lectura y este
    // write, ninguna de las dos "gana" en silencio: la que pierde recibe conflicto.
    const updated = await tx.user.updateMany({
      where: { id: stored.id, password: stored.password },
      data: { password: newHash },
    });
    if (updated.count !== 1) {
      throw AppError.conflict('PASSWORD_CONFLICT', 'Password was changed concurrently; try again');
    }
    await new SessionStore(tx).revokeAllForUser(stored.id);
    await new AuditStore(tx).log({
      businessId: stored.businessId,
      userId: stored.id,
      action: 'PASSWORD_CHANGED',
      entity: 'auth',
      entityId: stored.id,
      ip,
      userAgent,
    });
    return stored.email;
  });
  // IO externo fuera de la transacción; misma política que resetPassword.
  try {
    await email.sendPasswordChangedEmail(notifyTo);
  } catch (error) {
    logger.error({ error, to: notifyTo }, 'Password changed notification failed after commit');
  }
  return { message: 'Password changed successfully' };
}
