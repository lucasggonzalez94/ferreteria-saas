import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  user: {
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
  refreshTokenSession: {
    create: jest.fn() as any,
    findUnique: jest.fn() as any,
    findMany: jest.fn() as any,
    updateMany: jest.fn() as any,
    update: jest.fn() as any,
  },
  rolePermission: {
    findMany: jest.fn() as any,
  },
};

const mockPasswordService = {
  validate: jest.fn() as any,
  hash: jest.fn() as any,
  verify: jest.fn() as any,
};

const mockTokenService = {
  generateTokenPair: jest.fn() as any,
  verifyRefreshToken: jest.fn() as any,
  hashToken: jest.fn() as any,
  rotateRefreshToken: jest.fn() as any,
  verifyAccessToken: jest.fn() as any,
  generateResetToken: jest.fn() as any,
};

const mockAuditService = {
  logCreate: jest.fn() as any,
  log: jest.fn() as any,
};

const mockBlacklistService = {
  addToBlacklist: jest.fn() as any,
};

const mockSendWelcomeEmail = jest.fn() as any;
const mockSendPasswordResetEmail = jest.fn() as any;
const mockSendPasswordChangedEmail = jest.fn() as any;

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/services/password.service', () => ({ PasswordService: mockPasswordService }));
jest.mock('@/services/token.service', () => ({ TokenService: mockTokenService }));
jest.mock('@/services/audit.service', () => ({ AuditService: mockAuditService }));
jest.mock('@/services/token-blacklist.service', () => ({
  TokenBlacklistService: mockBlacklistService,
}));
jest.mock('@/services/email.service', () => ({
  EmailService: class EmailService {
    sendWelcomeEmail = mockSendWelcomeEmail;
    sendPasswordResetEmail = mockSendPasswordResetEmail;
    sendPasswordChangedEmail = mockSendPasswordChangedEmail;
  },
}));

