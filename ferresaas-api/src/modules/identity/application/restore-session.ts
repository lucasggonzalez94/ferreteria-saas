import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { generateCsrfToken, hashOpaqueToken, issueAccessToken } from '../../../platform/security/jwt';
import { sessionPolicy } from '../domain/session-policy';
import { IdentityStore } from '../infrastructure/identity-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';
import type { AuthTokensResult } from './login';

/** Restauración al cargar la página: NO rota refresh; sólo emite access+CSRF. */
export async function restoreSession(refreshToken: string): Promise<Omit<AuthTokensResult, 'refreshToken'>> {
  return unitOfWork.runPublic(async tx => {
    const resolved = await new BootstrapStore(tx).sessionByHash(hashOpaqueToken(refreshToken));
    if (!resolved) throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');
    await unitOfWork.setTenant(tx, resolved.business_id);
    const session = await tx.authSession.findFirst({
      where: {
        tokenHash: hashOpaqueToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        absoluteExpiresAt: { gt: new Date() },
      },
    });
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
      accessToken,
      csrfToken: csrf.token,
      csrfHash: csrf.hash,
    };
  });
}
