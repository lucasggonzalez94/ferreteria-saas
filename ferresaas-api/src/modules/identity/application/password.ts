import { addMinutes } from 'date-fns';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { hashPassword, verifyPassword } from '../../../platform/security/passwords';
import { generateRefreshToken, hashOpaqueToken } from '../../../platform/security/jwt';
import { validatePassword } from '../domain/password-policy';
import { AuditStore } from '../../audit';
import { SessionStore } from '../infrastructure/session-store';
import { EmailService } from '../../../services/email.service';

const email = new EmailService();

export async function forgotPassword(emailRaw: string): Promise<{ message: string }> {
  const emailAddress = emailRaw.trim().toLowerCase();
  const delivery = await unitOfWork.runPublic(async tx => {
    const user = await tx.user.findFirst({ where: { email: emailAddress } });
    if (!user) return null;
    await unitOfWork.setTenant(tx, user.businessId);
    const token = generateRefreshToken();
    await tx.user.update({
      where: { id: user.id },
      data: { resetToken: hashOpaqueToken(token), resetTokenExpiry: addMinutes(new Date(), 30) },
    });
    return { to: user.email, token };
  });
  // IO externo fuera de la transacción; el link ya quedó persistido.
  if (delivery) await email.sendPasswordResetEmail(delivery.to, delivery.token);
  return { message: 'If the email exists, a reset link will be sent' };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw AppError.badRequest('INVALID_PASSWORD', 'Password does not meet requirements', { errors: validation.errors });
  }
  const notifyTo = await unitOfWork.runPublic(async tx => {
    const user = await tx.user.findFirst({
      where: { resetToken: hashOpaqueToken(token), resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) throw AppError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
    await unitOfWork.setTenant(tx, user.businessId);
    await tx.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword), resetToken: null, resetTokenExpiry: null },
    });
    await new SessionStore(tx).revokeAllForUser(user.id);
    await new AuditStore(tx).log({ businessId: user.businessId, userId: user.id, action: 'PASSWORD_RESET', entity: 'auth' });
    return user.email;
  });
  await email.sendPasswordChangedEmail(notifyTo);
  return { message: 'Password reset successfully' };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const notifyTo = await unitOfWork.runPublic(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    const ok = await verifyPassword(user.password, currentPassword);
    if (!ok) throw AppError.unauthorized('INVALID_PASSWORD', 'Current password is incorrect');
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw AppError.badRequest('INVALID_PASSWORD', 'New password does not meet requirements', { errors: validation.errors });
    }
    const same = await verifyPassword(user.password, newPassword);
    if (same) throw AppError.badRequest('SAME_PASSWORD', 'New password must be different');
    await unitOfWork.setTenant(tx, user.businessId);
    await tx.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    await new SessionStore(tx).revokeAllForUser(user.id);
    await new AuditStore(tx).log({ businessId: user.businessId, userId: user.id, action: 'PASSWORD_CHANGED', entity: 'auth' });
    return user.email;
  });
  // IO externo fuera de la transacción.
  await email.sendPasswordChangedEmail(notifyTo);
  return { message: 'Password changed successfully' };
}
