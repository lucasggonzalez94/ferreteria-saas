import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    findUnique: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
  },
  role: {
    findMany: jest.fn() as any,
  },
  userRole: {
    createMany: jest.fn() as any,
  },
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  logUpdate: jest.fn() as any,
  log: jest.fn() as any,
};

const mockPasswordService = {
  hash: jest.fn() as any,
};

const mockTokenService = {
  hashToken: jest.fn() as any,
};

const mockSendPasswordResetEmail = jest.fn() as any;
const mockProviderSendEmail = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/password.service', () => ({ PasswordService: mockPasswordService }));
jest.mock('@/services/token.service', () => ({ TokenService: mockTokenService }));
jest.mock('@/services/email.service', () => ({
  EmailService: class EmailService {
    provider = { sendEmail: mockProviderSendEmail };
    sendPasswordResetEmail = mockSendPasswordResetEmail;
  },
}));

import { UserService } from '@/services/user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService();
  });

  it('listUsers applies filters and returns mapped pagination payload', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'u1@test.com',
        firstName: 'User',
        lastName: 'One',
        isActive: true,
        createdAt: new Date(),
        roles: [{ role: { id: 'role-1', name: 'Admin' } }],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await service.listUsers('biz-1', {
      q: 'u1',
      status: 'active',
      roleId: 'role-1',
      page: 1,
      limit: 10,
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          isActive: true,
          OR: expect.any(Array),
          roles: { some: { roleId: 'role-1' } },
        }),
      })
    );
    expect(result.items[0]).toEqual(expect.objectContaining({ roleCount: 1 }));
    expect(result.meta.total).toBe(1);
  });

  it('getUserById validates existence and ownership', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getUserById('biz-1', 'user-1')).rejects.toThrow('User not found');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', businessId: 'biz-2' });
    await expect(service.getUserById('biz-1', 'user-1')).rejects.toThrow(
      'Access denied to this user'
    );
  });

  it('getUserById maps roles and permissions summary', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u1@test.com',
      firstName: 'User',
      lastName: 'One',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      businessId: 'biz-1',
      roles: [
        {
          assignedAt: new Date(),
          role: {
            id: 'role-1',
            name: 'Admin',
            description: 'admin role',
            isSystem: true,
            permissions: [{}, {}],
          },
        },
      ],
    });

    const result = await service.getUserById('biz-1', 'user-1');
    expect(result.roleCount).toBe(1);
    expect(result.roles[0]).toEqual(expect.objectContaining({ id: 'role-1', permissionCount: 2 }));
  });

  it('createUser rejects duplicate email and invalid roles', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.createUser('biz-1', { email: 'dup@test.com' }, 'admin-1')
    ).rejects.toThrow('Email already registered');

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPasswordService.hash.mockResolvedValue('hash');
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    await expect(
      service.createUser('biz-1', { email: 'new@test.com', roleIds: ['role-1', 'role-2'] }, 'admin-1')
    ).rejects.toThrow('One or more roles do not exist or do not belong to this business');
  });

  it('createUser persists user/roles, audits and returns hydrated user', async () => {
    const getByIdSpy = jest.spyOn(service, 'getUserById').mockResolvedValue({ id: 'user-new' } as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('hashed-password');
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      email: 'new@test.com',
      firstName: 'New',
      lastName: 'User',
    });

    const result = await service.createUser(
      'biz-1',
      { email: 'new@test.com', firstName: 'New', lastName: 'User', roleIds: ['role-1'] },
      'admin-1'
    );

    expect(mockPasswordService.hash).toHaveBeenCalled();
    expect(mockPrisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-new', roleId: 'role-1' }],
    });
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalledWith('biz-1', 'user-new');
    expect(result).toEqual({ id: 'user-new' });
  });

  it('createUser does not fail when welcome email sending fails', async () => {
    jest.spyOn(service, 'getUserById').mockResolvedValue({ id: 'user-mail' } as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('hashed-password');
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-mail',
      email: 'mail@test.com',
      firstName: 'Mail',
      lastName: 'Fail',
    });
    mockProviderSendEmail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.createUser('biz-1', { email: 'mail@test.com' }, 'admin-1')
    ).resolves.toEqual({ id: 'user-mail' });
  });

  it('updateUser validates user/tenant and updates profile', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateUser('biz-1', 'user-1', { firstName: 'X' }, 'admin-1')
    ).rejects.toThrow('User not found');

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', businessId: 'biz-2' });
    await expect(
      service.updateUser('biz-1', 'user-1', { firstName: 'X' }, 'admin-1')
    ).rejects.toThrow('Access denied to this user');

    const getByIdSpy = jest.spyOn(service, 'getUserById').mockResolvedValue({ id: 'user-1' } as any);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      businessId: 'biz-1',
      firstName: 'Old',
      lastName: 'Name',
    });
    mockPrisma.user.update.mockResolvedValue({ firstName: 'New', lastName: 'Name' });

    const result = await service.updateUser('biz-1', 'user-1', { firstName: 'New' }, 'admin-1');
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-1' });
  });

  it('toggleUserStatus updates active flag and audits', async () => {
    const getByIdSpy = jest.spyOn(service, 'getUserById').mockResolvedValue({ id: 'user-1' } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', businessId: 'biz-1', isActive: true });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isActive: false });

    const result = await service.toggleUserStatus('biz-1', 'user-1', false, 'admin-1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    });
    expect(mockAuditService.logUpdate).toHaveBeenCalled();
    expect(getByIdSpy).toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-1' });
  });

  it('requestPasswordReset validates user, stores token hash and sends email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      businessId: 'biz-1',
      email: 'user@test.com',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-reset-token');

    const result = await service.requestPasswordReset('biz-1', 'user-1', 'admin-1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ resetToken: 'hashed-reset-token' }),
      })
    );
    expect(mockAuditService.log).toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).toHaveBeenCalled();
    expect(result).toEqual({ success: true, message: 'Password reset email sent' });
  });

  it('requestPasswordReset still succeeds when email delivery fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      businessId: 'biz-1',
      email: 'user@test.com',
    });
    mockTokenService.hashToken.mockReturnValue('hashed-reset-token');
    mockSendPasswordResetEmail.mockRejectedValue(new Error('smtp down'));

    const result = await service.requestPasswordReset('biz-1', 'user-1', 'admin-1');
    expect(result.success).toBe(true);
  });

  it('generates temporary password and reset token formats', () => {
    const temp = (service as any).generateTemporaryPassword();
    const reset = (service as any).generateResetToken();

    expect(temp).toHaveLength(12);
    expect(reset).toMatch(/^[a-f0-9]{64}$/);
  });
});
