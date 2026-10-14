import { describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  csrf: {
    secret: 'csrf-secret-for-tests',
  },
};

jest.mock('@/config/env', () => ({ env: mockEnv }));

import type { AppError } from '@/platform/errors';
import { createCsrfMiddleware } from '@/platform/security/csrf';
import { csrfHashFor } from '@/platform/security/jwt';

const SESSION_SECRET = 'refresh-token-de-la-sesion';
const OTHER_SESSION_SECRET = 'refresh-token-de-otra-sesion';

const verifyCsrf = createCsrfMiddleware([{ method: 'POST', path: '/auth/login' }]);

function reqWith(overrides: Record<string, unknown>): any {
  return {
    method: 'POST',
    path: '/products',
    headers: {},
    cookies: { refreshToken: SESSION_SECRET },
    ...overrides,
  };
}

function run(req: any) {
  const next = jest.fn();
  verifyCsrf(req, {} as any, next);
  return next;
}

describe('csrf middleware', () => {
  it('skips safe methods', () => {
    const next = run(reqWith({ method: 'GET', headers: {}, cookies: {} }));
    expect(next).toHaveBeenCalledWith();
  });

  it('skips configured public auth paths (método + path exactos)', () => {
    const next = run(reqWith({ path: '/auth/login', headers: {}, cookies: {} }));
    expect(next).toHaveBeenCalledWith();
  });

  it('no exime un path que empieza igual pero no coincide exacto', () => {
    const next = run(reqWith({ path: '/auth/login/extra', headers: {}, cookies: {} }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('no exime el mismo path con otro método', () => {
    const next = run(reqWith({ method: 'PUT', path: '/auth/login', headers: {}, cookies: {} }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('rejects state-changing requests without csrf token', () => {
    const next = run(reqWith({}));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('rejects csrf token without session cookie (el par debe estar ligado a sesión)', () => {
    const next = run(reqWith({ cookies: {}, headers: { 'x-csrf-token': 'token-1' } }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects missing csrf hash header', () => {
    const next = run(reqWith({ headers: { 'x-csrf-token': 'token-1' } }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects invalid csrf hash', () => {
    const next = run(reqWith({ headers: { 'x-csrf-token': 'token-1', 'x-csrf-hash': '00ff' } }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects a valid pair computed for ANOTHER session (adversarial)', () => {
    const csrfToken = 'token-robado-de-otra-sesion';
    const stolenHash = csrfHashFor(csrfToken, OTHER_SESSION_SECRET);
    const next = run(reqWith({
      headers: { 'x-csrf-token': csrfToken, 'x-csrf-hash': stolenHash },
    }));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('accepts valid csrf token/hash pair bound to the session cookie', () => {
    const csrfToken = 'token-ok';
    const csrfHash = csrfHashFor(csrfToken, SESSION_SECRET);
    const next = run(reqWith({
      headers: { 'x-csrf-token': csrfToken, 'x-csrf-hash': csrfHash },
    }));
    expect(next).toHaveBeenCalledWith();
  });
});
