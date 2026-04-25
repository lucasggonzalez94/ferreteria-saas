import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findUnique: jest.fn() as any,
  },
};

const mockIsBlacklisted = jest.fn() as any;
const mockVerify = jest.fn() as any;
const mockEnv = {
  jwt: {
    accessSecret: 'access-secret',
  },
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/services/token-blacklist.service', () => ({
  TokenBlacklistService: {
    isBlacklisted: mockIsBlacklisted,
  },
}));
jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken') as any;
  return {
    ...actual,
    verify: mockVerify,
  };
});

import jwt from 'jsonwebtoken';
import { AppError } from '@/utils/response';
import { authenticate, optionalAuth } from '@/middleware/auth';

describe('auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticate rejects when bearer token is missing', async () => {
    const req = { headers: {} } as any;
    const next = jest.fn();

    await authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('authenticate rejects revoked token', async () => {
    const req = { headers: { authorization: 'Bearer token-1' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(true);

    await authenticate(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('TOKEN_REVOKED');
  });

  it('authenticate maps jwt errors to INVALID_TOKEN', async () => {
    const req = { headers: { authorization: 'Bearer token-2' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockImplementation(() => {
      throw new jwt.JsonWebTokenError('bad token');
    });

    await authenticate(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.message).toBe('Invalid token');
  });

  it('authenticate rejects non-access token type', async () => {
    const req = { headers: { authorization: 'Bearer token-3' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue({ userId: 'user-1', type: 'refresh' });

    await authenticate(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.message).toBe('Invalid token type');
  });

  it('authenticate rejects missing or inactive user', async () => {
    const req = { headers: { authorization: 'Bearer token-4' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue({ userId: 'user-1', type: 'access' });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await authenticate(req, {} as any, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('USER_NOT_FOUND');
  });

  it('authenticate sets request user and business context', async () => {
    const req = { headers: { authorization: 'Bearer token-5' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue({ userId: 'user-1', type: 'access' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      businessId: 'biz-1',
      email: 'u1@test.com',
      firstName: 'User',
      lastName: 'One',
      isActive: true,
      roles: [
        {
          role: {
            name: 'Admin',
            permissions: [
              { permission: { resource: 'products', action: 'read' } },
              { permission: { resource: 'products', action: 'write' } },
            ],
          },
        },
      ],
    });

    await authenticate(req, {} as any, next);

    expect(req.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        businessId: 'biz-1',
        roles: ['Admin'],
        permissions: ['products:read', 'products:write'],
      })
    );
    expect(req.businessId).toBe('biz-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('optionalAuth skips authentication if no token', async () => {
    const req = { headers: {} } as any;
    const next = jest.fn();

    await optionalAuth(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('optionalAuth delegates to authenticate when bearer token exists', async () => {
    const req = { headers: { authorization: 'Bearer token-6' } } as any;
    const next = jest.fn();
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue({ userId: 'user-1', type: 'access' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      businessId: 'biz-1',
      email: 'u1@test.com',
      isActive: true,
      roles: [],
    });

    await optionalAuth(req, {} as any, next);

    expect(mockVerify).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
