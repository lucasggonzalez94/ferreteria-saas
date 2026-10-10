import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyAccessToken } from './jwt';
import { AppError } from '../errors';
import { unitOfWork, type RequestContext } from '../tenancy/unit-of-work';
import { redisGet, redisSet, RedisUnavailableError } from '../cache/redis';
import { env } from '../../config/env';
import { AccessStore } from './infrastructure/access-store';

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

const authzSnapshotSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
type AuthzSnapshot = z.infer<typeof authzSnapshotSchema>;

function parseAuthzCache(cached: string): AuthzSnapshot | null {
  try {
    const result = authzSnapshotSchema.safeParse(JSON.parse(cached) as unknown);
    return result.success ? result.data : null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return null;
  }
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
  const cachedSnapshot = cached ? parseAuthzCache(cached) : null;
  if (cachedSnapshot) return cachedSnapshot;

  const snapshot = await unitOfWork.run({ businessId }, tx =>
    new AccessStore(tx).authorization(userId));

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
      const store = new AccessStore(tx);
      const businessId = await store.sessionTenant(payload.sid);
      if (businessId !== payload.tid) return null;
      await unitOfWork.setTenant(tx, businessId);
      return store.findActiveSession(payload);
    });
    if (!session || !session.user.isActive) {
      throw AppError.unauthorized('UNAUTHORIZED', 'Session is not active');
    }
    if (session.securityVersion !== payload.sv || session.user.securityVersion !== payload.sv) {
      throw AppError.unauthorized('TOKEN_REVOKED', 'Session version changed');
    }
    const authVersion = session.user.business.authorizationVersion;
    const businessTimezone = session.user.business.timezone;

    const authz = await loadAuthorization(session.businessId, session.userId, authVersion);

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
    req.timezone = businessTimezone;
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
