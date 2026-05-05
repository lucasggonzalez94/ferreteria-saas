"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ExchangeRateConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DollarSign,
  LogOut,
  TrendingUp,
  Plus,
  Eye,
  FileText,
  AlertCircle,
  RefreshCw,
  Building2,
  Smartphone,
  CreditCard,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Header from "@/components/ui/header";
import { Tooltip } from "@/components/ui/tooltip";

export default function CashRegisterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canAccessCashRegister =
    user?.permissions?.includes("cash_register:read");

  useEffect(() => {
    if (!canAccessCashRegister) {
      router.push("/dashboard");
      return;
    }
  }, [canAccessCashRegister, router]);

  const [openingAmount, setOpeningAmount] = useState("");
  const [openingAmountUSD, setOpeningAmountUSD] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closingAmountUSD, setClosingAmountUSD] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [movementType, setMovementType] = useState<"INCOME" | "EXPENSE">(
    "INCOME",
  );
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showDifferenceConfirmation, setShowDifferenceConfirmation] =
    useState(false);
  const [otherAccountsOnClose, setOtherAccountsOnClose] = useState<any[]>([]);
  const [pendingOpenAmount, setPendingOpenAmount] = useState<number | null>(
    null,
  );
  const [pendingOpenAmountUSD, setPendingOpenAmountUSD] = useState<
    number | null
  >(null);
  const [suggestedAmount, setSuggestedAmount] = useState<number>(0);
  const [suggestedAmountUSD, setSuggestedAmountUSD] = useState<number>(0);
  const [hasOpenedit, setHasOpenedit] = useState(false);
  const [hasOpeneditUSD, setHasOpeneditUSD] = useState(false);

  const {
    data: session,
    isLoading,
    refetch: refetchSession,
    isFetching: isFetchingSession,
  } = useQuery({
    queryKey: ["cash-register", "status"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/status");
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Obtener monto sugerido para apertura (balance de cuenta CASH)
  const { data: suggestedOpening } = useQuery({
    queryKey: ["cash-register", "suggested-opening"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/suggested-opening");
      return response.data;
    },
    enabled: !session, // Solo cuando no hay sesión abierta
  });

  // Obtener configuración de tipo de cambio
  const { data: exchangeConfig } = useQuery<ExchangeRateConfig>({
    queryKey: ["exchange-rate-config"],
    queryFn: async (): Promise<ExchangeRateConfig> => {
      const response = await api.get("/exchange-rate/config");
      return response.data as ExchangeRateConfig;
    },
  });

  const usdEnabled = exchangeConfig?.usdEnabled ?? false;

  // Prellenar los inputs con los montos sugeridos (solo la primera vez)
  useEffect(() => {
    if (!session && suggestedOpening) {
      if (!hasOpenedit && suggestedOpening.suggestedAmount !== undefined && !openingAmount) {
        setOpeningAmount(suggestedOpening.suggestedAmount.toString());
        setSuggestedAmount(suggestedOpening.suggestedAmount);
      }
      if (usdEnabled &&
        !hasOpeneditUSD &&
        suggestedOpening.suggestedAmountUSD !== undefined &&
        !openingAmountUSD
      ) {
        setOpeningAmountUSD(suggestedOpening.suggestedAmountUSD.toString());
        setSuggestedAmountUSD(suggestedOpening.suggestedAmountUSD);
      }
    }
  }, [suggestedOpening, usdEnabled, session]);

  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useQuery({
    queryKey: ["cash-register", session?.id, "summary"],
    queryFn: async () => {
      if (!session?.id) return null;
      const response = await api.get<any>(
        `/cash-register/${session.id}/summary`,
      );
      return response.data;
    },
    enabled: !!session?.id,
  });

  const openMutation = useMutation({
    mutationFn: async (data: { amount: number; amountUSD?: number }) => {
      const response = await api.post("/cash-register/open", {
        openingAmount: data.amount,
        openingAmountUSD: data.amountUSD || undefined,
        sourceAccountId: sourceAccountId || undefined,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      // Mostrar alertas si hubo diferencias registradas
      const messages = [];
      if (data.hasDifferenceARS) {
        const diffAmount = Math.abs(data.differenceWithAccountARS);
        const diffType =
          data.differenceWithAccountARS > 0 ? "ingreso" : "retiro";
        messages.push(`${diffType} de $${diffAmount.toFixed(2)} ARS`);
      }
      if (data.hasDifferenceUSD) {
        const diffAmount = Math.abs(data.differenceWithAccountUSD);
        const diffType =
          data.differenceWithAccountUSD > 0 ? "ingreso" : "retiro";
        messages.push(`${diffType} de $${diffAmount.toFixed(2)} USD`);
      }

      if (messages.length > 0) {
        toast.success(`Caja abierta. Se registró: ${messages.join(", ")}`, {
          duration: 5000,
        });
      } else {
        toast.success("Caja abierta exitosamente");
      }

      setOpeningAmount("");
      setOpeningAmountUSD("");
      setSourceAccountId("");
      setShowDifferenceConfirmation(false);
      setPendingOpenAmount(null);
      setPendingOpenAmountUSD(null);
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      setTimeout(() => {
        router.push("/dashboard/pos");
      }, 1000);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al abrir caja");
      setShowDifferenceConfirmation(false);
      setPendingOpenAmount(null);
      setPendingOpenAmountUSD(null);
    },
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(movementAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Monto inválido");
      }
      const response = await api.post("/cash-register/move", {
        type: movementType,
        amount,
        reason: movementReason,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Movimiento registrado exitosamente");
      setMovementAmount("");
      setMovementReason("");
      setShowMovementDialog(false);
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar movimiento");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (data: { amount: number; amountUSD?: number }) => {
      const response = await api.post("/cash-register/close", {
        closingAmount: data.amount,
        closingAmountUSD: data.amountUSD || undefined,
        destinationAccountId: destinationAccountId || undefined,
      });
      return response.data;
    },
onSuccess: (data: any) => {
      if (data.otherAccounts && data.otherAccounts.length > 0) {
        setOtherAccountsOnClose(data.otherAccounts);
        toast.success("Caja cerrada. Verificá el resumen de otras cuentas.");
      } else {
        toast.success("Caja cerrada exitosamente");
      }
      
      setClosingAmount("");
      setClosingAmountUSD("");
      setDestinationAccountId("");
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al cerrar caja");
    },
  });

  const handleOpen = () => {
    const amount = parseFloat(openingAmount);
    const amountUSD = openingAmountUSD ? parseFloat(openingAmountUSD) : 0;

    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido para ARS");
      return;
    }

    if (openingAmountUSD && (isNaN(amountUSD) || amountUSD < 0)) {
      toast.error("Ingrese un monto válido para USD");
      return;
    }

    // Verificar si hay diferencia con el balance de las cuentas
    const differenceARS = amount - suggestedAmount;
    const differenceUSD = amountUSD - suggestedAmountUSD;

    if (Math.abs(differenceARS) > 0.01 || Math.abs(differenceUSD) > 0.01) {
      // Mostrar confirmación de diferencia
      setPendingOpenAmount(amount);
      setPendingOpenAmountUSD(amountUSD > 0 ? amountUSD : null);
      setShowDifferenceConfirmation(true);
    } else {
      // No hay diferencia, abrir directamente
      openMutation.mutate({
        amount,
        amountUSD: amountUSD > 0 ? amountUSD : undefined,
      });
    }
  };

  const confirmOpenWithDifference = () => {
    if (pendingOpenAmount !== null) {
      openMutation.mutate({
        amount: pendingOpenAmount,
        amountUSD: pendingOpenAmountUSD || undefined,
      });
    }
  };

  const cancelOpenWithDifference = () => {
    setShowDifferenceConfirmation(false);
    setPendingOpenAmount(null);
    setPendingOpenAmountUSD(null);
    // Restaurar a los montos sugeridos
    setOpeningAmount(suggestedAmount.toString());
    setOpeningAmountUSD(suggestedAmountUSD.toString());
  };

  const handleAddMovement = () => {
    movementMutation.mutate();
  };

  const handleClose = () => {
    const amount = parseFloat(closingAmount);
    const amountUSD = closingAmountUSD ? parseFloat(closingAmountUSD) : 0;

    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido para ARS");
      return;
    }

    if (closingAmountUSD && (isNaN(amountUSD) || amountUSD < 0)) {
      toast.error("Ingrese un monto válido para USD");
      return;
    }

    closeMutation.mutate({
      amount,
      amountUSD: amountUSD > 0 ? amountUSD : undefined,
    });
  };

  const handlePrintReport = async () => {
    if (!session) return;
    try {
      const blob = await api.getBlob(
        `/cash-register/${session.id}/summary/pdf`,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cierre-caja-${session.id}-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Error al generar el PDF. Por favor, intenta nuevamente.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto text-center">
          <LoadingSpinner text="Cargando estado de caja..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header
          title="Caja"
          actions={
            <>
              {session && (
                <Tooltip content="Refrescar datos" placement="bottom">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Refrescar datos de caja"
                    onClick={() => {
                      queryClient.invalidateQueries({
                        queryKey: ["cash-register"],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["financial-accounts"],
                      });
                      refetchSession();
                      refetchSummary();
                    }}
                    disabled={isFetchingSession || isFetchingSummary}
                  >
                    <RefreshCw
                      className={`h-5 w-5 ${isFetchingSession || isFetchingSummary ? "animate-spin" : ""}`}
                    />
                  </Button>
                </Tooltip>
              )}
            </>
          }
        />

        {!session ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Abrir Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="openingAmount">Monto Inicial (ARS) *</Label>
                  <Input
                    id="openingAmount"
                    type="number"
                    step="0.01"
                    value={openingAmount}
                    onFocus={() => {
                      setHasOpenedit(true);
                      if (openingAmount === "0") {
                        setOpeningAmount("");
                      }
                    }}
                    onChange={(e) => {
                      setHasOpenedit(true);
                      setOpeningAmount(e.target.value);
                    }}
                    placeholder="0,00"
                    className="text-lg"
                  />
                  {suggestedOpening && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Balance actual: $
                      {suggestedOpening.suggestedAmount.toFixed(2)} ARS
                    </p>
                  )}
                </div>

                {usdEnabled && (
                <div>
                  <Label htmlFor="openingAmountUSD">Monto Inicial (USD)</Label>
                  {!suggestedOpening?.hasUSDAccount ? (
                    <div className="mt-2 space-y-2">
                      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          ⚠️ No hay cuenta Efectivo USD configurada. 
                          <button
                            type="button"
                            onClick={() => router.push("/dashboard/financial-accounts?create=USD")}
                            className="underline font-medium ml-1 hover:text-yellow-900 dark:hover:text-yellow-100"
                          >
                            Crear cuenta USD →
                          </button>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="openingAmountUSD"
                        type="number"
                        step="0.01"
                        value={openingAmountUSD}
                        onFocus={() => {
                          setHasOpeneditUSD(true);
                          if (openingAmountUSD === "0") {
                            setOpeningAmountUSD("");
                          }
                        }}
                        onChange={(e) => {
                          setHasOpeneditUSD(true);
                          setOpeningAmountUSD(e.target.value);
                        }}
                        placeholder="0,00"
                        className="text-lg"
                      />
                      {suggestedOpening &&
                        suggestedOpening.suggestedAmountUSD > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            💵 Balance actual: $
                            {suggestedOpening.suggestedAmountUSD.toFixed(2)} USD
                          </p>
                        )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Opcional - Solo si maneja efectivo en dólares
                      </p>
                    </>
                  )}
                </div>
                )}

                <Button
                  onClick={handleOpen}
                  disabled={openMutation.isPending}
                  className="w-full h-12"
                >
                  {openMutation.isPending ? "Abriendo..." : "Abrir Caja"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Estado actual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Caja Abierta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Monto Inicial
                    </p>
                    <p className="text-2xl font-bold">
                      ${Number(session.openingAmount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas</p>
                    <p className="text-2xl font-bold">
                      {session._count?.sales || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Movimientos</p>
                    <p className="text-2xl font-bold">
                      {session.movements?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">
                    Abierta desde:
                  </p>
                  <p className="font-medium">
                    {new Date(session.openedAt).toLocaleString("es-AR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Resumen por medio de pago */}
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Resumen por Medio de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(summary.paymentsByMethod || {}).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">No hay ventas registradas</p>
                      <p className="text-sm">
                        Las ventas realizadas aparecerán aquí desglosadas por medio de pago
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(summary.paymentsByMethod).map(
                          ([method, amount]) => (
                            <div key={method} className="border rounded-lg p-4">
                              <p className="text-sm text-muted-foreground">
                                {method === "CASH_ARS"
                                  ? "Efectivo ARS"
                                  : method === "CASH_USD"
                                    ? "Efectivo USD"
                                    : method === "CARD"
                                      ? "Tarjeta"
                                      : method === "TRANSFER"
                                        ? "Transferencia"
                                        : method === "QR"
                                          ? "QR"
                                          : method}
                              </p>
                              <p className="text-xl font-bold">
                                ${(amount as number).toFixed(2)}
                              </p>
                            </div>
                          ),
                        )}
                      </div>

                      {summary.movements && summary.movements.length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="font-semibold mb-2">
                            Movimientos Manuales:
                          </p>
                          <div className="space-y-2">
                            {summary.movements.map((movement: any) => (
                              <div
                                key={movement.id}
                                className="flex justify-between text-sm p-2 bg-muted rounded"
                              >
                                <span>
                                  {movement.type === "INCOME"
                                    ? "Ingreso"
                                    : "Egreso"}{" "}
                                  - {movement.reason}
                                </span>
                                <span
                                  className={
                                    movement.type === "INCOME"
                                      ? "text-green-600 font-semibold"
                                      : "text-red-600 font-semibold"
                                  }
                                >
                                  {movement.type === "INCOME" ? "+" : "-"}$
                                  {Number(movement.amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Movimientos de caja */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Movimientos de Caja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Dialog
                  open={showMovementDialog}
                  onOpenChange={setShowMovementDialog}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full">Registrar Movimiento</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Movimiento de Caja</DialogTitle>
                      <DialogDescription>
                        Registre un ingreso o egreso manual de caja
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="movementType">Tipo</Label>
                        <Select
                          value={movementType}
                          onValueChange={(value: any) => setMovementType(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">Ingreso</SelectItem>
                            <SelectItem value="EXPENSE">Egreso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="movementAmount">Monto</Label>
                        <Input
                          id="movementAmount"
                          type="number"
                          step="0.01"
                          value={movementAmount}
                          onChange={(e) => setMovementAmount(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>

                      <div>
                        <Label htmlFor="movementReason">Motivo</Label>
                        <Input
                          id="movementReason"
                          type="text"
                          value={movementReason}
                          onChange={(e) => setMovementReason(e.target.value)}
                          placeholder="Ej: Cambio de dinero, devolución, etc."
                        />
                      </div>

                      <Button
                        onClick={handleAddMovement}
                        disabled={movementMutation.isPending}
                        className="w-full"
                      >
                        {movementMutation.isPending
                          ? "Registrando..."
                          : "Registrar Movimiento"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Cerrar caja */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5" />
                  Cerrar Caja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary && (
                    <div className="brand-accent-panel mb-4 p-4">
                      <p className="mb-3 font-semibold text-foreground">
                        Montos esperados
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">
                            Esperado (ARS)
                          </p>
                          <p className="text-lg font-bold text-foreground">
                            ${Number(summary.expectedAmount).toFixed(2)}
                          </p>
                        </div>
                        {summary.expectedAmountUSD > 0 && (
                          <div>
                            <p className="text-muted-foreground">
                              Esperado (USD)
                            </p>
                            <p className="text-lg font-bold text-foreground">
                              ${Number(summary.expectedAmountUSD).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                      {closingAmount && (
                        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-[hsl(var(--brand-accent-border))] pt-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              Diferencia (ARS)
                            </p>
                            <p
                              className={`text-lg font-bold ${
                                parseFloat(closingAmount) -
                                  summary.expectedAmount ===
                                0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-orange-600 dark:text-orange-400"
                              }`}
                            >
                              $
                              {(
                                parseFloat(closingAmount) -
                                summary.expectedAmount
                              ).toFixed(2)}
                            </p>
                          </div>
                          {closingAmountUSD &&
                            summary.expectedAmountUSD > 0 && (
                              <div>
                                <p className="text-muted-foreground">
                                  Diferencia (USD)
                                </p>
                                <p
                                  className={`text-lg font-bold ${
                                    parseFloat(closingAmountUSD) -
                                      summary.expectedAmountUSD ===
                                    0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-orange-600 dark:text-orange-400"
                                  }`}
                                >
                                  $
                                  {(
                                    parseFloat(closingAmountUSD) -
                                    summary.expectedAmountUSD
                                  ).toFixed(2)}
                                </p>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="closingAmount">Monto Final (ARS) *</Label>
                    <Input
                      id="closingAmount"
                      type="number"
                      step="0.01"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      placeholder="0,00"
                      className="text-lg"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Ingrese el monto total contado en pesos
                    </p>
                  </div>

                  {usdEnabled && summary && summary.expectedAmountUSD > 0 && (
<div>
                    <Label htmlFor="closingAmountUSD">
                      Monto Final (USD)
                    </Label>
                    <Input
                      id="closingAmountUSD"
                      type="number"
                      step="0.01"
                      value={closingAmountUSD}
                      onChange={(e) => setClosingAmountUSD(e.target.value)}
                      placeholder="0,00"
                      className="text-lg"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Ingrese el monto total contado en dólares
                    </p>
                  </div>
                  )}

                  {otherAccountsOnClose.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <p className="font-semibold mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Otras cuentas
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {otherAccountsOnClose.map((acc) => {
                          const Icon = acc.type === 'BANK' ? Building2 : 
                                       acc.type === 'WALLET' ? Smartphone : 
                                       CreditCard;
                          return (
                            <div 
                              key={acc.id} 
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{acc.name}</span>
                              </div>
                              <span className="font-semibold">
                                ${acc.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })} {acc.currency}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleClose}
                      disabled={closeMutation.isPending}
                      variant="destructive"
                      className="flex-1 h-12"
                    >
                      {closeMutation.isPending ? "Cerrando..." : "Cerrar Caja"}
                    </Button>
                    {summary && (
                      <Button
                        onClick={handlePrintReport}
                        variant="outline"
                        className="h-12"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Reporte
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de confirmación de diferencia */}
        <Dialog
          open={showDifferenceConfirmation}
          onOpenChange={setShowDifferenceConfirmation}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                Diferencia Detectada
              </DialogTitle>
              <DialogDescription>
                El monto ingresado no coincide con el balance actual de la
                cuenta de efectivo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="space-y-3">
                  {/* ARS */}
                  <div>
                    <p className="text-sm font-medium mb-1">ARS</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Balance en cuenta:
                        </span>
                        <span className="text-sm font-bold">
                          ${suggestedAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Monto a abrir:
                        </span>
                        <span className="text-sm font-bold">
                          ${(pendingOpenAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-yellow-300 pt-1 mt-1">
                        <span className="text-sm font-medium">Diferencia:</span>
                        <span
                          className={`text-sm font-bold ${
                            (pendingOpenAmount || 0) - suggestedAmount > 0
                              ? "text-green-600"
                              : (pendingOpenAmount || 0) - suggestedAmount < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          {(pendingOpenAmount || 0) - suggestedAmount > 0
                            ? "+"
                            : ""}
                          $
                          {((pendingOpenAmount || 0) - suggestedAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* USD */}
                  {usdEnabled && (
                    <div className="border-t border-yellow-300 pt-3 mt-3">
                      <p className="text-sm font-medium mb-1">USD</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Balance en cuenta:
                          </span>
                          <span className="text-sm font-bold">
                            ${suggestedAmountUSD.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Monto a abrir:
                          </span>
                          <span className="text-sm font-bold">
                            ${((pendingOpenAmountUSD ?? 0) || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-yellow-300 pt-1 mt-1">
                          <span className="text-sm font-medium">Diferencia:</span>
                          <span
                            className={`text-sm font-bold ${
                              ((pendingOpenAmountUSD ?? 0) || 0) - suggestedAmountUSD >
                              0
                                ? "text-green-600"
                                : ((pendingOpenAmountUSD ?? 0) || 0) -
                                    suggestedAmountUSD <
                                  0
                                  ? "text-red-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {((pendingOpenAmountUSD ?? 0) || 0) - suggestedAmountUSD >
                            0
                              ? "+"
                              : ""}
                            $
                            {(
                              ((pendingOpenAmountUSD ?? 0) || 0) - suggestedAmountUSD
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {(() => {
                  const diffARS = (pendingOpenAmount || 0) - suggestedAmount;
                  const diffUSD =
                    ((pendingOpenAmountUSD ?? 0) || 0) - suggestedAmountUSD;
                  const hasARS = Math.abs(diffARS) > 0.01;
                  const hasUSD = Math.abs(diffUSD) > 0.01;

                  if (!hasARS && !hasUSD) {
                    return "✓ Los montos coinciden con el balance.";
                  }

                  const parts: string[] = [];
                  if (hasARS) {
                    parts.push(
                      diffARS > 0
                        ? `ARS: ingreso de $${Math.abs(diffARS).toFixed(2)}`
                        : `ARS: retiro de $${Math.abs(diffARS).toFixed(2)}`,
                    );
                  }
                  if (hasUSD) {
                    parts.push(
                      diffUSD > 0
                        ? `USD: ingreso de $${Math.abs(diffUSD).toFixed(2)}`
                        : `USD: retiro de $${Math.abs(diffUSD).toFixed(2)}`,
                    );
                  }

                  return `⚠️ Se registrará: ${parts.join(", ")} en la cuenta financiera.`;
                })()}
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={cancelOpenWithDifference}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmOpenWithDifference}
                  disabled={openMutation.isPending}
                  className="flex-1"
                >
                  {openMutation.isPending ? "Abriendo..." : "Confirmar y Abrir"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
