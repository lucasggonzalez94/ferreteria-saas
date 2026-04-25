import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = {
  invoice: {
    provider: 'mock',
    facturante: {
      apiKey: 'fact-key',
      apiUrl: 'https://facturante.test',
    },
  },
};

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

const mockGetProviderCredentials = jest.fn() as any;

const mockCtor = jest.fn(function MockInvoiceProviderCtor() {}) as any;
const facturanteCtor = jest.fn(function FacturanteProviderCtor() {}) as any;
const arcaDirectCtor = jest.fn(function ArcaDirectProviderCtor(this: any, credentials: unknown) {
  this.credentials = credentials;
}) as any;

jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/services/arca-credentials.service', () => ({
  ArcaCredentialsService: {
    getProviderCredentials: mockGetProviderCredentials,
  },
}));
jest.mock('@/providers/invoice/mock.provider', () => ({
  MockInvoiceProvider: mockCtor,
}));
jest.mock('@/providers/invoice/facturante.provider', () => ({
  FacturanteProvider: facturanteCtor,
}));
jest.mock('@/providers/invoice/arca-direct.provider', () => ({
  ArcaDirectProvider: arcaDirectCtor,
}));

import { resolveInvoiceProvider } from '@/providers/invoice/provider-resolver';

describe('resolveInvoiceProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.invoice.provider = 'mock';
    mockEnv.invoice.facturante.apiKey = 'fact-key';
    mockEnv.invoice.facturante.apiUrl = 'https://facturante.test';
    mockGetProviderCredentials.mockResolvedValue(null);
  });

  it('usa provider mock por defecto', async () => {
    const out = await resolveInvoiceProvider({ businessId: 'biz-1' });

    expect(out.providerKey).toBe('mock');
    expect(mockCtor).toHaveBeenCalled();
  });

  it('usa facturante cuando se solicita y hay credenciales', async () => {
    const out = await resolveInvoiceProvider({ businessId: 'biz-1', businessProvider: 'facturante' });

    expect(out.providerKey).toBe('facturante');
    expect(facturanteCtor).toHaveBeenCalled();
  });

  it('hace fallback de facturante a mock cuando faltan credenciales', async () => {
    mockEnv.invoice.facturante.apiKey = '';

    const out = await resolveInvoiceProvider({ businessId: 'biz-1', businessProvider: 'facturante' });

    expect(out.providerKey).toBe('mock');
    expect(mockCtor).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('usa arca_direct cuando hay credenciales de ARCA', async () => {
    mockGetProviderCredentials.mockResolvedValue({ cuit: '201', token: 't', sign: 's' });

    const out = await resolveInvoiceProvider({ businessId: 'biz-1', businessProvider: 'arca_direct' });

    expect(out.providerKey).toBe('arca_direct');
    expect(arcaDirectCtor).toHaveBeenCalledWith({ cuit: '201', token: 't', sign: 's' });
  });

  it('hace fallback en cascada arca_direct -> facturante -> mock', async () => {
    mockGetProviderCredentials.mockResolvedValue(null);
    mockEnv.invoice.facturante.apiKey = '';

    const out = await resolveInvoiceProvider({ businessId: 'biz-2', businessProvider: 'arca_direct' });

    expect(out.providerKey).toBe('mock');
    expect(mockCtor).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('normaliza provider invalido al default de entorno', async () => {
    mockEnv.invoice.provider = 'facturante';

    const out = await resolveInvoiceProvider({ businessId: 'biz-3', businessProvider: 'invalid-provider' });

    expect(out.providerKey).toBe('facturante');
  });
});
