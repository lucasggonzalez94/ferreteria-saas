"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  LogOut,
  TrendingUp,
  Plus,
  Eye,
  FileText,
  AlertCircle,
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
import Link from "next/link";
import Header from "@/components/ui/header";

export default function CashRegisterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canAccessCashRegister = user?.permissions?.includes("cash_register:read");

  useEffect(() => {
    if (!canAccessCashRegister) {
      router.push("/dashboard");
      return;
    }
  }, [canAccessCashRegister, router]);
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [movementType, setMovementType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);


  const { data: session, isLoading } = useQuery({
    queryKey: ["cash-register", "status"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/status");
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: summary } = useQuery({
    queryKey: ["cash-register", session?.id, "summary"],
    queryFn: async () => {
      if (!session?.id) return null;
      const response = await api.get<any>(`/cash-register/${session.id}/summary`);
      return response.data;
    },
    enabled: !!session?.id,
  });

  const openMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.post("/cash-register/open", {
        openingAmount: amount,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Caja abierta exitosamente");
      setOpeningAmount("");
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setTimeout(() => {
        router.push("/dashboard/pos");
      }, 1000);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al abrir caja");
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
    mutationFn: async (amount: number) => {
      const response = await api.post("/cash-register/close", {
        closingAmount: amount,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Caja cerrada exitosamente");
      setClosingAmount("");
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al cerrar caja");
    },
  });

  const handleOpen = () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    openMutation.mutate(amount);
  };

  const handleAddMovement = () => {
    movementMutation.mutate();
  };

  const handleClose = () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    closeMutation.mutate(amount);
  };

  const handlePrintReport = () => {
    if (!summary || !session) return;
    const summaryParam = encodeURIComponent(JSON.stringify(summary));
    const sessionParam = encodeURIComponent(JSON.stringify(session));
    const reportUrl = `/dashboard/cash-register/report?summary=${summaryParam}&session=${sessionParam}`;
    window.open(reportUrl, '_blank');
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
        <Header title="Caja" />

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
                  <Label htmlFor="openingAmount">Monto Inicial</Label>
                  <Input
                    id="openingAmount"
                    type="number"
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Ingrese el monto con el que inicia la caja
                  </p>
                </div>

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
                    <p className="text-sm text-muted-foreground">Monto Inicial</p>
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
                        )
                      )}
                    </div>

                    {summary.movements && summary.movements.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="font-semibold mb-2">Movimientos Manuales:</p>
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
                                {movement.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
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
                          onValueChange={(value: any) =>
                            setMovementType(value)
                          }
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
                          placeholder="0.00"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Monto Esperado</p>
                          <p className="text-lg font-bold">
                            ${summary.expectedAmount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Diferencia</p>
                          <p
                            className={`text-lg font-bold ${
                              closingAmount &&
                              parseFloat(closingAmount) - summary.expectedAmount ===
                                0
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}
                          >
                            {closingAmount
                              ? `$${(
                                  parseFloat(closingAmount) -
                                  summary.expectedAmount
                                ).toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="closingAmount">Monto Final (Arqueo)</Label>
                    <Input
                      id="closingAmount"
                      type="number"
                      step="0.01"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-lg"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Ingrese el monto total contado en caja
                    </p>
                  </div>

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
      </div>
    </div>
  );
}
