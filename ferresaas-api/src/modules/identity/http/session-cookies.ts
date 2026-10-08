import type { Request, Response } from 'express';
import { env } from '../../../config/env';
import { AppError } from '../../../platform/errors';
import { sessionPolicy } from '../domain/session-policy';

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.clearCookie('refreshToken', { path: '/' });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.cookies.secure,
    sameSite: env.cookies.sameSite,
    path: '/',
    maxAge: sessionPolicy.absoluteDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/' });
}

/** Origen estricto para operaciones que crean o renuevan sesión. */
export function getValidatedOrigin(req: Request): void {
  const origin = req.get('origin') ?? req.get('referer');
  if (!origin || !origin.startsWith(env.app.frontendUrl)) {
    throw AppError.forbidden('INVALID_ORIGIN', 'Invalid request origin');
  }
}
