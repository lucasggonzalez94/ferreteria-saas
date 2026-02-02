import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/response';

export const verifyCsrf = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method.toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // Rutas públicas que no requieren CSRF (sin token aún)
  const publicPaths = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
  const isPublicPath = publicPaths.some(path => req.path.includes(path));

  if (isPublicPath) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;

  if (!csrfToken) {
    return next(new AppError(403, 'CSRF_TOKEN_MISSING', 'CSRF token is missing'));
  }

  const csrfSecret = env.csrf.secret;
  const expectedHash = crypto
    .createHmac('sha256', csrfSecret)
    .update(csrfToken)
    .digest('hex');

  const providedHash = req.headers['x-csrf-hash'] as string;

  if (!providedHash || providedHash !== expectedHash) {
    return next(new AppError(403, 'CSRF_TOKEN_INVALID', 'CSRF token is invalid'));
  }

  next();
};
