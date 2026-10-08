import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

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

// Los límites de autenticación (login/signup/refresh/password) viven en
// modules/identity/http/rate-limit.ts: son distribuidos y fallan cerrado.
