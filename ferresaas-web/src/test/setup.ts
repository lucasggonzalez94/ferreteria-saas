import '@testing-library/jest-dom';

globalThis.fetch = globalThis.fetch || (async () => {
  throw new Error('fetch not implemented');
}) as typeof fetch;

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  getToken: jest.fn(() => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));