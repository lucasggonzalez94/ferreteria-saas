import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { AppError } from '../errors';
import { unitOfWork, type RequestContext } from '../tenancy/unit-of-work';
import { redisGet, redisSet, RedisUnavailableError } from '../cache/redis';
import { env } from '../../config/env';

export interface AuthenticatedUser {
  id: string;
  businessId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    businessId?: string;
    timezone?: string;
    sessionId?: string;
  }
}

const AUTHZ_CACHE_TTL_SECONDS = 300;

interface AuthzSnapshot {
  roles: string[];
  permissions: string[];
  isActive: boolean;
}

function authzCacheKey(businessId: string, userId: string, version: number): string {
  return `ferresaas:authz:${businessId}:${userId}:${version}`;
}

async function loadAuthorization(
  businessId: string,
  userId: string,
  authorizationVersion: number,
): Promise<AuthzSnapshot> {
  const key = authzCacheKey(businessId, userId, authorizationVersion);
  let cached: string | null = null;
  if (env.redis.enabled) {
    try {
      cached = await redisGet(key);
    } catch (error) {
      if (!(error instanceof RedisUnavailableError)) throw error;
      // Caché auxiliar caído: fallback a PostgreSQL (documentado).
    }
  }
  if (cached) return JSON.parse(cached) as AuthzSnapshot;

  const snapshot = await unitOfWork.run({ businessId }, async tx => {
    const user = await tx.user.findFirst({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw AppError.unauthorized('USER_NOT_FOUND', 'User not found or inactive');
    const permissions = new Set<string>();
    const roles: string[] = [];
    for (const userRole of user.roles) {
      roles.push(userRole.role.name);
      for (const rp of userRole.role.permissions) {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }
    return { roles, permissions: [...permissions], isActive: user.isActive } satisfies AuthzSnapshot;
  });

  if (env.redis.enabled) {
    try {
      await redisSet(key, JSON.stringify(snapshot), AUTHZ_CACHE_TTL_SECONDS);
    } catch (error) {
      if (!(error instanceof RedisUnavailableError)) throw error;
    }
  }
  return snapshot;
}

/** Verdadera autorización: JWT + sesión vigente + versiones. PostgreSQL manda. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('UNAUTHORIZED', 'No token provided');
    }
    const payload = verifyAccessToken(header.slice(7));

    const session = await unitOfWork.runPublic(async tx => {
      return tx.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          businessId: payload.tid,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          absoluteExpiresAt: { gt: new Date() },
        },
        include: { user: { include: { business: true } } },
      });
    });
    if (!session || !session.user.isActive) {
      throw AppError.unauthorized('UNAUTHORIZED', 'Session is not active');
    }
    if (session.securityVersion !== payload.sv || session.user.securityVersion !== payload.sv) {
      throw AppError.unauthorized('TOKEN_REVOKED', 'Session version changed');
    }
    const authVersion = session.user.business?.authorizationVersion ?? 0;
    const businessTimezone = session.user.business?.timezone;

    const authz = await loadAuthorization(session.businessId, session.userId, authVersion);
    if (!authz.isActive) throw AppError.unauthorized('USER_INACTIVE', 'User is inactive');

    req.user = {
      id: session.userId,
      businessId: session.businessId,
      email: session.user.email,
      firstName: session.user.firstName ?? undefined,
      lastName: session.user.lastName ?? undefined,
      roles: authz.roles,
      permissions: authz.permissions,
    };
    req.businessId = session.businessId;
    req.timezone = businessTimezone ?? 'America/Buenos_Aires';
    req.sessionId = session.id;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermissions(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(AppError.unauthorized());
      return;
    }
    const owned = new Set(user.permissions);
    const granted = required.some(permission => owned.has(permission));
    if (!granted) {
      next(AppError.forbidden('FORBIDDEN', 'Missing required permission'));
      return;
    }
    next();
  };
}

export function contextOf(req: Request): RequestContext & { businessId: string } {
  if (!req.businessId) throw AppError.unauthorized('TENANT_CONTEXT_REQUIRED', 'Tenant context required');
  return {
    businessId: req.businessId,
    actorUserId: req.user?.id,
    requestId: req.headers['x-request-id'] as string | undefined,
    timezone: req.timezone,
  };
}
