import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ApprovalCounts {
  discounts: number;
  prices: number;
}

/**
 * Hook para obtener conteos de aprobaciones pendientes
 * Se refresca automáticamente cada 30 segundos
 */
export function useApprovalCounts() {
  return useQuery<ApprovalCounts>({
    queryKey: ["approval-counts"],
    queryFn: async () => {
      const response = await api.get<ApprovalCounts>("/approvals/pending-count");
      return response.data || { discounts: 0, prices: 0 };
    },
    refetchInterval: 30000,
    staleTime: 0, // Los datos son inmediatamente stale, fuerza refetch al montar
    retry: 2,
    retryDelay: 1000,
    gcTime: 5 * 60 * 1000, // Mantener en caché por 5 minutos (antes cacheTime)
  });
}
