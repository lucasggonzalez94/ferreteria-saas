"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign } from "lucide-react";

interface StaleRateBannerProps {
  rate: {
    rate: number;
    timestamp: Date | string;
    source: string;
  };
  onRetry: () => void;
  onUpdateManually: () => void;
  isRetrying?: boolean;
}

export function StaleRateBanner({ rate, onRetry, onUpdateManually, isRetrying }: StaleRateBannerProps) {
  const getTimeSince = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    
    if (minutes < 60) return `hace ${minutes} minutos`;
    if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} horas`;
    return `hace ${Math.floor(minutes / 1440)} días`;
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'last_snapshot_fallback': 'última cotización guardada',
      'manual_fallback': 'cotización manual',
      'stale_snapshot_fallback': 'cotización desactualizada',
      'manual_user_input': 'ingreso manual',
      'manual_config': 'configuración manual',
    };
    return labels[source] || source;
  };

  return (
    <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1">
        <DollarSign className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Tipo de cambio: ${rate.rate.toFixed(2)}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {getSourceLabel(rate.source)} • {getTimeSince(rate.timestamp)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRetry}
          disabled={isRetrying}
          className="text-xs h-8"
          title="Intenta obtener la cotización más reciente de la API"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onUpdateManually}
          className="text-xs h-8"
          title="Ingresa manualmente el tipo de cambio"
        >
          Ingresar Manual
        </Button>
      </div>
    </div>
  );
}
