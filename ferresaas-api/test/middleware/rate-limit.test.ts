import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  rateLimit: {
    windowMs: 60000,
    maxRequests: 50,
    refreshWindowMs: 300000,
    refreshMax: 9,
  },
};

const mockRateLimit = jest.fn() as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: mockRateLimit,
}));

describe('rate-limit middleware config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit
      .mockReturnValueOnce('general-middleware')
      .mockReturnValueOnce('auth-middleware')
      .mockReturnValueOnce('reset-middleware')
      .mockReturnValueOnce('refresh-middleware');
  });

  it('builds all limiters with expected options and messages', async () => {
    const module = await import('@/middleware/rate-limit');

    expect(mockRateLimit).toHaveBeenCalledTimes(4);

    const generalConfig = mockRateLimit.mock.calls[0][0];
    expect(generalConfig.windowMs).toBe(60000);
    expect(generalConfig.max).toBe(50);
    expect(generalConfig.message.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(generalConfig.standardHeaders).toBe(true);
    expect(generalConfig.legacyHeaders).toBe(false);

    const authConfig = mockRateLimit.mock.calls[1][0];
    expect(authConfig.windowMs).toBe(15 * 60 * 1000);
    expect(authConfig.max).toBe(5);
    expect(authConfig.skipSuccessfulRequests).toBe(true);
    expect(authConfig.message.error.code).toBe('LOGIN_RATE_LIMIT_EXCEEDED');

    const resetConfig = mockRateLimit.mock.calls[2][0];
    expect(resetConfig.windowMs).toBe(60 * 60 * 1000);
    expect(resetConfig.max).toBe(3);
    expect(resetConfig.message.error.code).toBe('RESET_RATE_LIMIT_EXCEEDED');

    const refreshConfig = mockRateLimit.mock.calls[3][0];
    expect(refreshConfig.windowMs).toBe(300000);
    expect(refreshConfig.max).toBe(9);
    expect(refreshConfig.message.error.code).toBe('REFRESH_RATE_LIMIT_EXCEEDED');

    expect(module.generalLimiter).toBe('general-middleware');
    expect(module.authLimiter).toBe('auth-middleware');
    expect(module.resetPasswordLimiter).toBe('reset-middleware');
    expect(module.refreshLimiter).toBe('refresh-middleware');
  });
});
