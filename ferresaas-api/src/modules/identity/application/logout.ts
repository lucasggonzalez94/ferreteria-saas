import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { hashOpaqueToken } from '../../../platform/security/jwt';
import { SessionStore } from '../infrastructure/session-store';
import { AuditStore } from '../../audit';
import { BootstrapStore } from '../infrastructure/bootstrap-store';

/** Revocación explícita y confirmada: no converge con "éxito siempre". */
export async function logout(refreshToken: string | undefined, ip?: string, userAgent?: string): Promise<{ message: string }> {
  if (!refreshToken) return { message: 'Logged out successfully' };
  const tokenHash = hashOpaqueToken(refreshToken);
  await unitOfWork.runPublic(async tx => {
    const resolved = await new BootstrapStore(tx).sessionByHash(tokenHash);
    if (!resolved) return;
    await unitOfWork.setTenant(tx, resolved.business_id);
    const session = await tx.authSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) return;
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
