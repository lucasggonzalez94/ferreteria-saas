import { describe, expect, it, jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn() as any,
};

jest.mock('@/config/logger', () => ({ logger: mockLogger }));

import { MockEmailProvider } from '@/providers/email/mock.provider';

describe('MockEmailProvider', () => {
  it('logs email preview and prints mock output', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const provider = new MockEmailProvider();

    await provider.sendEmail('user@test.com', 'Hola', '<p>Contenido</p>');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', subject: 'Hola' }),
      '📧 [MOCK] Email sent (development mode)'
    );
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
