import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { hashOpaqueToken } from '../../../platform/security/jwt';
import { SessionStore } from '../infrastructure/session-store';
import { AuditStore } from '../../audit';

/** Revocación explícita y confirmada: no converge con "éxito siempre". */
export async function logout(refreshToken: string | undefined, ip?: string, userAgent?: string): Promise<{ message: string }> {
  if (!refreshToken) return { message: 'Logged out successfully' };
  await unitOfWork.runPublic(async tx => {
    const session = await tx.authSession.findUnique({ where: { tokenHash: hashOpaqueToken(refreshToken) } });
    if (!session || session.revokedAt) return;
    await unitOfWork.setTenant(tx, session.businessId);
    await new SessionStore(tx).revoke({
      id: session.id,
      businessId: session.businessId,
      userId: session.userId,
      securityVersion: session.securityVersion,
    });
    await new AuditStore(tx).log({
      businessId: session.businessId,
      userId: session.userId,
      action: 'LOGOUT',
      entity: 'auth',
      ip,
      userAgent,
    });
  });
  return { message: 'Logged out successfully' };
}
