import '@testing-library/jest-dom';

globalThis.fetch = globalThis.fetch || (async () => {
  throw new Error('fetch not implemented');
}) as typeof fetch;

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    getBlob: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    upload: jest.fn(),
    delete: jest.fn(),
  },
  getToken: jest.fn(() => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver || (ResizeObserverMock as any);
