import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  auditLog: {
    create: jest.fn() as any,
  },
};

const mockLogger = {
  debug: jest.fn() as any,
  error: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { AuditService } from '@/services/audit.service';

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates audit row and logs debug metadata', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await AuditService.log({
      businessId: 'biz-1',
      userId: 'user-1',
      action: 'UPDATE',
      entity: 'product',
      entityId: 'prod-1',
      before: { price: 10 },
      after: { price: 12 },
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        userId: 'user-1',
        action: 'UPDATE',
        entity: 'product',
        entityId: 'prod-1',
        before: { price: 10 },
        after: { price: 12 },
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'biz-1', action: 'UPDATE', entity: 'product' }),
      'Audit log created'
    );
  });

  it('swallows persistence errors and logs error details', async () => {
    const error = new Error('insert failed');
    mockPrisma.auditLog.create.mockRejectedValue(error);

    await AuditService.log({ businessId: 'biz-1', action: 'CREATE', entity: 'sale' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        params: expect.objectContaining({ businessId: 'biz-1', action: 'CREATE', entity: 'sale' }),
      }),
      'Failed to create audit log'
    );
  });

  it('logCreate maps payload to CREATE action', async () => {
    const logSpy = jest.spyOn(AuditService, 'log').mockResolvedValue();

    await AuditService.logCreate(
      'biz-1',
      'user-1',
      'customer',
      'cus-1',
      { name: 'Jane' },
      '10.0.0.1',
      'ua'
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'biz-1',
        userId: 'user-1',
        action: 'CREATE',
        entity: 'customer',
        entityId: 'cus-1',
        after: { name: 'Jane' },
      })
    );
  });

  it('logUpdate maps payload to UPDATE action', async () => {
    const logSpy = jest.spyOn(AuditService, 'log').mockResolvedValue();

    await AuditService.logUpdate(
      'biz-1',
      'user-1',
      'customer',
      'cus-1',
      { old: true },
      { old: false }
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        before: { old: true },
        after: { old: false },
      })
    );
  });

  it('logDelete maps payload to DELETE action', async () => {
    const logSpy = jest.spyOn(AuditService, 'log').mockResolvedValue();

    await AuditService.logDelete('biz-1', 'user-1', 'customer', 'cus-1', { archived: true });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        before: { archived: true },
      })
    );
  });
});
