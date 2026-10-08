import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { rateLimit: { windowMs: 60000, maxRequests: 50 } };
const mockRateLimit = jest.fn() as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('express-rate-limit', () => ({ __esModule: true, default: mockRateLimit }));

describe('general rate limiter config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValueOnce('general-middleware');
  });

  it('builds the general limiter with expected options', () => {
    const module = jest.requireActual<typeof import('@/middleware/rate-limit')>('@/middleware/rate-limit');

    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    const generalConfig = mockRateLimit.mock.calls[0][0];
    expect(generalConfig.windowMs).toBe(60000);
    expect(generalConfig.max).toBe(50);
    expect(generalConfig.message.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(module.generalLimiter).toBe('general-middleware');
  });
});
