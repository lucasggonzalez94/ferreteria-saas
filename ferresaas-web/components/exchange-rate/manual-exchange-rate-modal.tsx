"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Clock } from "lucide-react";
import { parseNumericInput } from "@/lib/numeric-input";

interface LastKnownRate {
  rate: number;
  dollarType: string;
  timestamp: Date | string;
  source: string;
}

interface ManualExchangeRateModalProps {
  isOpen: boolean;
  lastKnownRate?: LastKnownRate | null;
  dollarType: string;
  onUseLastKnown: () => void;
  onManualInput: (rate: number) => void;
  onCancel: () => void;
}

export function ManualExchangeRateModal({
  isOpen,
  lastKnownRate,
  dollarType,
  onUseLastKnown,
  onManualInput,
  onCancel,
}: ManualExchangeRateModalProps) {
  const [selectedOption, setSelectedOption] = useState<"last" | "manual">("last");
  const [manualRate, setManualRate] = useState("");

  const handleConfirm = () => {
    if (selectedOption === "last") {
      onUseLastKnown();
    } else {
      const rate = parseNumericInput(manualRate);
      if (rate > 0) {
        onManualInput(rate);
      }
    }
  };

  const getTimeSince = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    
    if (minutes < 60) return `hace ${minutes} minutos`;
    if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} horas`;
    return `hace ${Math.floor(minutes / 1440)} días`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            No se pudo obtener cotización
          </DialogTitle>
          <DialogDescription>
            No se pudo conectar con el servicio de cotizaciones. Selecciona cómo continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {lastKnownRate && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="use-last"
                  name="rate-option"
                  checked={selectedOption === "last"}
                  onChange={() => setSelectedOption("last")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="use-last" className="cursor-pointer font-medium">
                    Usar última cotización conocida
                  </Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="font-medium">{lastKnownRate.dollarType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cotización:</span>
                      <span className="font-medium">${lastKnownRate.rate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Actualizada:
                      </span>
                      <span>{getTimeSince(lastKnownRate.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  id="use-manual"
                  name="rate-option"
                  checked={selectedOption === "manual"}
                  onChange={() => setSelectedOption("manual")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="use-manual" className="cursor-pointer font-medium">
                    Ingresar cotización manualmente
                  </Label>
                  {selectedOption === "manual" && (
                    <div className="mt-2 space-y-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 1050.00"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">
                        Ingresa el valor actual del dólar en pesos argentinos
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!lastKnownRate && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay cotizaciones previas disponibles. Debes ingresar una cotización manualmente.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="manual-rate-only">Cotización (ARS por USD)</Label>
                <Input
                  id="manual-rate-only"
                  type="number"
                  step="0.01"
                  placeholder="Ej: 1050.00"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta cotización se guardará y se usará para futuras transacciones hasta que se actualice automáticamente.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (!lastKnownRate && !manualRate) ||
              (selectedOption === "manual" && parseNumericInput(manualRate) <= 0)
            }
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
