import { describe, expect, it } from '@jest/globals';
import { TokenService } from '@/services/token.service';

describe('TokenService (utilidades opacas)', () => {
  it('generateRefreshToken returns an opaque random string', () => {
    const a = TokenService.generateRefreshToken();
    const b = TokenService.generateRefreshToken();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });

  it('hashToken is deterministic sha-256', () => {
    const token = 'sample-token';
    expect(TokenService.hashToken(token)).toBe(TokenService.hashToken(token));
    expect(TokenService.hashToken(token)).toHaveLength(64);
    expect(TokenService.hashToken('other')).not.toBe(TokenService.hashToken(token));
  });

  it('generateCsrfToken returns token and matching hash', () => {
    const { token, hash } = TokenService.generateCsrfToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateResetToken returns opaque random token', () => {
    const token = TokenService.generateResetToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });
});
