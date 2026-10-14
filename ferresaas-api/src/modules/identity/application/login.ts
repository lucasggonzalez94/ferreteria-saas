import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { AppError } from '../../../platform/errors';
import { hashPassword, verifyPassword } from '../../../platform/security/passwords';
import {
  generateCsrfToken,
  generateRefreshToken,
  hashOpaqueToken,
  issueAccessToken,
} from '../../../platform/security/jwt';
import { sessionPolicy } from '../domain/session-policy';
import { SessionStore } from '../infrastructure/session-store';
import { IdentityStore } from '../infrastructure/identity-store';
import { BootstrapStore } from '../infrastructure/bootstrap-store';
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
  /** Vigencia absoluta de la sesión: el controller la usa para acotar la cookie. */
  sessionAbsoluteExpiresAt: Date;
  csrfToken: string;
  csrfHash: string;
}

// Verificación de costo equivalente incluso si el email no existe.
let dummyHash: Promise<string> | undefined;

// TODO: Refactorizar funciones
// eslint-disable-next-line max-lines-per-function
export async function login(emailRaw: string, password: string, ip?: string, userAgent?: string): Promise<AuthTokensResult> {
  const email = emailRaw.trim().toLowerCase();
  const credentials = await unitOfWork.runPublic(tx => new BootstrapStore(tx).credentials(email));
  dummyHash ??= hashPassword('ferresaas-invalid-credential');
  const valid = await verifyPassword(credentials?.password_hash ?? await dummyHash, password);
  if (!credentials || !credentials.active || !valid) {
    throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // eslint-disable-next-line max-lines-per-function
  const data = await unitOfWork.run({ businessId: credentials.business_id, actorUserId: credentials.id }, async tx => {
    const identity = new IdentityStore(tx);
    const user = await identity.findUserByIdWithAccess(credentials.id);
    // Una desactivación o cambio de contraseña entre la verificación y el commit
    // no debe crear una sesión autorizada con credenciales obsoletas.
    if (!user || user.email !== email || !user.isActive || user.password !== credentials.password_hash) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const sessionId = crypto.randomUUID();
    const refreshToken = generateRefreshToken();
    const sessions = new SessionStore(tx);
    const createdSession = await sessions.create({
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
      sessionId,
      refreshToken,
      sessionAbsoluteExpiresAt: createdSession.absoluteExpiresAt,
      securityVersion: user.securityVersion,
      authorizationVersion: user.business.authorizationVersion,
    };
  });

  // Emisión fuera de la transacción (R2): la tx ya confirmó sesión y auditoría.
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
  const csrf = generateCsrfToken(data.refreshToken);

  return {
    user: data.user,
    business: data.business,
    accessToken,
    refreshToken: data.refreshToken,
    sessionAbsoluteExpiresAt: data.sessionAbsoluteExpiresAt,
    csrfToken: csrf.token,
    csrfHash: csrf.hash,
  };
}
