import { describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  invoice: {
    credentialsSecret: 'test-secret-key-for-aes-roundtrip',
  },
};

jest.mock('@/config/env', () => ({ env: mockEnv }));

import { decryptSecret, encryptSecret } from '@/utils/secure-config';

describe('secure-config utils', () => {
  it('encryptSecret + decryptSecret roundtrip original value', () => {
    const secret = 'arca-token-123';

    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);

    expect(encrypted).not.toBe(secret);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decrypted).toBe(secret);
  });

  it('decryptSecret rejects malformed payloads', () => {
    expect(() => decryptSecret('broken-payload')).toThrow('Invalid encrypted payload format');
  });
});
