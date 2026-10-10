import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRunPublic = jest.fn() as any;
const mockRun = jest.fn() as any;
const mockSetTenant = jest.fn() as any;
const mockVerifyAccessToken = jest.fn() as any;
const mockRedisGet = jest.fn() as any;
const mockRedisSet = jest.fn() as any;

jest.mock('@/platform/tenancy/unit-of-work', () => ({
  unitOfWork: { runPublic: mockRunPublic, run: mockRun, setTenant: mockSetTenant },
  TenantUnitOfWork: class {},
}));
jest.mock('@/platform/security/jwt', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));
jest.mock('@/platform/cache/redis', () => ({
  redisGet: mockRedisGet,
  redisSet: mockRedisSet,
  RedisUnavailableError: class RedisUnavailableError extends Error {},
}));
jest.mock('@/config/env', () => ({ env: { redis: { enabled: false } } }));

import { authenticate, requirePermissions } from '@/platform/security/authenticate';
import { AppError } from '@/platform/errors';
import { env } from '@/config/env';
import { RedisUnavailableError } from '@/platform/cache/redis';

const session = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-1',
  businessId: 'biz-1',
  userId: 'user-1',
  securityVersion: 1,
  user: {
    id: 'user-1',
    email: 'user@test.com',
    firstName: 'Ana',
    lastName: null,
    isActive: true,
    securityVersion: 1,
    businessId: 'biz-1',
    business: { authorizationVersion: 1, timezone: 'America/Buenos_Aires' },
  },
  ...overrides,
});

describe('authenticate (platform)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.redis.enabled = false;
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue(undefined);
    mockRunPublic.mockImplementation(async (work: any) =>
      work({ $queryRaw: jest.fn().mockResolvedValue([{ business_id: 'biz-1' }]), authSession: { findFirst: jest.fn().mockResolvedValue(session()) } }),
    );
    mockRun.mockImplementation(async (_ctx: any, work: any) =>
      work({
        user: {
          findFirst: jest.fn().mockResolvedValue({
            isActive: true,
            roles: [
              { role: { name: 'OWNER', permissions: [{ permission: { resource: 'sales', action: 'create' } }] } },
            ],
          }),
        },
      }),
    );
    mockVerifyAccessToken.mockReturnValue({
      sub: 'user-1',
      sid: 'session-1',
      tid: 'biz-1',
      sv: 1,
      av: 1,
      typ: 'access',
    });
  });

  it('rejects when bearer token is missing', async () => {
    const next = jest.fn();
    await authenticate({ headers: {} } as any, {} as any, next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid access tokens', async () => {
    mockVerifyAccessToken.mockImplementation(() => { throw AppError.unauthorized('INVALID_TOKEN', 'bad'); });
    const next = jest.fn();
    await authenticate({ headers: { authorization: 'Bearer bad' } } as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('INVALID_TOKEN');
  });

  it('rejects when session is not found or revoked', async () => {
    mockRunPublic.mockImplementation(async (work: any) =>
      work({ $queryRaw: jest.fn().mockResolvedValue([{ business_id: 'biz-1' }]), authSession: { findFirst: jest.fn().mockResolvedValue(null) } }),
    );
    const next = jest.fn();
    await authenticate({ headers: { authorization: 'Bearer ok' } } as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('UNAUTHORIZED');
  });

  it('rejects when security version changed (password/reset)', async () => {
    mockRunPublic.mockImplementation(async (work: any) =>
      work({ $queryRaw: jest.fn().mockResolvedValue([{ business_id: 'biz-1' }]), authSession: { findFirst: jest.fn().mockResolvedValue(session({ securityVersion: 2 })) } }),
    );
    const next = jest.fn();
    await authenticate({ headers: { authorization: 'Bearer ok' } } as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('TOKEN_REVOKED');
  });

  it('loads identity, roles, permissions, tenant and timezone into the request', async () => {
    const req = { headers: { authorization: 'Bearer ok' } } as any;
    const next = jest.fn();
    await authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        businessId: 'biz-1',
        roles: ['OWNER'],
        permissions: ['sales:create'],
      }),
    );
    expect(req.businessId).toBe('biz-1');
    expect(req.timezone).toBe('America/Buenos_Aires');
    expect(req.sessionId).toBe('session-1');
  });

  it.each(['{broken', 'null', '{"roles":[],"permissions":[42],"isActive":true}'])('ignores invalid auxiliary cache: %s', async cached => {
    env.redis.enabled = true;
    mockRedisGet.mockResolvedValue(cached);
    const req = { headers: { authorization: 'Bearer ok' } } as any;
    const next = jest.fn();
    await authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user.permissions).toEqual(['sales:create']);
    expect(mockRun).toHaveBeenCalled();
  });

  it('falls back to PostgreSQL when Redis fails for reads and writes', async () => {
    env.redis.enabled = true;
    mockRedisGet.mockRejectedValue(new RedisUnavailableError());
    mockRedisSet.mockRejectedValue(new RedisUnavailableError());
    const req = { headers: { authorization: 'Bearer ok' } } as any;
    const next = jest.fn();
    await authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user.permissions).toEqual(['sales:create']);
  });

  it('validates PostgreSQL session before accepting a positive cache hit', async () => {
    env.redis.enabled = true;
    mockRedisGet.mockResolvedValue(JSON.stringify({ roles: ['OWNER'], permissions: ['sales:create'], isActive: true }));
    mockRunPublic.mockImplementation(async (work: any) =>
      work({ $queryRaw: jest.fn().mockResolvedValue([{ business_id: 'biz-1' }]), authSession: { findFirst: jest.fn().mockResolvedValue(null) } }),
    );
    const next = jest.fn();
    await authenticate({ headers: { authorization: 'Bearer ok' } } as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('UNAUTHORIZED');
    expect(mockRedisGet).not.toHaveBeenCalled();
  });
});

describe('requirePermissions (OR semantics)', () => {
  it('denies without user', () => {
    const next = jest.fn();
    requirePermissions('sales:create')({} as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('UNAUTHORIZED');
  });

  it('denies without permission', () => {
    const next = jest.fn();
    requirePermissions('sales:create')({ user: { permissions: ['products:read'] } } as any, {} as any, next);
    expect((next.mock.calls[0][0] as AppError).code).toBe('FORBIDDEN');
  });
});
