import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ExchangeRateConfig {
  id: string;
  businessId: string;
  usdEnabled: boolean;
  dollarType: string;
  marginPercent: number;
  autoUpdate: boolean;
  updateIntervalMinutes: number;
  manualRate?: number;
  useManualRate: boolean;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  buyRate?: number;
  sellRate?: number;
  source: string;
  dollarType: string;
  timestamp: Date | string;
}

/**
 * Hook para verificar si las operaciones en USD están habilitadas
 */
export function useUsdEnabled() {
  const { data: config, isLoading, error } = useQuery<ExchangeRateConfig>({
    queryKey: ['exchange-rate-config'],
    queryFn: async (): Promise<ExchangeRateConfig> => {
      const response = await api.get('/exchange-rate/config');
      return response.data as ExchangeRateConfig;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutos
    retry: 1,
  });

  return {
    usdEnabled: config?.usdEnabled ?? false,
    config,
    isLoading,
    error,
  };
}

/**
 * Hook para obtener la cotización actual (simple, sin fallback)
 */
export function useExchangeRate() {
  const { data: rate, isLoading, refetch, error } = useQuery<ExchangeRate>({
    queryKey: ['exchange-rate-current'],
    queryFn: async (): Promise<ExchangeRate> => {
      const response = await api.get('/exchange-rate/current');
      return response.data as ExchangeRate;
    },
    staleTime: 2 * 60 * 1000, // Cache 2 minutos
    retry: 1,
    enabled: false, // No cargar automáticamente
  });

  return {
    rate,
    isLoading,
    refetch,
    error,
  };
}
