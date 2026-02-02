import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';
import crypto from 'crypto';
import { addDays } from 'date-fns';

export interface RefreshTokenData {
  token: string;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: Date;
}

export class TokenService {
  /**
   * Generar access token
   */
  static generateAccessToken(userId: string, businessId: string, email: string): string {
    const payload: JwtPayload = {
      userId,
      businessId,
      email,
      type: 'access',
    };

    return jwt.sign(payload, env.jwt.accessSecret as string, {
      expiresIn: env.jwt.accessExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Generar refresh token con familia
   */
  static generateRefreshToken(
    userId: string,
    businessId: string,
    email: string,
    tokenFamily?: string
  ): RefreshTokenData {
    const family = tokenFamily || crypto.randomUUID();

    const payload: JwtPayload = {
      userId,
      businessId,
      email,
      type: 'refresh',
      tokenFamily: family,
    };

    const token = jwt.sign(payload, env.jwt.refreshSecret as string, {
      expiresIn: env.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    const tokenHash = this.hashToken(token);
    const expiresAt = addDays(new Date(), 30);

    return {
      token,
      tokenHash,
      tokenFamily: family,
      expiresAt,
    };
  }

  /**
   * Verificar access token
   */
  static verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
  }

  /**
   * Verificar refresh token
   */
  static verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
  }

  /**
   * Generar token de reset de password (random)
   */
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generar CSRF token con hash HMAC
   */
  static generateCsrfToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHmac('sha256', env.csrf.secret)
      .update(token)
      .digest('hex');
    return { token, hash };
  }

  /**
   * Hash de token con SHA-256
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generar par de tokens (access + refresh) con familia nueva
   */
  static generateTokenPair(userId: string, businessId: string, email: string) {
    const accessToken = this.generateAccessToken(userId, businessId, email);
    const refreshTokenData = this.generateRefreshToken(userId, businessId, email);
    const csrfTokenData = this.generateCsrfToken();

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      refreshTokenHash: refreshTokenData.tokenHash,
      tokenFamily: refreshTokenData.tokenFamily,
      expiresAt: refreshTokenData.expiresAt,
      csrfToken: csrfTokenData.token,
      csrfHash: csrfTokenData.hash,
    };
  }

  /**
   * Rotar refresh token (mantiene la familia)
   */
  static rotateRefreshToken(
    userId: string,
    businessId: string,
    email: string,
    tokenFamily: string
  ) {
    const accessToken = this.generateAccessToken(userId, businessId, email);
    const refreshTokenData = this.generateRefreshToken(userId, businessId, email, tokenFamily);
    const csrfTokenData = this.generateCsrfToken();

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      refreshTokenHash: refreshTokenData.tokenHash,
      tokenFamily: refreshTokenData.tokenFamily,
      expiresAt: refreshTokenData.expiresAt,
      csrfToken: csrfTokenData.token,
      csrfHash: csrfTokenData.hash,
    };
  }
}
