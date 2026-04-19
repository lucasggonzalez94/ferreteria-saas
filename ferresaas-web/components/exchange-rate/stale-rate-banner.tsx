"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, Info } from "lucide-react";

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
  const formatPublicationDate = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Publicado hoy a las ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Publicado ayer a las ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `Publicado el ${date.toLocaleDateString('es-AR')}`;
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'last_snapshot_fallback': 'última cotización guardada',
      'manual_fallback': 'cotización manual',
      'stale_snapshot_fallback': 'cotización desactualizada',
      'manual_user_input': 'ingreso manual',
      'manual_config': 'configuración manual',
      'ArgentinaDatos.com': 'ArgentinaDatos.com',
    };
    return labels[source] || source;
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] p-4 text-[hsl(var(--primary))] dark:border-[hsl(var(--brand-accent-border))] dark:bg-[hsl(var(--brand-accent-soft))] dark:text-foreground">
      <div className="flex items-center gap-3 flex-1">
        <div className="app-icon-badge h-10 w-10 flex-shrink-0 border-[hsl(var(--brand-accent-border))] bg-background/60 text-[hsl(var(--accent))]">
          <DollarSign className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            Tipo de cambio: ${rate.rate.toFixed(2)}
          </p>
          <div className="flex items-center gap-1 text-xs text-foreground/75 dark:text-foreground/75">
            <span>{getSourceLabel(rate.source)}</span>
            <span>•</span>
            <span>{formatPublicationDate(rate.timestamp)}</span>
            <div title="Esta es la fecha de publicación de la cotización, no el momento en que se obtuvo">
              <Info className="h-3 w-3 ml-1" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRetry}
          disabled={isRetrying}
          className="h-9 text-xs"
          title="Intenta obtener la cotización más reciente"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onUpdateManually}
          className="h-9 text-xs"
          title="Ingresa manualmente el tipo de cambio"
        >
          Ingresar Manual
        </Button>
      </div>
    </div>
  );
}
