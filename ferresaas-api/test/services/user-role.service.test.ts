import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findUnique: jest.fn() as any,
  },
  role: {
    findMany: jest.fn() as any,
    findUnique: jest.fn() as any,
  },
  userRole: {
    findMany: jest.fn() as any,
    findUnique: jest.fn() as any,
    deleteMany: jest.fn() as any,
    createMany: jest.fn() as any,
    create: jest.fn() as any,
    delete: jest.fn() as any,
  },
};

const mockAuditService = {
  logUpdate: jest.fn() as any,
  log: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));

import { UserRoleService } from '@/services/user-role.service';

describe('UserRoleService', () => {
  let service: UserRoleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserRoleService();
  });

  it('getUserRoles validates user existence and tenant ownership', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getUserRoles('biz-1', 'user-1')).rejects.toThrow('User not found');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', businessId: 'biz-2' });
    await expect(service.getUserRoles('biz-1', 'user-1')).rejects.toThrow(
      'Access denied to this user'
    );
  });

  it('getUserRoles returns mapped roles payload', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.userRole.findMany.mockResolvedValue([
      {
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
        role: {
          id: 'role-1',
          name: 'Admin',
          description: 'System admin',
          isSystem: true,
          permissions: [{}, {}],
        },
      },
    ]);

    const result = await service.getUserRoles('biz-1', 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        roles: [
          expect.objectContaining({ id: 'role-1', permissionCount: 2, name: 'Admin' }),
        ],
      })
    );
  });

  it('assignRoles validates roles, replaces assignments and audits', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    const getUserRolesSpy = jest
      .spyOn(service, 'getUserRoles')
      .mockResolvedValueOnce({ userId: 'user-1', roles: [{ id: 'role-0' }] } as any)
      .mockResolvedValueOnce({ userId: 'user-1', roles: [{ id: 'role-1' }] } as any);

    const result = await service.assignRoles('biz-1', 'user-1', ['role-1'], 'admin-1');

    expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(mockPrisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-1' }],
    });
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(getUserRolesSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ userId: 'user-1', roles: [{ id: 'role-1' }] });
  });

  it('assignRoles rejects when one or more role ids are invalid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);

    await expect(
      service.assignRoles('biz-1', 'user-1', ['role-1', 'role-2'], 'admin-1')
    ).rejects.toThrow('One or more roles do not exist or do not belong to this business');
  });

  it('addRole validates user/role/existing assignment and returns refreshed roles', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-1', businessId: 'biz-1', name: 'Admin' });
    mockPrisma.userRole.findUnique.mockResolvedValue(null);
    const getUserRolesSpy = jest
      .spyOn(service, 'getUserRoles')
      .mockResolvedValue({ userId: 'user-1', roles: [{ id: 'role-1' }] } as any);

    const result = await service.addRole('biz-1', 'user-1', 'role-1', 'admin-1');

    expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-1' },
    });
    expect(mockAuditService.log).toHaveBeenCalled();
    expect(getUserRolesSpy).toHaveBeenCalledWith('biz-1', 'user-1');
    expect(result).toEqual({ userId: 'user-1', roles: [{ id: 'role-1' }] });
  });

  it('addRole rejects duplicate or cross-tenant role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-1', businessId: 'biz-2' });

    await expect(service.addRole('biz-1', 'user-1', 'role-1', 'admin-1')).rejects.toThrow(
      'Role does not belong to this business'
    );

    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-1', businessId: 'biz-1', name: 'Admin' });
    mockPrisma.userRole.findUnique.mockResolvedValue({ userId: 'user-1', roleId: 'role-1' });

    await expect(service.addRole('biz-1', 'user-1', 'role-1', 'admin-1')).rejects.toThrow(
      'User already has this role'
    );
  });

  it('removeRole validates assignment, deletes it and audits', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.userRole.findUnique.mockResolvedValue({
      userId: 'user-1',
      roleId: 'role-1',
      role: { name: 'Seller' },
    });
    const getUserRolesSpy = jest
      .spyOn(service, 'getUserRoles')
      .mockResolvedValue({ userId: 'user-1', roles: [] } as any);

    const result = await service.removeRole('biz-1', 'user-1', 'role-1', 'admin-1');

    expect(mockPrisma.userRole.delete).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: 'user-1', roleId: 'role-1' } },
    });
    expect(mockAuditService.log).toHaveBeenCalled();
    expect(getUserRolesSpy).toHaveBeenCalled();
    expect(result).toEqual({ userId: 'user-1', roles: [] });
  });

  it('removeRole rejects when assignment does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1' });
    mockPrisma.userRole.findUnique.mockResolvedValue(null);

    await expect(service.removeRole('biz-1', 'user-1', 'role-1', 'admin-1')).rejects.toThrow(
      'User does not have this role'
    );
  });

  it('getUsersByRole validates role ownership and returns mapped users', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-1', businessId: 'biz-1', name: 'Seller' });
    mockPrisma.userRole.findMany.mockResolvedValue([
      {
        assignedAt: new Date('2026-01-02T00:00:00.000Z'),
        user: {
          id: 'user-1',
          email: 'u1@test.com',
          firstName: 'U',
          lastName: 'One',
          isActive: true,
          createdAt: new Date(),
        },
      },
    ]);

    const result = await service.getUsersByRole('biz-1', 'role-1');

    expect(result).toEqual(
      expect.objectContaining({
        roleId: 'role-1',
        roleName: 'Seller',
        userCount: 1,
      })
    );
  });

  it('getUsersByRole rejects missing or cross-tenant role', async () => {
    mockPrisma.role.findUnique.mockResolvedValueOnce(null);
    await expect(service.getUsersByRole('biz-1', 'role-1')).rejects.toThrow('Role not found');

    mockPrisma.role.findUnique.mockResolvedValueOnce({ id: 'role-1', businessId: 'biz-2' });
    await expect(service.getUsersByRole('biz-1', 'role-1')).rejects.toThrow(
      'Role does not belong to this business'
    );
  });
});
