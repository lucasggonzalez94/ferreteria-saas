import { describe, it, expect, beforeEach } from '@jest/globals';
import { TokenService } from '@/services/token.service';

describe('TokenService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = TokenService.generateAccessToken('user-1', 'business-1', 'test@test.com');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with family', () => {
      const result = TokenService.generateRefreshToken('user-1', 'business-1', 'test@test.com');
      expect(result.token).toBeDefined();
      expect(result.tokenHash).toBeDefined();
      expect(result.tokenFamily).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reuse family when provided', () => {
      const family = 'test-family-123';
      const result = TokenService.generateRefreshToken('user-1', 'business-1', 'test@test.com', family);
      expect(result.tokenFamily).toBe(family);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = TokenService.generateAccessToken('user-1', 'business-1', 'test@test.com');
      const payload = TokenService.verifyAccessToken(token);
      expect(payload.userId).toBe('user-1');
      expect(payload.businessId).toBe('business-1');
      expect(payload.email).toBe('test@test.com');
      expect(payload.type).toBe('access');
    });

    it('should throw on invalid token', () => {
      expect(() => TokenService.verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const result = TokenService.generateRefreshToken('user-1', 'business-1', 'test@test.com');
      const payload = TokenService.verifyRefreshToken(result.token);
      expect(payload.userId).toBe('user-1');
      expect(payload.businessId).toBe('business-1');
      expect(payload.type).toBe('refresh');
    });
  });

  describe('generateResetToken', () => {
    it('should generate random token', () => {
      const token = TokenService.generateResetToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
    });

    it('should generate different tokens', () => {
      const token1 = TokenService.generateResetToken();
      const token2 = TokenService.generateResetToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateCsrfToken', () => {
    it('should generate token and hash', () => {
      const { token, hash } = TokenService.generateCsrfToken();
      expect(token).toBeDefined();
      expect(hash).toBeDefined();
      expect(token.length).toBe(64);
      expect(hash.length).toBe(64);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const hash1 = TokenService.hashToken('test-token');
      const hash2 = TokenService.hashToken('test-token');
      expect(hash1).toBe(hash2);
    });

    it('should produce SHA-256 hex', () => {
      const hash = TokenService.hashToken('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate complete token pair', () => {
      const result = TokenService.generateTokenPair('user-1', 'business-1', 'test@test.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshTokenHash).toBeDefined();
      expect(result.tokenFamily).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.csrfToken).toBeDefined();
      expect(result.csrfHash).toBeDefined();
    });

    it('should generate new token family', () => {
      const result1 = TokenService.generateTokenPair('user-1', 'business-1', 'test@test.com');
      const result2 = TokenService.generateTokenPair('user-1', 'business-1', 'test@test.com');
      expect(result1.tokenFamily).not.toBe(result2.tokenFamily);
    });
  });

  describe('rotateRefreshToken', () => {
    it('should maintain token family on rotation', () => {
      const original = TokenService.generateRefreshToken('user-1', 'business-1', 'test@test.com');
      const rotated = TokenService.rotateRefreshToken('user-1', 'business-1', 'test@test.com', original.tokenFamily);
      expect(rotated.tokenFamily).toBe(original.tokenFamily);
    });
  });
});
