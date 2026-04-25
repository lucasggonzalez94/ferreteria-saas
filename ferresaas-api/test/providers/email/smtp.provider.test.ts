import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  email: {
    from: 'noreply@test.com',
    smtp: {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      user: 'smtp-user',
      pass: 'smtp-pass',
    },
  },
};

const mockLogger = {
  info: jest.fn() as any,
  error: jest.fn() as any,
};

const mockSendMail = jest.fn() as any;
const mockCreateTransport = jest.fn() as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: mockCreateTransport,
  },
}));

import { SmtpEmailProvider } from '@/providers/email/smtp.provider';

describe('SmtpEmailProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  it('creates transporter with SMTP env settings', () => {
    new SmtpEmailProvider();

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
  });

  it('sendEmail sends message and logs success', async () => {
    mockSendMail.mockResolvedValue({});
    const provider = new SmtpEmailProvider();

    await provider.sendEmail('u1@test.com', 'Asunto', '<p>Hola</p>');

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@test.com',
      to: 'u1@test.com',
      subject: 'Asunto',
      html: '<p>Hola</p>',
    });
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('sendEmail logs and rethrows provider errors', async () => {
    const smtpError = new Error('smtp error');
    mockSendMail.mockRejectedValue(smtpError);
    const provider = new SmtpEmailProvider();

    await expect(provider.sendEmail('u1@test.com', 'Asunto', '<p>Hola</p>')).rejects.toThrow('smtp error');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
