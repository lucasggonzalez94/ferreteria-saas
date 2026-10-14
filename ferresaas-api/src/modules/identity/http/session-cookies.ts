import type { Request, Response } from 'express';
import { env } from '../../../config/env';
import { AppError } from '../../../platform/errors';
import { sessionPolicy } from '../domain/session-policy';

export function setRefreshCookie(res: Response, refreshToken: string, sessionAbsoluteExpiresAt: Date): void {
  const cookieOptions = { path: '/', ...(env.cookies.domain ? { domain: env.cookies.domain } : {}) };
  res.clearCookie('refreshToken', cookieOptions);
  const policyMs = sessionPolicy.absoluteDays * 24 * 60 * 60 * 1000;
  const sessionMs = Math.max(sessionAbsoluteExpiresAt.getTime() - Date.now(), 0);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.cookies.secure,
    sameSite: env.cookies.sameSite,
    ...cookieOptions,
    // La cookie nunca sobrevive a la vigencia absoluta de la sesión que transporta (R7).
    maxAge: Math.min(policyMs, sessionMs),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/', ...(env.cookies.domain ? { domain: env.cookies.domain } : {}) });
}

/** Origen estricto para operaciones que crean o renuevan sesión. */
export function getValidatedOrigin(req: Request): void {
  const origin = req.get('origin') ?? req.get('referer');
  let actualOrigin: string | undefined;
  try {
    if (origin) actualOrigin = new URL(origin).origin;
  } catch {
    // Formatos inválidos tampoco son un origen permitido.
  }
  if (actualOrigin !== new URL(env.app.frontendUrl).origin) {
    throw AppError.forbidden('INVALID_ORIGIN', 'Invalid request origin');
  }
}
