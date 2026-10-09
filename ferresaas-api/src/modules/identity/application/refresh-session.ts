import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import {
  generateCsrfToken,
  generateRefreshToken,
  hashOpaqueToken,
  issueAccessToken,
} from '../../../platform/security/jwt';
import { IDLE_MS, sessionPolicy } from '../domain/session-policy';
import { SessionStore } from '../infrastructure/session-store';
import { IdentityStore } from '../infrastructure/identity-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';
import { AuditStore } from '../../audit';

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  csrfHash: string;
}

export async function refreshSession(refreshToken: string, ip?: string, userAgent?: string): Promise<RefreshedTokens> {
  const result = await unitOfWork.runPublic(async tx => {
    const sessions = new SessionStore(tx);
    const tokenHash = hashOpaqueToken(refreshToken);
    const bootstrap = new BootstrapStore(tx);
    const resolved = await bootstrap.sessionByHash(tokenHash);
    if (resolved) await unitOfWork.setTenant(tx, resolved.business_id);
    const session = resolved ? await tx.authSession.findUnique({ where: { tokenHash } }) : null;

    // Replay de token consumido: revocar sesión por seguridad.
    if (!session) {
      const consumedBootstrap = await bootstrap.consumedByHash(tokenHash);
      if (consumedBootstrap) await unitOfWork.setTenant(tx, consumedBootstrap.business_id);
      const consumed = consumedBootstrap ? await sessions.findConsumed(tokenHash) : null;
      if (consumed) {
        if (Date.now() - consumed.consumedAt.getTime() < sessionPolicy.concurrentRaceMs) {
          throw AppError.retryableConflict('Concurrent refresh detected, retry with the new token');
        }
        const target = await tx.authSession.findUnique({ where: { id: consumed.sessionId } });
        if (target && target.revokedAt === null) {
          await sessions.revoke({ id: target.id, businessId: target.businessId, userId: target.userId, securityVersion: target.securityVersion });
          await new AuditStore(tx).log({
            businessId: target.businessId,
            userId: target.userId,
            action: 'TOKEN_REPLAY_REVOKED',
            entity: 'auth',
            ip,
            userAgent,
          });
        }
        // La revocación y auditoría deben confirmar ANTES de devolver el error.
        return { kind: 'replayed' as const };
      }
      throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    const now = new Date();
    if (session.revokedAt) throw AppError.unauthorized('TOKEN_REVOKED', 'Session revoked');
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      throw AppError.unauthorized('TOKEN_EXPIRED', 'Session expired');
    }

    const identity = new IdentityStore(tx);
    const user = await identity.findUserByIdWithAccess(session.userId);
    if (!user || !user.isActive) throw AppError.unauthorized('USER_INACTIVE', 'User not found or inactive');
    if (session.securityVersion !== user.securityVersion) {
      throw AppError.unauthorized('TOKEN_REVOKED', 'Session version changed');
    }

    const nextToken = generateRefreshToken();
    const nextHash = hashOpaqueToken(nextToken);
    const idleExpiry = new Date(Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime()));

    await sessions.consumeToken(
      { id: session.id, businessId: session.businessId, userId: session.userId,
        securityVersion: session.securityVersion, absoluteExpiresAt: session.absoluteExpiresAt },
      tokenHash,
    );
    const rotated = await sessions.rotate(tokenHash, nextHash, idleExpiry, ip, userAgent);
    if (!rotated) throw AppError.retryableConflict('Concurrent refresh detected, retry with the new token');

    await new AuditStore(tx).log({
      businessId: session.businessId,
      userId: session.userId,
      action: 'REFRESH_TOKEN',
      entity: 'auth',
      ip,
      userAgent,
    });

    const accessToken = issueAccessToken(
      {
        sub: user.id,
        sid: session.id,
        tid: user.businessId,
        sv: user.securityVersion,
        av: user.business.authorizationVersion,
        typ: 'access',
      },
      sessionPolicy.accessTokenSeconds,
    );
    const csrf = generateCsrfToken();
    return { kind: 'tokens' as const, accessToken, refreshToken: nextToken, csrfToken: csrf.token, csrfHash: csrf.hash };
  });
  if (result.kind === 'replayed') {
    throw AppError.unauthorized('TOKEN_REUSE_DETECTED', 'Refresh token reuse detected');
  }
  return result;
}
