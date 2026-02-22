"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

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
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="font-medium">Usando {getSourceLabel(rate.source)}</span>
          <span className="text-sm text-muted-foreground ml-2">
            ${rate.rate.toFixed(2)} ({getTimeSince(rate.timestamp)})
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onUpdateManually}
          >
            Actualizar Manualmente
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
