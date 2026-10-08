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
import { AuditStore } from '../../audit';

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  csrfHash: string;
}

export async function refreshSession(refreshToken: string, ip?: string, userAgent?: string): Promise<RefreshedTokens> {
  return unitOfWork.runPublic(async tx => {
    const sessions = new SessionStore(tx);
    const tokenHash = hashOpaqueToken(refreshToken);

    const session = await tx.authSession.findUnique({ where: { tokenHash } });

    // Replay de token consumido: revocar sesión por seguridad.
    if (!session) {
      const consumed = await sessions.findConsumed(tokenHash);
      if (consumed) {
        const target = await tx.authSession.findUnique({ where: { id: consumed.sessionId } });
        if (target && target.revokedAt === null) {
          await unitOfWork.setTenant(tx, target.businessId);
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
        throw AppError.unauthorized('TOKEN_REUSE_DETECTED', 'Refresh token reuse detected');
      }
      throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    await unitOfWork.setTenant(tx, session.businessId);
    const now = new Date();
    if (session.revokedAt) throw AppError.unauthorized('TOKEN_REVOKED', 'Session revoked');
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      throw AppError.unauthorized('TOKEN_EXPIRED', 'Session expired');
    }

    const identity = new IdentityStore(tx);
    const user = await identity.findUserByIdWithAccess(session.userId);
    if (!user || !user.isActive) throw AppError.unauthorized('USER_INACTIVE', 'User not found or inactive');

    const nextToken = generateRefreshToken();
    const nextHash = hashOpaqueToken(nextToken);
    const idleExpiry = new Date(Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime()));

    await sessions.consumeToken(
      { id: session.id, businessId: session.businessId, userId: session.userId, securityVersion: session.securityVersion },
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
    return { accessToken, refreshToken: nextToken, csrfToken: csrf.token, csrfHash: csrf.hash };
  });
}
