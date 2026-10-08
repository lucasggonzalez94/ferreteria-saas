import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../errors';

export const JWT_ISSUER = 'ferresaas-api';
export const JWT_AUDIENCE = 'ferresaas-web';

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
  tid: string; // businessId
  sv: number; // securityVersion
  av: number; // authorizationVersion
  typ: 'access';
}

export function issueAccessToken(payload: AccessTokenPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: expiresInSeconds,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as AccessTokenPayload;
    if (payload.typ !== 'access' || !payload.sub || !payload.sid || !payload.tid) {
      throw new Error('invalid payload');
    }
    return payload;
  } catch {
    throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
  }
}

/** Refresh token opaco: 256 bits aleatorios, sólo se persiste su hash SHA-256. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** CSRF ligado a la sesión: HMAC(sessionSecret?) — secreto por sesión. */
export function generateCsrfToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hmacSha256(token) };
}

export function hmacSha256(value: string): string {
  return crypto.createHmac('sha256', env.csrf.secret).update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
