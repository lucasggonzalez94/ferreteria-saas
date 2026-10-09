import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Verificación CSRF transversal (double-submit: token + HMAC del secreto).
 * Las rutas públicas sin sesión previa se declaran desde la composición (app.ts);
 * platform no conoce rutas de módulos.
 */
export const createCsrfMiddleware = (publicPaths: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    if (publicPaths.some(path => req.path.includes(path))) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      return next(AppError.forbidden('CSRF_TOKEN_MISSING', 'CSRF token is missing'));
    }

    const expectedHash = crypto
      .createHmac('sha256', env.csrf.secret)
      .update(csrfToken)
      .digest('hex');

    const providedHash = req.headers['x-csrf-hash'] as string;
    if (!providedHash) {
      return next(AppError.forbidden('CSRF_TOKEN_INVALID', 'CSRF token is invalid'));
    }

    const provided = Buffer.from(providedHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return next(AppError.forbidden('CSRF_TOKEN_INVALID', 'CSRF token is invalid'));
    }

    next();
  };
};
