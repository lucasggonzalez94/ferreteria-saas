"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, DollarSign, AlertCircle } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseNumericInput } from "@/lib/numeric-input";

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
}

interface DollarQuote {
  casa: string;
  compra: number;
  venta: number;
  fecha: string;
}

// Mapeo de nombres legibles para tipos de dólar
const DOLLAR_TYPE_NAMES: Record<string, string> = {
  oficial: "Oficial",
  blue: "Blue",
  bolsa: "Bolsa",
  contadoconliqui: "Contado con Liqui",
  cripto: "Cripto",
  mayorista: "Mayorista",
  solidario: "Solidario",
  turista: "Turista",
  tarjeta: "Tarjeta",
};

export default function ExchangeRateConfigPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManageSettings = user?.permissions?.includes("settings:update");

  useEffect(() => {
    if (!canManageSettings) {
      router.push("/dashboard");
      return;
    }
  }, [canManageSettings, router]);

  const [usdEnabled, setUsdEnabled] = useState(false);
  const [dollarType, setDollarType] = useState("oficial");
  const [marginPercent, setMarginPercent] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState("30");
  const [useManualRate, setUseManualRate] = useState(false);
  const [manualRate, setManualRate] = useState("");

  // Obtener configuración actual
  const { data: config, isLoading: configLoading } = useQuery<ExchangeRateConfig>({
    queryKey: ["exchange-rate-config"],
    queryFn: async (): Promise<ExchangeRateConfig> => {
      const response = await api.get("/exchange-rate/config");
      return response.data as ExchangeRateConfig;
    },
  });

  // Obtener todos los tipos de dólar disponibles
  const { 
    data: allRates, 
    isLoading: ratesLoading, 
    isError: ratesError,
    error: ratesErrorDetails,
    refetch: refetchRates 
  } = useQuery<DollarQuote[]>({
    queryKey: ["exchange-rate-types"],
    queryFn: async (): Promise<DollarQuote[]> => {
      const response = await api.get("/exchange-rate/types");
      return response.data as DollarQuote[];
    },
    enabled: usdEnabled,
    retry: 2,
  });

  // Prellenar form con configuración actual
  useEffect(() => {
    if (config) {
      setUsdEnabled(config.usdEnabled);
      setDollarType(config.dollarType);
      setMarginPercent(config.marginPercent.toString());
      setAutoUpdate(config.autoUpdate);
      setUpdateIntervalMinutes(config.updateIntervalMinutes.toString());
      setUseManualRate(config.useManualRate);
      setManualRate(config.manualRate?.toString() || "");
    }
  }, [config]);

  // Mutation para actualizar configuración
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put("/exchange-rate/config", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-config"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-current"] });
      toast.success("Configuración actualizada exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar configuración");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      usdEnabled,
      dollarType,
      marginPercent: parseNumericInput(marginPercent),
      autoUpdate,
      updateIntervalMinutes: parseInt(updateIntervalMinutes),
      useManualRate,
      manualRate: useManualRate && manualRate ? parseNumericInput(manualRate) : undefined,
    };

    updateConfigMutation.mutate(data);
  };

  // Calcular cotización final con margen
  const selectedRate = allRates?.find(r => r.casa === dollarType);
  const finalRate = selectedRate 
    ? selectedRate.venta * (1 + parseNumericInput(marginPercent || "0") / 100)
    : 0;

  if (configLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Header
          title="Configuración de Tipo de Cambio"
          description="Administra las operaciones en dólares y la cotización"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Habilitar USD */}
          <Card>
            <CardHeader>
              <CardTitle>Operaciones en Dólares</CardTitle>
              <CardDescription>
                Habilita o deshabilita las operaciones en USD en todo el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="usd-enabled">Permitir cobros y pagos en dólares</Label>
                  <p className="text-sm text-muted-foreground">
                    Al desactivar, se ocultarán las opciones de USD en POS, compras y pagos
                  </p>
                </div>
                <Switch
                  id="usd-enabled"
                  checked={usdEnabled}
                  onCheckedChange={setUsdEnabled}
                />
              </div>

              {!usdEnabled && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Las operaciones en USD están deshabilitadas. Los usuarios no podrán cobrar ni pagar en dólares.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {usdEnabled && (
            <>
              {/* Tipo de Dólar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Tipo de Dólar</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => refetchRates()}
                      disabled={ratesLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${ratesLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Selecciona qué cotización usar para las operaciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ratesError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No se pudieron cargar los tipos de dólar desde ArgentinaDatos. 
                        {ratesErrorDetails?.message && ` Error: ${ratesErrorDetails.message}`}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => refetchRates()}
                          className="ml-2"
                        >
                          Reintentar
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {ratesLoading && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Cargando tipos de dólar desde ArgentinaDatos...
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="dollar-type">Cotización</Label>
                    <Select value={dollarType} onValueChange={setDollarType} disabled={ratesLoading || ratesError}>
                      <SelectTrigger id="dollar-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allRates?.map((rate) => (
                          <SelectItem key={rate.casa} value={rate.casa}>
                            <span className="font-medium">{DOLLAR_TYPE_NAMES[rate.casa] || rate.casa}</span>
                            {" - "}
                            <span className="text-muted-foreground">
                              Compra: ${Number(rate.compra).toFixed(2)} / Venta: ${Number(rate.venta).toFixed(2)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRate && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between text-sm mb-2 pb-2 border-b">
                        <span className="font-medium">{DOLLAR_TYPE_NAMES[selectedRate.casa] || selectedRate.casa}</span>
                        <span className="text-xs text-muted-foreground">Actualizado: {selectedRate.fecha}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Precio de compra:</span>
                        <span className="font-medium">${Number(selectedRate.compra).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Precio de venta:</span>
                        <span className="font-medium">${Number(selectedRate.venta).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Margen */}
              <Card>
                <CardHeader>
                  <CardTitle>Margen Adicional</CardTitle>
                  <CardDescription>
                    Agrega un porcentaje sobre la cotización oficial
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="margin">Margen (%)</Label>
                    <Input
                      id="margin"
                      type="number"
                      step="0.01"
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  {selectedRate && marginPercent && (
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Cotización final</p>
                          <p className="text-xs text-muted-foreground">
                            {DOLLAR_TYPE_NAMES[selectedRate.casa] || selectedRate.casa} ${Number(selectedRate.venta).toFixed(2)} + {marginPercent}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">${Number(finalRate).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">ARS por USD</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actualización Automática */}
              <Card>
                <CardHeader>
                  <CardTitle>Actualización Automática</CardTitle>
                  <CardDescription>
                    Configura la frecuencia de actualización de la cotización
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-update">Actualizar automáticamente</Label>
                    <Switch
                      id="auto-update"
                      checked={autoUpdate}
                      onCheckedChange={setAutoUpdate}
                    />
                  </div>

                  {autoUpdate && (
                    <div className="space-y-2">
                      <Label htmlFor="interval">Intervalo (minutos)</Label>
                      <Input
                        id="interval"
                        type="number"
                        min="5"
                        max="1440"
                        value={updateIntervalMinutes}
                        onChange={(e) => setUpdateIntervalMinutes(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        La cotización se actualizará cada {updateIntervalMinutes} minutos
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cotización Manual */}
              <Card>
                <CardHeader>
                  <CardTitle>Cotización Manual (Fallback)</CardTitle>
                  <CardDescription>
                    Define una cotización fija en caso de que falle la API externa
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="use-manual">Usar cotización manual</Label>
                    <Switch
                      id="use-manual"
                      checked={useManualRate}
                      onCheckedChange={setUseManualRate}
                    />
                  </div>

                  {useManualRate && (
                    <div className="space-y-2">
                      <Label htmlFor="manual-rate">Valor (ARS por USD)</Label>
                      <Input
                        id="manual-rate"
                        type="number"
                        step="0.01"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        placeholder="1050.00"
                      />
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Esta cotización se usará en lugar de la API externa. Úsala solo como respaldo.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/settings")}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateConfigMutation.isPending}
            >
              {updateConfigMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
