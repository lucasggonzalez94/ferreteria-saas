import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

interface LastKnownRate {
  rate: number;
  dollarType: string;
  timestamp: Date | string;
  source: string;
}

/**
 * Hook mejorado para obtener cotización con manejo de fallback
 */
export function useExchangeRateWithFallback() {
  const queryClient = useQueryClient();
  const [showManualModal, setShowManualModal] = useState(false);
  const [lastKnownRate, setLastKnownRate] = useState<LastKnownRate | null>(null);

  const { data: rate, error, isLoading, refetch } = useQuery<ExchangeRate>({
    queryKey: ['exchange-rate-current'],
    queryFn: async (): Promise<ExchangeRate> => {
      try {
        const response = await api.get('/exchange-rate/current');
        return response.data as ExchangeRate;
      } catch (error: any) {
        // Si el error indica que requiere input manual
        if (error.code === 'EXCHANGE_RATE_UNAVAILABLE' && error.details?.requiresManualInput) {
          setLastKnownRate(error.details.lastKnownRate);
          setShowManualModal(true);
        }
        throw error;
      }
    },
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Mutation para guardar cotización manual
  const saveManualRateMutation = useMutation({
    mutationFn: async (manualRate: number) => {
      const response = await api.post('/exchange-rate/manual-snapshot', {
        rate: manualRate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rate-current'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate-config'] });
      setShowManualModal(false);
      toast.success('Cotización manual guardada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al guardar cotización manual');
    },
  });

  const handleUseLastKnown = () => {
    setShowManualModal(false);
    // La última cotización ya está en el sistema, solo cerramos el modal
    refetch();
  };

  const handleManualRate = (manualRate: number) => {
    saveManualRateMutation.mutate(manualRate);
  };

  const handleCancel = () => {
    setShowManualModal(false);
  };

  const openManualModal = () => {
    setShowManualModal(true);
  };

  // Verificar si la cotización es stale (> 1 hora)
  const isStale = rate ? 
    (Date.now() - new Date(rate.timestamp).getTime()) / (1000 * 60) > 60 
    : false;

  // Verificar si es un fallback
  const isFallback = rate ? (rate.source.includes('fallback') || rate.source === 'stale_snapshot_fallback') : false;

  return {
    rate,
    error,
    isLoading,
    showManualModal,
    lastKnownRate,
    handleUseLastKnown,
    handleManualRate,
    handleCancel,
    openManualModal,
    refetch,
    isStale,
    isFallback,
    isSaving: saveManualRateMutation.isPending,
  };
}

/**
 * Hook para obtener el estado del sistema de cotizaciones
 */
interface ExchangeRateStatus {
  apiAvailable: boolean;
  lastUpdate: Date | null;
  currentSource: string;
  isStale: boolean;
  staleSince: number | null;
  lastKnownRate: ExchangeRate | null;
}

export function useExchangeRateStatus() {
  return useQuery<ExchangeRateStatus>({
    queryKey: ['exchange-rate-status'],
    queryFn: async (): Promise<ExchangeRateStatus> => {
      const response = await api.get('/exchange-rate/status');
      return response.data as ExchangeRateStatus;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
  });
}
