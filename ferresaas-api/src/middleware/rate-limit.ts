import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { redisClient } from '../config/redis';

// Rate limiter general
export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter estricto para login
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later',
    },
  },
  skipSuccessfulRequests: true,
});

// Rate limiter para reset password
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos
  message: {
    success: false,
    error: {
      code: 'RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later',
    },
  },
});
