import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import {
  redisSlidingWindowHit,
  redisSlidingWindowStatus,
  redisSlidingWindowAdd,
  redisDel,
  redisKey,
  RedisUnavailableError,
} from '../../../platform/cache/redis';
import { AppError } from '../../../platform/errors';

/**
 * Rate limiting multidimensional del login (ventanas deslizantes en Redis):
 *
 * 1. Volumen por IP: toda request cuenta (60/15 min) y hay límite de ráfaga
 *    (15/min). Protege contra fuerza bruta y password spraying distribuidos
 *    por cuenta. Un login exitoso NO reinicia estos contadores.
 * 2. Fallos por cuenta: pasado el umbral (5/15 min) se aplica backoff
 *    progresivo (base * 2^exceso, acotado). Nunca es un bloqueo absoluto:
 *    el usuario legítimo espera retryAfterSeconds y puede entrar, así un
 *    atacante no logra un DoS dirigido permanente con sólo conocer el email.
 * 3. Fallos por IP+cuenta: umbral duro (5/15 min) que afecta sólo a esa
 *    combinación, sin perjudicar a otros empleados de la misma red.
 *
 * Los fallos se registran en el controller tras la verificación real de
 * credenciales: los intentos ya rechazados por estos controles no vuelven a
 * contar (no extienden el castigo) y el email nunca se guarda en texto plano:
 * la key deriva con HMAC y separación de dominio.
 */

function accountIdentifier(email: string): string {
  return crypto
    .createHmac('sha256', env.csrf.secret)
    .update('login-rate|' + email.trim().toLowerCase())
    .digest('hex');
}

function requestMember(now: number): string {
  return `${now}:${crypto.randomUUID()}`;
}

function extractEmail(req: Request): string | null {
  const body = req.body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' && body.email.length > 0 ? body.email.trim().toLowerCase() : null;
}

function unavailable(): AppError {
  return new AppError(503, 'RATE_LIMIT_UNAVAILABLE', 'Rate limiting backend unavailable');
}

function deny(res: Response, next: NextFunction, code: string, retryAfterSeconds?: number): void {
  if (retryAfterSeconds !== undefined) res.setHeader('Retry-After', Math.ceil(retryAfterSeconds));
  next(new AppError(429, code, 'Too many attempts, please try again later', { retryAfterSeconds }));
}

export async function loginRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Igual que el resto de los limiters: fuera de producción sin Redis se
  // permite; en producción Redis es obligatorio y se falla cerrado.
  if (!env.redis.enabled) {
    if (env.app.isProduction) {
      next(unavailable());
      return;
    }
    next();
    return;
  }
  try {
    const cfg = env.rateLimit.login;
    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    const volume = await redisSlidingWindowHit(
      redisKey(`login:ip:vol:${ip}`), { windowMs: cfg.ipWindowMs, max: cfg.ipMax, member: requestMember(now), now });
    if (!volume.allowed) {
      deny(res, next, 'LOGIN_IP_RATE_LIMIT_EXCEEDED', cfg.ipWindowMs / 1000);
      return;
    }

    const burst = await redisSlidingWindowHit(
      redisKey(`login:ip:burst:${ip}`), { windowMs: cfg.ipBurstWindowMs, max: cfg.ipBurstMax, member: requestMember(now), now });
    if (!burst.allowed) {
      deny(res, next, 'LOGIN_IP_RATE_LIMIT_EXCEEDED', cfg.ipBurstWindowMs / 1000);
      return;
    }

    const email = extractEmail(req);
    if (email) {
      const id = accountIdentifier(email);

      const ipAccount = await redisSlidingWindowStatus(
        redisKey(`login:ipacct:${ip}:${id}`), cfg.failureWindowMs, now);
      if (ipAccount.count >= cfg.ipAccountMaxFailures) {
        deny(res, next, 'LOGIN_IP_ACCOUNT_RATE_LIMIT_EXCEEDED', cfg.failureWindowMs / 1000);
        return;
      }

      const account = await redisSlidingWindowStatus(redisKey(`login:acct:${id}`), cfg.failureWindowMs, now);
      if (account.count >= cfg.accountMaxFailures) {
        // Backoff progresivo: cada fallo por encima del umbral duplica la
        // espera mínima, acotada al máximo configurado. La ventana deslizante
        // garantiza recuperación: el presupuesto vuelve solo con el tiempo.
        const excess = Math.min(account.count - cfg.accountMaxFailures, 10);
        const requiredDelay = Math.min(cfg.backoffBaseMs * 2 ** excess, cfg.backoffMaxMs);
        const elapsed = now - account.newest;
        if (elapsed < requiredDelay) {
          deny(res, next, 'LOGIN_ACCOUNT_THROTTLED', (requiredDelay - elapsed) / 1000);
          return;
        }
      }
    }

    next();
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      // El límite de auth no se desactiva: falla cerrado.
      next(unavailable());
      return;
    }
    next(error);
  }
}

/**
 * Registra un intento fallido REAL de login (post verificación de credenciales).
 * Falla cerrado: si Redis no responde, el login fallido no puede procesarse y
 * el caller lo transforma en 503. Nunca registra intentos ya rechazados por
 * los propios límites.
 */
export async function recordLoginFailure(ip: string | undefined, email: string): Promise<void> {
  if (!env.redis.enabled) return;
  const cfg = env.rateLimit.login;
  const id = accountIdentifier(email);
  const member = requestMember(Date.now());
  // El contador por cuenta vive hasta que el backoff máximo pueda terminar.
  await redisSlidingWindowAdd(
    redisKey(`login:acct:${id}`), { windowMs: cfg.failureWindowMs, member, ttlMs: cfg.failureWindowMs + cfg.backoffMaxMs });
  await redisSlidingWindowAdd(
    redisKey(`login:ipacct:${ip ?? 'unknown'}:${id}`), { windowMs: cfg.failureWindowMs, member, ttlMs: cfg.failureWindowMs });
}

/**
 * Tras un login exitoso se limpian los fallos por cuenta y por IP+cuenta.
 * NO se tocan los contadores globales de volumen/ráfaga por IP.
 * Si Redis está caído el login igual ya fue validado: se degradá a log y la
 * ventana deslizante recupera el acceso sola al deslizar.
 */
export async function clearLoginFailures(ip: string | undefined, email: string): Promise<void> {
  if (!env.redis.enabled) return;
  const id = accountIdentifier(email);
  try {
    await redisDel(redisKey(`login:acct:${id}`));
    await redisDel(redisKey(`login:ipacct:${ip ?? 'unknown'}:${id}`));
  } catch (error) {
    if (!(error instanceof RedisUnavailableError)) throw error;
    logger.warn({ email: id.slice(0, 12) }, 'No se pudieron limpiar contadores de login (Redis caído)');
  }
}
