import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/config/env', () => ({
  env: {
    logging: { level: 'info' },
    app: { isDevelopment: false },
  },
}));

describe('config/logger', () => {
  it('creates a logger instance with env configuration', async () => {
    const module = await import('@/config/logger');
    expect(module.logger).toBeDefined();
    expect(typeof module.logger.info).toBe('function');
  });
});