import { AppError } from '@/utils/response';
import { AuthService } from '@/services/auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService();
  });

  it('register rejects invalid password rules', async () => {
    mockPasswordService.validate.mockReturnValue({ valid: false, errors: ['too short'] });

    await expect(
      service.register({
        businessId: 'biz-1',
        email: 'u1@test.com',
        password: '123',
      })
    ).rejects.toThrow(AppError);
  });

  it('register rejects duplicate email', async () => {
    mockPasswordService.validate.mockReturnValue({ valid: true, errors: [] });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-existing' });

    await expect(
      service.register({
        businessId: 'biz-1',
        email: 'u1@test.com',
        password: 'Password123!',
      })
    ).rejects.toThrow('Email already registered');
  });

  it('register rejects roleIds from another business', async () => {
    mockPasswordService.validate.mockReturnValue({ valid: true, errors: [] });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('hashed');
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'u1@test.com' });
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);

    await expect(
      service.register({
        businessId: 'biz-1',
        email: 'u1@test.com',
        password: 'Password123!',
        roleIds: ['role-1', 'role-2'],
      })
    ).rejects.toThrow('One or more roles do not belong to this business');
  });

  it('register creates user, assigns roles, audits and ignores welcome email failures', async () => {
    mockPasswordService.validate.mockReturnValue({ valid: true, errors: [] });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPasswordService.hash.mockResolvedValue('hashed');
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'u1@test.com',
      username: 'u1',
      firstName: 'User',
    });
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);
    mockSendWelcomeEmail.mockRejectedValue(new Error('smtp down'));

    const result = await service.register({
      businessId: 'biz-1',
      email: 'u1@test.com',
      username: 'u1',
      password: 'Password123!',
      firstName: 'User',
      roleIds: ['role-1'],
    });

    expect(mockPrisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-1' }],
    });
    expect(mockAuditService.logCreate).toHaveBeenCalled();
    expect(result.id).toBe('user-1');
  });

  it('login rejects inactive or missing users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('u1@test.com', 'Password123!')).rejects.toThrow('Invalid email or password');
  });

  it('login rejects invalid password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, password: 'hash' });
    mockPasswordService.verify.mockResolvedValue(false);

    await expect(service.login('u1@test.com', 'bad-pass')).rejects.toThrow('Invalid email or password');
  });

  it('login creates refresh session and returns deduplicated permissions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      businessId: 'biz-1',
      email: 'u1@test.com',
      firstName: 'User',
      lastName: 'One',
      password: 'hash',
      isActive: true,
      business: { id: 'biz-1', name: 'Ferreteria Demo', timezone: null, logoUrl: null },
      roles: [
        { roleId: 'role-1', role: { name: 'Admin' } },
        { roleId: 'role-2', role: { name: 'Cajero' } },
      ],
    });
    mockPasswordService.verify.mockResolvedValue(true);
    mockTokenService.generateTokenPair.mockReturnValue({
      tokenFamily: 'family-1',
      refreshTokenHash: 'hash-rt-1',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      csrfToken: 'csrf-1',
      csrfHash: 'csrf-hash-1',
    });
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { resource: 'products', action: 'read' } },
      { permission: { resource: 'products', action: 'read' } },
      { permission: { resource: 'sales', action: 'write' } },
    ]);

    const result = await service.login('u1@test.com', 'Password123!', '127.0.0.1', 'jest');

    expect(mockPrisma.refreshTokenSession.create).toHaveBeenCalled();
    expect(result.user.permissions).toEqual(['products:read', 'sales:write']);
    expect(result.business.timezone).toBe('America/Buenos_Aires');
  });

  it('refresh detects revoked session', async () => {
    mockTokenService.verifyRefreshToken.mockReturnValue({ tokenFamily: 'family-1' });
    mockTokenService.hashToken.mockReturnValue('hash-rt');
    mockPrisma.refreshTokenSession.findUnique.mockResolvedValue({ isRevoked: true });

    await expect(service.refresh('refresh-1')).rejects.toThrow('Refresh token has been revoked');
  });

  it('refresh rotates tokens on valid active session', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    mockTokenService.verifyRefreshToken.mockReturnValue({ tokenFamily: 'family-1' });
    mockTokenService.hashToken.mockReturnValue('hash-rt');
    mockPrisma.refreshTokenSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tokenFamily: 'family-1',
      isRevoked: false,
      expiresAt,
      user: {
        id: 'user-1',
        businessId: 'biz-1',
        email: 'u1@test.com',
        isActive: true,
      },
    });
    mockTokenService.rotateRefreshToken.mockReturnValue({
      refreshTokenHash: 'hash-rt-2',
      expiresAt: new Date(Date.now() + 120_000),
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      csrfToken: 'csrf-2',
      csrfHash: 'csrf-hash-2',
    });

    const result = await service.refresh('refresh-1', '127.0.0.1', 'jest');

    expect(mockPrisma.refreshTokenSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-1' } })
    );
    expect(result.refreshToken).toBe('refresh-2');
  });

  it('logout revokes refresh session and blacklists access token', async () => {
    mockTokenService.hashToken.mockReturnValue('hash-rt');
    mockPrisma.refreshTokenSession.findUnique.mockResolvedValue({
      id: 'session-1',
      businessId: 'biz-1',
      userId: 'user-1',
    });
    mockTokenService.verifyAccessToken.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 300 });

    const result = await service.logout('refresh-1', 'access-1', '127.0.0.1', 'jest');

    expect(mockPrisma.refreshTokenSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { isRevoked: true },
    });
    expect(mockBlacklistService.addToBlacklist).toHaveBeenCalled();
    expect(result.message).toBe('Logged out successfully');
  });

  it('forgotPassword returns generic message for unknown email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword('missing@test.com');

    expect(result.message).toBe('If the email exists, a reset link will be sent');
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('forgotPassword stores token hash and sends reset email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u1@test.com',
      businessId: 'biz-1',
    });
    mockTokenService.generateResetToken.mockReturnValue('plain-reset-token');
    mockTokenService.hashToken.mockReturnValue('hash-reset-token');

    await service.forgotPassword('u1@test.com');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ resetToken: 'hash-reset-token' }),
      })
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('u1@test.com', 'plain-reset-token');
  });

  it('resetPassword validates token and updates password', async () => {
    mockTokenService.hashToken.mockReturnValue('hash-reset-token');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u1@test.com',
      businessId: 'biz-1',
      resetTokenExpiry: new Date(Date.now() + 60_000),
    });
    mockPasswordService.validate.mockReturnValue({ valid: true, errors: [] });
    mockPasswordService.hash.mockResolvedValue('new-hash');
    const revokeSpy = jest.spyOn(service, 'revokeAllSessions').mockResolvedValue({ message: 'ok' });

    const result = await service.resetPassword('plain-token', 'NewPassword123!');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ password: 'new-hash', resetToken: null, resetTokenExpiry: null }),
      })
    );
    expect(revokeSpy).toHaveBeenCalledWith('user-1');
    expect(mockSendPasswordChangedEmail).toHaveBeenCalledWith('u1@test.com');
    expect(result.message).toBe('Password reset successfully');
  });

  it('changePassword prevents reusing current password and updates when valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u1@test.com',
      businessId: 'biz-1',
      password: 'current-hash',
    });

    mockPasswordService.verify
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockPasswordService.validate.mockReturnValue({ valid: true, errors: [] });
    mockPasswordService.hash.mockResolvedValue('new-hash');
    const revokeSpy = jest.spyOn(service, 'revokeAllSessions').mockResolvedValue({ message: 'ok' });

    const result = await service.changePassword('user-1', 'Current123!', 'NewPassword123!');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'new-hash' },
    });
    expect(revokeSpy).toHaveBeenCalledWith('user-1');
    expect(result.message).toBe('Password changed successfully');
  });
});
