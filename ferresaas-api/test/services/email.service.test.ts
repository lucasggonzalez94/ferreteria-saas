import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  email: {
    provider: 'mock',
  },
  app: {
    frontendUrl: 'http://localhost:3000',
  },
};

const mockLogger = {
  info: jest.fn() as any,
};

const mockMockProviderSend = jest.fn() as any;
const mockSmtpProviderSend = jest.fn() as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/providers/email/mock.provider', () => ({
  MockEmailProvider: jest.fn().mockImplementation(() => ({
    sendEmail: mockMockProviderSend,
  })),
}));
jest.mock('@/providers/email/smtp.provider', () => ({
  SmtpEmailProvider: jest.fn().mockImplementation(() => ({
    sendEmail: mockSmtpProviderSend,
  })),
}));

import { EmailService } from '@/services/email.service';

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.email.provider = 'mock';
  });

  it('uses mock provider when env provider is mock', async () => {
    const service = new EmailService();

    await service.sendWelcomeEmail('u1@test.com', 'Carlos');

    expect(mockMockProviderSend).toHaveBeenCalledWith(
      'u1@test.com',
      'Bienvenido a FerreSaaS',
      expect.stringContaining('Carlos')
    );
  });

  it('uses smtp provider when env provider is smtp', async () => {
    mockEnv.email.provider = 'smtp';
    const service = new EmailService();

    await service.sendPasswordChangedEmail('u1@test.com');

    expect(mockSmtpProviderSend).toHaveBeenCalledWith(
      'u1@test.com',
      'Contraseña modificada - FerreSaaS',
      expect.stringContaining('Contraseña modificada')
    );
  });

  it('builds reset url in password reset email html', async () => {
    const service = new EmailService();

    await service.sendPasswordResetEmail('u1@test.com', 'token-123');

    expect(mockMockProviderSend).toHaveBeenCalledWith(
      'u1@test.com',
      'Restablecer contraseña - FerreSaaS',
      expect.stringContaining('http://localhost:3000/reset-password?token=token-123')
    );
  });
});
