import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { generateCsrfToken, hashOpaqueToken, issueAccessToken } from '../../../platform/security/jwt';
import { sessionPolicy } from '../domain/session-policy';
import { IdentityStore } from '../infrastructure/identity-store';
import { SessionStore } from '../infrastructure/session-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';
import type { AuthTokensResult } from './login';

/** Restauración al cargar la página: NO rota refresh ni re-setea cookie; sólo emite access+CSRF. */
// eslint-disable-next-line max-lines-per-function
export async function restoreSession(refreshToken: string): Promise<Omit<AuthTokensResult, 'refreshToken' | 'sessionAbsoluteExpiresAt'>> {
  const data = await unitOfWork.runPublic(async tx => {
    const tokenHash = hashOpaqueToken(refreshToken);
    const resolved = await new BootstrapStore(tx).sessionByHash(tokenHash);
    if (!resolved) throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');
    await unitOfWork.setTenant(tx, resolved.business_id);
    const session = await new SessionStore(tx).findActiveByHash(tokenHash);
    if (!session) throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');

    const identity = new IdentityStore(tx);
    const user = await identity.findUserByIdWithAccess(session.userId);
    if (!user || !user.isActive) throw AppError.unauthorized('USER_NOT_FOUND', 'User not found or inactive');
    if (session.securityVersion !== user.securityVersion) {
      throw AppError.unauthorized('TOKEN_REVOKED', 'Session version changed');
    }

    const roles: string[] = [];
    const permissions = new Set<string>();
    for (const userRole of user.roles) {
      roles.push(userRole.role.name);
      for (const rp of userRole.role.permissions) {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessId: user.businessId,
        roles,
        permissions: [...permissions],
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        timezone: user.business.timezone,
        logoUrl: user.business.logoUrl,
      },
      sessionId: session.id,
      securityVersion: user.securityVersion,
      authorizationVersion: user.business.authorizationVersion,
    };
  });

  // Emisión fuera de la transacción (R2).
  const accessToken = issueAccessToken(
    {
      sub: data.user.id,
      sid: data.sessionId,
      tid: data.user.businessId,
      sv: data.securityVersion,
      av: data.authorizationVersion,
      typ: 'access',
    },
    sessionPolicy.accessTokenSeconds,
  );
  const csrf = generateCsrfToken(refreshToken);

  return {
    user: data.user,
    business: data.business,
    accessToken,
    csrfToken: csrf.token,
    csrfHash: csrf.hash,
  };
}
