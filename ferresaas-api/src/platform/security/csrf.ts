import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { csrfHashFor, safeEqualHex } from './jwt';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Exención CSRF explícita: método + path exacto (relativo al mount de /v1)
 * o patrón anclado 1:1 con una route declarada. Nunca substring.
 */
export interface CsrfExemption {
  method: string;
  path: string | RegExp;
}

/**
 * Verificación CSRF transversal (double-submit ligado a sesión):
 * exige el par token/HMAC emitido al autenticar, calculado sobre el refresh
 * token de la cookie. Un par de otra sesión no valida; rotar el refresh lo mata.
 * Las rutas públicas sin sesión previa se declaran desde la composición (app.ts);
 * platform no conoce rutas de módulos.
 */
export const createCsrfMiddleware = (exemptions: CsrfExemption[]) => {
  const isExempt = (method: string, path: string): boolean =>
    exemptions.some(
      e =>
        e.method === method &&
        (typeof e.path === 'string' ? e.path === path : e.path.test(path)),
    );

  return (req: Request, _res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    if (SAFE_METHODS.has(method)) {
      return next();
    }

    if (isExempt(method, req.path)) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (!csrfToken) {
      return next(AppError.forbidden('CSRF_TOKEN_MISSING', 'CSRF token is missing'));
    }

    const sessionSecret = req.cookies?.refreshToken as string | undefined;
    const providedHash = req.headers['x-csrf-hash'] as string | undefined;
    if (!sessionSecret || !providedHash) {
      return next(AppError.forbidden('CSRF_TOKEN_INVALID', 'CSRF token is invalid'));
    }

    if (!safeEqualHex(providedHash, csrfHashFor(csrfToken, sessionSecret))) {
      return next(AppError.forbidden('CSRF_TOKEN_INVALID', 'CSRF token is invalid'));
    }

    next();
  };
};
