import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';
import crypto from 'crypto';

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

    return jwt.sign(payload, env.jwt.accessSecret, {
      expiresIn: env.jwt.accessExpiresIn,
    });
  }

  /**
   * Generar refresh token
   */
  static generateRefreshToken(userId: string, businessId: string, email: string): string {
    const payload: JwtPayload = {
      userId,
      businessId,
      email,
      type: 'refresh',
    };

    return jwt.sign(payload, env.jwt.refreshSecret, {
      expiresIn: env.jwt.refreshExpiresIn,
    });
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
   * Generar par de tokens (access + refresh)
   */
  static generateTokenPair(userId: string, businessId: string, email: string) {
    return {
      accessToken: this.generateAccessToken(userId, businessId, email),
      refreshToken: this.generateRefreshToken(userId, businessId, email),
    };
  }
}
