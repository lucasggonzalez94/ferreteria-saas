import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTx = {
  user: { findFirst: jest.fn() as any, create: jest.fn() as any, update: jest.fn() as any },
  role: { findMany: jest.fn() as any },
  userRole: { createMany: jest.fn() as any },
  auditLog: { create: jest.fn() as any },
};

const mockRun = jest.fn() as any;
const mockSendWelcomeEmail = jest.fn() as any;

jest.mock('@/platform/tenancy/unit-of-work', () => ({
  unitOfWork: { run: mockRun, setTenant: jest.fn() as any },
  TenantUnitOfWork: class {},
}));
jest.mock('@/services/email.service', () => ({
  EmailService: class {
    sendWelcomeEmail = mockSendWelcomeEmail;
  },
}));

import { AppError } from '@/utils/response';
import { AuthService } from '@/services/auth.service';

describe('AuthService (legacy register/profile)', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockImplementation(async (_ctx: any, work: any) => work(mockTx));
    service = new AuthService();
  });

  it('register rejects invalid password rules', async () => {
    await expect(
      service.register({ businessId: 'biz-1', email: 'u1@test.com', password: 'short' }),
    ).rejects.toThrow(AppError);
  });

  it('register lowercases email and rejects duplicates within the unit of work', async () => {
    mockTx.user.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({ businessId: 'biz-1', email: 'U1@Test.com', password: 'Password123!' }),
    ).rejects.toThrow('Email already registered');
    expect(mockTx.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'u1@test.com' },
      select: { id: true },
    });
  });

  it('register validates roles belong to the tenant inside the same transaction', async () => {
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    await expect(
      service.register({
        businessId: 'biz-1',
        email: 'u1@test.com',
        password: 'Password123!',
        roleIds: ['role-1', 'role-2'],
      }),
    ).rejects.toThrow('One or more roles do not belong to this business');
  });

  it('register creates user, assigns roles and audits in the transaction', async () => {
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    mockTx.user.create.mockResolvedValue({
      id: 'user-1', email: 'u1@test.com', firstName: null, username: null,
    });

    const result = await service.register({
      businessId: 'biz-1', email: 'u1@test.com', password: 'Password123!', roleIds: ['role-1'],
    });

    expect(mockTx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ businessId: 'biz-1', userId: 'user-1', roleId: 'role-1' }],
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATE', entity: 'users', entityId: 'user-1' }),
      }),
    );
    expect(result.id).toBe('user-1');
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith('u1@test.com', 'Usuario');
  });

  it('updateProfile updates within tenant unit of work and audits', async () => {
    mockTx.user.update.mockResolvedValue({ id: 'user-1', firstName: 'Maria' });
    const result = await service.updateProfile('biz-1', 'user-1', ' Maria ');
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'biz-1', actorUserId: 'user-1' }),
      expect.any(Function),
    );
    expect(result.firstName).toBe('Maria');
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'PROFILE_UPDATED' }) }),
    );
  });
});
