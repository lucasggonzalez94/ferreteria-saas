import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  role: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
    delete: jest.fn() as any,
  },
  permission: {
    findMany: jest.fn() as any,
  },
  rolePermission: {
    createMany: jest.fn() as any,
    deleteMany: jest.fn() as any,
  },
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  logUpdate: jest.fn() as any,
  logDelete: jest.fn() as any,
};

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/audit.service', () => ({
  AuditService: mockAuditService,
}));

import { RoleService } from '@/services/role.service';

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleService();
  });

  it('lists roles with pagination and mapped response', async () => {
    const now = new Date('2026-01-01T10:00:00.000Z');
    mockPrisma.role.findMany.mockResolvedValue([
      {
        id: 'role-1',
        businessId: 'biz-1',
        name: 'Admin',
        description: 'Administrador',
        isSystem: true,
        permissions: [{}, {}],
        _count: { users: 3 },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockPrisma.role.count.mockResolvedValue(1);

    const result = await service.list('biz-1', { page: 1, limit: 10, q: 'adm' });

    expect(mockPrisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          OR: expect.any(Array),
        }),
      })
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'role-1',
        permissionCount: 2,
        userCount: 3,
      })
    );
    expect(result.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false })
    );
  });

  it('getById returns mapped role and permissions', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      businessId: 'biz-1',
      name: 'Seller',
      description: null,
      isSystem: false,
      permissions: [
        {
          permission: {
            id: 'perm-1',
            resource: 'products',
            action: 'read',
            description: 'Read products',
          },
        },
      ],
      _count: { users: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getById('biz-1', 'role-1');

    expect(result.permissions).toEqual([
      {
        id: 'perm-1',
        resource: 'products',
        action: 'read',
        description: 'Read products',
      },
    ]);
  });

  it('getById throws ROLE_NOT_FOUND when role does not exist', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);

    await expect(service.getById('biz-1', 'missing')).rejects.toThrow('Role not found');
  });

  it('getById throws FORBIDDEN when role belongs to another business', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      businessId: 'biz-2',
      permissions: [],
      _count: { users: 0 },
    });

    await expect(service.getById('biz-1', 'role-1')).rejects.toThrow('Access denied to this role');
  });

  it('create throws ROLE_EXISTS when same name already exists', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-1' });

    await expect(
      service.create('biz-1', 'user-1', { name: 'Admin', permissionIds: [] })
    ).rejects.toThrow('already exists in this business');
  });

  it('create validates permission ids before creating role', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }]);

    await expect(
      service.create('biz-1', 'user-1', { name: 'Cashier', permissionIds: ['perm-1', 'perm-2'] })
    ).rejects.toThrow('One or more permissions do not exist');
  });

  it('create persists role, role-permissions and writes audit log', async () => {
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'role-9' } as any);
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }, { id: 'perm-2' }]);
    mockPrisma.role.create.mockResolvedValue({
      id: 'role-9',
      name: 'Cashier',
      description: 'Caja',
    });

    const result = await service.create('biz-1', 'user-1', {
      name: 'Cashier',
      description: 'Caja',
      permissionIds: ['perm-1', 'perm-2'],
    });

    expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { roleId: 'role-9', permissionId: 'perm-1' },
          { roleId: 'role-9', permissionId: 'perm-2' },
        ],
      })
    );
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith('biz-1', 'role-9');
    expect(result).toEqual({ id: 'role-9' });
  });

  it('update rejects changes on system roles', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'role-1',
      name: 'System',
      isSystem: true,
    } as any);

    await expect(service.update('biz-1', 'user-1', 'role-1', { name: 'New' })).rejects.toThrow(
      'System roles cannot be modified'
    );
  });

  it('update checks duplicate name and invalid permission ids', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'role-1',
      name: 'Old',
      isSystem: false,
    } as any);
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'other-role' });

    await expect(service.update('biz-1', 'user-1', 'role-1', { name: 'Admin' })).rejects.toThrow(
      'already exists in this business'
    );
  });

  it('update replaces permissions and writes audit log', async () => {
    const current = {
      id: 'role-1',
      name: 'Seller',
      description: 'old',
      isSystem: false,
    };
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce(current as any)
      .mockResolvedValueOnce({ id: 'role-1', name: 'Seller Pro' } as any);
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }]);
    mockPrisma.role.update.mockResolvedValue({
      id: 'role-1',
      name: 'Seller Pro',
      description: 'new',
      isSystem: false,
    });

    const result = await service.update('biz-1', 'user-1', 'role-1', {
      name: 'Seller Pro',
      permissionIds: ['perm-1'],
    });

    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
    expect(mockPrisma.rolePermission.createMany).toHaveBeenCalled();
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'role-1', name: 'Seller Pro' });
  });

  it('delete rejects system roles and roles in use', async () => {
    jest.spyOn(service, 'getById').mockResolvedValueOnce({ isSystem: true } as any);
    await expect(service.delete('biz-1', 'user-1', 'role-1')).rejects.toThrow(
      'System roles cannot be deleted'
    );

    (service.getById as any).mockResolvedValueOnce({ isSystem: false, userCount: 2 } as any);
    await expect(service.delete('biz-1', 'user-1', 'role-1')).rejects.toThrow(
      'Cannot delete role with 2 assigned user(s)'
    );
  });

  it('delete removes role and permission links and logs audit', async () => {
    const current = { id: 'role-1', isSystem: false, userCount: 0 };
    jest.spyOn(service, 'getById').mockResolvedValue(current as any);

    const result = await service.delete('biz-1', 'user-1', 'role-1');

    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
    expect(mockPrisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } });
    expect(mockAuditService.logDelete).toHaveBeenCalled();
    expect(result).toEqual(current);
  });

  it('getPermissions returns permissions from getById', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue({
      permissions: [{ id: 'perm-1', resource: 'sales', action: 'read' }],
    } as any);

    const permissions = await service.getPermissions('biz-1', 'role-1');
    expect(permissions).toEqual([{ id: 'perm-1', resource: 'sales', action: 'read' }]);
  });

  it('updatePermissions rejects system role and invalid permission ids', async () => {
    jest.spyOn(service, 'getById').mockResolvedValueOnce({ isSystem: true } as any);
    await expect(
      service.updatePermissions('biz-1', 'user-1', 'role-1', ['perm-1'])
    ).rejects.toThrow('System role permissions cannot be modified');

    (service.getById as any).mockResolvedValueOnce({
      isSystem: false,
      permissions: [],
    });
    mockPrisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }]);

    await expect(
      service.updatePermissions('biz-1', 'user-1', 'role-1', ['perm-1', 'perm-2'])
    ).rejects.toThrow('One or more permissions do not exist');
  });

  it('updatePermissions replaces permissions and returns refreshed list', async () => {
    const getByIdSpy = jest
      .spyOn(service, 'getById')
      .mockResolvedValueOnce({ isSystem: false, permissions: [{ id: 'old' }] } as any);
    const getPermissionsSpy = jest
      .spyOn(service, 'getPermissions')
      .mockResolvedValue([{ id: 'perm-2', resource: 'sales', action: 'write' }] as any);
    mockPrisma.permission.findMany.mockResolvedValue([
      { id: 'perm-2', resource: 'sales', action: 'write' },
    ]);

    const result = await service.updatePermissions('biz-1', 'user-1', 'role-1', ['perm-2']);

    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
    expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'role-1', permissionId: 'perm-2' }],
    });
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalled();
    expect(getPermissionsSpy).toHaveBeenCalledWith('biz-1', 'role-1');
    expect(result).toEqual([{ id: 'perm-2', resource: 'sales', action: 'write' }]);
  });
});
