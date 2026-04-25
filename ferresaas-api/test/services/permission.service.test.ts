import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  permission: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
  },
  rolePermission: {
    findMany: jest.fn() as any,
  },
};

const mockAuditService = {
  log: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));

import { PermissionService } from '@/services/permission.service';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermissionService();
  });

  it('list returns mapped permission catalog with filters and meta', async () => {
    const now = new Date('2026-02-01T10:00:00.000Z');
    mockPrisma.permission.findMany.mockResolvedValue([
      {
        id: 'perm-1',
        resource: 'products',
        action: 'read',
        description: 'read products',
        createdAt: now,
      },
    ]);
    mockPrisma.permission.count.mockResolvedValue(1);

    const result = await service.list({ q: 'prod', resource: 'products', page: 1, limit: 20 });

    expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
          resource: { equals: 'products', mode: 'insensitive' },
        }),
      })
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'perm-1',
        fullName: 'products:read',
      })
    );
    expect(result.meta.total).toBe(1);
  });

  it('getById returns mapped permission with role count', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue({
      id: 'perm-1',
      resource: 'products',
      action: 'write',
      description: 'write products',
      _count: { roles: 2 },
      createdAt: new Date(),
    });

    const result = await service.getById('perm-1');

    expect(result).toEqual(
      expect.objectContaining({
        fullName: 'products:write',
        roleCount: 2,
      })
    );
  });

  it('getById throws when permission does not exist', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow('Permission not found');
  });

  it('getByResourceAction returns mapped permission', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue({
      id: 'perm-2',
      resource: 'sales',
      action: 'read',
      description: 'read sales',
      _count: { roles: 1 },
      createdAt: new Date(),
    });

    const result = await service.getByResourceAction('sales', 'read');
    expect(result.fullName).toBe('sales:read');
  });

  it('getByResourceAction throws when permission does not exist', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue(null);
    await expect(service.getByResourceAction('x', 'y')).rejects.toThrow('Permission not found');
  });

  it('create rejects duplicate permission', async () => {
    mockPrisma.permission.findUnique.mockResolvedValue({ id: 'perm-existing' });

    await expect(
      service.create('user-1', { resource: 'users', action: 'read' })
    ).rejects.toThrow('already exists');
  });

  it('create persists permission, audits and returns hydrated permission', async () => {
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'perm-new' } as any);
    mockPrisma.permission.findUnique.mockResolvedValue(null);
    mockPrisma.permission.create.mockResolvedValue({
      id: 'perm-new',
      resource: 'users',
      action: 'write',
      description: 'write users',
    });

    const result = await service.create('user-1', {
      resource: 'users',
      action: 'write',
      description: 'write users',
    });

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'system',
        userId: 'user-1',
        action: 'CREATE',
      })
    );
    expect(getByIdSpy).toHaveBeenCalledWith('perm-new');
    expect(result).toEqual({ id: 'perm-new' });
  });

  it('updateDescription updates and audits description changes', async () => {
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce({ id: 'perm-1', description: 'old' } as any)
      .mockResolvedValueOnce({ id: 'perm-1', description: 'new' } as any);
    mockPrisma.permission.update.mockResolvedValue({ id: 'perm-1', description: 'new' });

    const result = await service.updateDescription('user-1', 'perm-1', 'new');

    expect(mockPrisma.permission.update).toHaveBeenCalledWith({
      where: { id: 'perm-1' },
      data: { description: 'new' },
    });
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', businessId: 'system' })
    );
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'perm-1', description: 'new' });
  });

  it('getResources and getActionsByResource return ordered string arrays', async () => {
    mockPrisma.permission.findMany
      .mockResolvedValueOnce([{ resource: 'customers' }, { resource: 'products' }])
      .mockResolvedValueOnce([{ action: 'read' }, { action: 'write' }]);

    const resources = await service.getResources();
    const actions = await service.getActionsByResource('products');

    expect(resources).toEqual(['customers', 'products']);
    expect(actions).toEqual(['read', 'write']);
  });

  it('getPermissionsByRole maps role-permission relations to full names', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      {
        permission: {
          id: 'perm-1',
          resource: 'sales',
          action: 'approve',
          description: 'approve discounts',
        },
      },
    ]);

    const result = await service.getPermissionsByRole('role-1');

    expect(result).toEqual([
      {
        id: 'perm-1',
        resource: 'sales',
        action: 'approve',
        description: 'approve discounts',
        fullName: 'sales:approve',
      },
    ]);
  });
});
