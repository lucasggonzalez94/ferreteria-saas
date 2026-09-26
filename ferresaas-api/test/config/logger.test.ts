import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/config/env', () => ({
  env: {
    logging: { level: 'info' },
    app: { isDevelopment: false },
  },
}));

describe('config/logger', () => {
  it('creates a logger instance with env configuration', () => {
    const module = jest.requireActual<typeof import('@/config/logger')>('@/config/logger');
    expect(module.logger).toBeDefined();
    expect(typeof module.logger.info).toBe('function');
  });
});
