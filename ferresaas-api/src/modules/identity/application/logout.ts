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
    const bootstrap = new BootstrapStore(tx);
    let resolved = await bootstrap.sessionByHash(tokenHash);
    if (!resolved) {
      // El refresh puede estar recién rotado (otra tab corrió refresh antes):
      // el hash viejo figura como consumido → se resuelve y revoca la sesión igual.
      const consumed = await bootstrap.consumedByHash(tokenHash);
      if (!consumed) return;
      resolved = { id: consumed.session_id, business_id: consumed.business_id };
    }
    await unitOfWork.setTenant(tx, resolved.business_id);
    const session = await tx.authSession.findUnique({ where: { id: resolved.id } });
    if (!session || session.revokedAt) return;
    // R1: revoca sólo si sigue activa y audita únicamente cuando ESTE call revocó:
    // dos logouts simultáneos no duplican el evento.
    const revoked = await new SessionStore(tx).revoke({
      id: session.id,
      businessId: session.businessId,
      userId: session.userId,
      securityVersion: session.securityVersion,
    });
    if (!revoked) return;
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
