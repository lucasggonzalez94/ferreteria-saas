import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  redis: {
    enabled: false,
    url: 'redis://localhost:6379',
  },
  app: {
    isProduction: false,
  },
};

const mockLogger = {
  info: jest.fn() as any,
  debug: jest.fn() as any,
  error: jest.fn() as any,
};

const mockClient = {
  on: jest.fn() as any,
  connect: jest.fn() as any,
  setEx: jest.fn() as any,
  exists: jest.fn() as any,
  keys: jest.fn() as any,
  del: jest.fn() as any,
  quit: jest.fn() as any,
};

const mockCreateClient = jest.fn() as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('redis', () => ({
  createClient: mockCreateClient,
}));

import { TokenBlacklistService } from '@/services/token-blacklist.service';

describe('TokenBlacklistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.app.isProduction = false;
    (TokenBlacklistService as any).client = null;
    (TokenBlacklistService as any).inMemoryBlacklist = null;
    (TokenBlacklistService as any).isEnabled = false;
    mockCreateClient.mockReturnValue(mockClient);
  });

  it('initialize logs fallback when redis is disabled', async () => {
    await TokenBlacklistService.initialize();
    expect(mockLogger.info).toHaveBeenCalledWith('Redis disabled, token blacklist will use in-memory storage');
  });

  it('initialize connects redis client when enabled', async () => {
    (TokenBlacklistService as any).isEnabled = true;
    mockClient.connect.mockResolvedValue(undefined);

    await TokenBlacklistService.initialize();

    expect(mockCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
    expect(mockClient.connect).toHaveBeenCalled();
  });

  it('addToBlacklist and isBlacklisted work with in-memory fallback', async () => {
    await TokenBlacklistService.addToBlacklist('token-1', 60);
    const blacklisted = await TokenBlacklistService.isBlacklisted('token-1');

    expect(blacklisted).toBe(true);
  });

  it('isBlacklisted removes expired in-memory entries', async () => {
    const key = (TokenBlacklistService as any).buildKey('token-2');
    (TokenBlacklistService as any).inMemoryBlacklist = new Map([[key, Date.now() - 1000]]);
    const blacklisted = await TokenBlacklistService.isBlacklisted('token-2');

    expect(blacklisted).toBe(false);
  });

  it('uses redis client when available', async () => {
    (TokenBlacklistService as any).client = mockClient;
    mockClient.exists.mockResolvedValue(1);

    await TokenBlacklistService.addToBlacklist('token-3', 10);
    const blacklisted = await TokenBlacklistService.isBlacklisted('token-3');

    expect(mockClient.setEx).toHaveBeenCalled();
    expect(blacklisted).toBe(true);
  });

  it('returns fail-closed result in production on read errors', async () => {
    (TokenBlacklistService as any).client = mockClient;
    mockClient.exists.mockRejectedValue(new Error('redis timeout'));
    mockEnv.app.isProduction = true;

    const blacklisted = await TokenBlacklistService.isBlacklisted('token-4');

    expect(blacklisted).toBe(true);
  });

  it('clear removes blacklist entries from memory and redis', async () => {
    await TokenBlacklistService.addToBlacklist('token-5', 10);
    await TokenBlacklistService.clear();

    expect((TokenBlacklistService as any).inMemoryBlacklist.size).toBe(0);

    (TokenBlacklistService as any).client = mockClient;
    mockClient.keys.mockResolvedValue(['blacklist:key-1']);
    await TokenBlacklistService.clear();

    expect(mockClient.del).toHaveBeenCalledWith(['blacklist:key-1']);
  });

  it('disconnect quits redis client and resets it', async () => {
    (TokenBlacklistService as any).client = mockClient;
    mockClient.quit.mockResolvedValue(undefined);

    await TokenBlacklistService.disconnect();

    expect(mockClient.quit).toHaveBeenCalled();
    expect((TokenBlacklistService as any).client).toBeNull();
  });
});
