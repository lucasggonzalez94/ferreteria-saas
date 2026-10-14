import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../platform/errors';
import { sendSuccess } from '../../../platform/http-respond';
import { RedisUnavailableError } from '../../../platform/cache/redis';
import { login } from '../application/login';
import { refreshSession } from '../application/refresh-session';
import { restoreSession } from '../application/restore-session';
import { logout } from '../application/logout';
import { clearLoginFailures, recordLoginFailure } from './login-rate-limit';
import {
  clearRefreshCookie,
  getValidatedOrigin,
  setRefreshCookie,
} from './session-cookies';
import { z } from 'zod';

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string() });

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    getValidatedOrigin(req);
    const input = loginSchema.parse(req.body);
    const result = await login(input.email, input.password, req.ip, req.get('user-agent'))
      .catch(async (error: unknown) => {
        // Conteo de fallos REALES (post verificación). Si Redis no permite
        // registrar, el login fallido no se procesa: fail-closed igual que
        // el limiter de entrada. Otros errores se propagan sin tocar.
        if (!(error instanceof AppError) || error.code !== 'INVALID_CREDENTIALS') throw error;
        try {
          await recordLoginFailure(req.ip, input.email);
        } catch (recordError) {
          if (recordError instanceof RedisUnavailableError) {
            throw new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable');
          }
          throw recordError;
        }
        throw error;
      });
    // Éxito: limpia fallos por cuenta e IP+cuenta; los contadores globales
    // de volumen/ráfaga por IP se mantienen hasta que la ventana deslice.
    await clearLoginFailures(req.ip, input.email);
    setRefreshCookie(res, result.refreshToken, result.sessionAbsoluteExpiresAt);
    sendSuccess(res, {
      user: result.user,
      business: result.business,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      csrfHash: result.csrfHash,
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  try {
    getValidatedOrigin(req);
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) throw AppError.unauthorized('NO_REFRESH_TOKEN', 'No refresh token provided');
    const result = await refreshSession(token, req.ip, req.get('user-agent'));
    setRefreshCookie(res, result.refreshToken, result.sessionAbsoluteExpiresAt);
    sendSuccess(res, {
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      csrfHash: result.csrfHash,
    });
  } catch (error) {
    next(error);
  }
}

export async function restoreSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) throw AppError.unauthorized('NO_REFRESH_TOKEN', 'No refresh token provided');
    const result = await restoreSession(token);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    await logout(token, req.ip, req.get('user-agent'));
    clearRefreshCookie(res);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
