import crypto from 'crypto';
import { describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  csrf: {
    secret: 'csrf-secret-for-tests',
  },
};

jest.mock('@/config/env', () => ({ env: mockEnv }));

import { AppError } from '@/utils/response';
import { verifyCsrf } from '@/middleware/csrf';

describe('csrf middleware', () => {
  it('skips safe methods', () => {
    const req = { method: 'GET', path: '/products', headers: {} } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('skips configured public auth paths', () => {
    const req = { method: 'POST', path: '/auth/login', headers: {} } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects state-changing requests without csrf token', () => {
    const req = { method: 'POST', path: '/products', headers: {} } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('rejects missing csrf hash header', () => {
    const req = {
      method: 'PATCH',
      path: '/products/1',
      headers: { 'x-csrf-token': 'token-1' },
    } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects invalid csrf hash', () => {
    const req = {
      method: 'DELETE',
      path: '/products/1',
      headers: { 'x-csrf-token': 'token-1', 'x-csrf-hash': '00ff' },
    } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('accepts valid csrf token/hash pair', () => {
    const csrfToken = 'token-ok';
    const csrfHash = crypto
      .createHmac('sha256', mockEnv.csrf.secret)
      .update(csrfToken)
      .digest('hex');
    const req = {
      method: 'POST',
      path: '/products',
      headers: { 'x-csrf-token': csrfToken, 'x-csrf-hash': csrfHash },
    } as any;
    const next = jest.fn();

    verifyCsrf(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });
});
