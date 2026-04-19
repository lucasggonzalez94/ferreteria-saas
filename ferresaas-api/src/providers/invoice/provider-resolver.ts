import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { InvoiceProvider } from './invoice.provider.interface';
import { ArcaDirectProvider } from './arca-direct.provider';
import { FacturanteProvider } from './facturante.provider';
import { MockInvoiceProvider } from './mock.provider';

export type InvoiceProviderKey = 'mock' | 'facturante' | 'arca_direct';

interface ResolveInvoiceProviderInput {
  businessId: string;
  businessProvider?: string | null;
}

interface ResolvedInvoiceProvider {
  provider: InvoiceProvider;
  providerKey: InvoiceProviderKey;
}

const FALLBACKS: Record<InvoiceProviderKey, InvoiceProviderKey[]> = {
  arca_direct: ['arca_direct', 'facturante', 'mock'],
  facturante: ['facturante', 'mock'],
  mock: ['mock'],
};

function normalizeProviderKey(value?: string | null): InvoiceProviderKey | null {
  if (!value) {
    return null;
  }

  if (value === 'mock' || value === 'facturante' || value === 'arca_direct') {
    return value;
  }

  return null;
}

function buildProvider(key: InvoiceProviderKey): InvoiceProvider | null {
  if (key === 'mock') {
    return new MockInvoiceProvider();
  }

  if (key === 'facturante') {
    if (!env.invoice.facturante.apiKey || !env.invoice.facturante.apiUrl) {
      return null;
    }

    return new FacturanteProvider();
  }

  if (key === 'arca_direct') {
    if (!env.invoice.arca.cuit || !env.invoice.arca.token || !env.invoice.arca.sign) {
      return null;
    }

    return new ArcaDirectProvider();
  }

  return null;
}

export function resolveInvoiceProvider({
  businessId,
  businessProvider,
}: ResolveInvoiceProviderInput): ResolvedInvoiceProvider {
  const envDefaultProvider = normalizeProviderKey(env.invoice.provider) ?? 'mock';
  const requestedProvider = normalizeProviderKey(businessProvider) ?? envDefaultProvider;
  const candidates = FALLBACKS[requestedProvider];

  for (const candidate of candidates) {
    const provider = buildProvider(candidate);
    if (provider) {
      if (candidate !== requestedProvider) {
        logger.warn(
          {
            businessId,
            requestedProvider,
            selectedProvider: candidate,
          },
          'Invoice provider fallback applied'
        );
      }

      return {
        provider,
        providerKey: candidate,
      };
    }
  }

  logger.warn(
    {
      businessId,
      requestedProvider,
      envDefaultProvider,
    },
    'No invoice provider available, using mock provider'
  );

  return {
    provider: new MockInvoiceProvider(),
    providerKey: 'mock',
  };
}
