import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { redisSlidingWindowHit, redisKey, RedisUnavailableError } from '../platform/cache/redis';
import { AppError } from '../platform/errors';

/**
 * Rate limiter general de /v1: ventana deslizante en Redis, distribuida entre
 * instancias (antes era en memoria por proceso vía express-rate-limit).
 * Misma política de fallo que los límites específicos de Identity: en
 * producción Redis es obligatorio y se falla cerrado (503); en dev/test sin
 * Redis se permite.
 */
export async function generalLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!env.redis.enabled) {
    if (env.app.isProduction) {
      next(new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable'));
      return;
    }
    next();
    return;
  }
  try {
    const now = Date.now();
    const hit = await redisSlidingWindowHit(redisKey(`rate:general:${req.ip}`), {
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.maxRequests,
      member: `${now}:${crypto.randomUUID()}`,
      now,
    });
    if (!hit.allowed) {
      res.setHeader('Retry-After', Math.ceil(env.rateLimit.windowMs / 1000));
      next(new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'));
      return;
    }
    next();
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      // Consistente con Identity: no degradar a sin protección.
      next(new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable'));
      return;
    }
    next(error);
  }
}

// Los límites de autenticación (login/signup/refresh/password) viven en
// modules/identity/http/rate-limit.ts y login-rate-limit.ts: ventanas
// deslizantes más estrictas, también fail-closed.
