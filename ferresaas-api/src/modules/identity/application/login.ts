import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { verifyPassword } from '../../../platform/security/passwords';
import {
  generateCsrfToken,
  generateRefreshToken,
  hashOpaqueToken,
  issueAccessToken,
} from '../../../platform/security/jwt';
import { sessionPolicy } from '../domain/session-policy';
import { SessionStore } from '../infrastructure/session-store';
import { IdentityStore } from '../infrastructure/identity-store';
import { AuditStore } from '../../audit';

export interface AuthTokensResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    businessId: string;
    roles: string[];
    permissions: string[];
  };
  business: { id: string; name: string; timezone: string; logoUrl: string | null };
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  csrfHash: string;
}

export async function login(emailRaw: string, password: string, ip?: string, userAgent?: string): Promise<AuthTokensResult> {
  const email = emailRaw.trim().toLowerCase();
  return unitOfWork.runPublic(async tx => {
    const identity = new IdentityStore(tx);
    const user = await identity.findUserForCredentials(email);
    const valid = !user ? false : await verifyPassword(user.password, password);
    // Mismo error para inexistente/inactivo/inválido (anti-enumeración).
    if (!user || !user.isActive || !valid) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await unitOfWork.setTenant(tx, user.businessId);

    const sessionId = crypto.randomUUID();
    const refreshToken = generateRefreshToken();
    const sessions = new SessionStore(tx);
    await sessions.create({
      id: sessionId,
      businessId: user.businessId,
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshToken),
      securityVersion: user.securityVersion,
      ip,
      userAgent,
    });

    const audit = new AuditStore(tx);
    await audit.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'LOGIN',
      entity: 'auth',
      ip,
      userAgent,
    });

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
        sid: sessionId,
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
      refreshToken,
      csrfToken: csrf.token,
      csrfHash: csrf.hash,
    };
  });
}
