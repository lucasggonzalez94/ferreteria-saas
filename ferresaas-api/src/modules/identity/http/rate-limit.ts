import type { Request, Response, NextFunction } from 'express';
import { env } from '../../../config/env';
import { redisRateLimitHit, RedisUnavailableError } from '../../../platform/cache/redis';
import { AppError } from '../../../platform/errors';

interface RateRule {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
  errorCode: string;
}

/** Rate limit distribuido sobre Redis (contador por ventana, primer hit fija TTL). */
function distributedLimiter(rule: RateRule) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!env.redis.enabled) {
      // Fuera de producción sin Redis: se permite pero se registra.
      if (env.app.isProduction) {
        next(new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable'));
        return;
      }
      next();
      return;
    }
    try {
      const key = `ferresaas:rate:${rule.keyPrefix}:${req.ip}`;
      const count = await redisRateLimitHit(key, rule.windowSeconds);
      if (count > rule.max) {
        next(new AppError(429, rule.errorCode, 'Too many attempts, please try again later'));
        return;
      }
      next();
    } catch (error) {
      if (error instanceof RedisUnavailableError) {
        // El límite de auth no se desactiva: falla cerrado.
        next(new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable'));
        return;
      }
      next(error);
    }
  };
}

export const signupRateLimiter = distributedLimiter({
  windowSeconds: 3600, max: 5, keyPrefix: 'signup', errorCode: 'SIGNUP_RATE_LIMIT_EXCEEDED',
});
export const loginRateLimiter = distributedLimiter({
  windowSeconds: 900, max: 5, keyPrefix: 'login', errorCode: 'LOGIN_RATE_LIMIT_EXCEEDED',
});
export const refreshRateLimiter = distributedLimiter({
  windowSeconds: 300, max: 10, keyPrefix: 'refresh', errorCode: 'REFRESH_RATE_LIMIT_EXCEEDED',
});
export const resetPasswordRateLimiter = distributedLimiter({
  windowSeconds: 3600, max: 3, keyPrefix: 'reset-password', errorCode: 'RESET_RATE_LIMIT_EXCEEDED',
});
