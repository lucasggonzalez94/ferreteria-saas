"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import { parseNumericInput } from "@/lib/numeric-input";
import { DollarSign, AlertCircle, CheckCircle, Clock, Eye, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Payable {
  id: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate?: string;
  supplier: {
    id: string;
    name: string;
  };
  purchase?: {
    id: string;
    invoiceNumber?: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    paidAt: string;
  }>;
}

interface PayablesResponse {
  data: Payable[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function PayablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canViewPayables = user?.permissions?.includes("purchases:read");
  const canUpdatePayables = user?.permissions?.includes("purchases:update");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");

  const supplierId = searchParams.get("supplierId");

  useEffect(() => {
    if (!canViewPayables) {
      router.push("/dashboard");
      return;
    }
  }, [canViewPayables, router]);

  const { data: payablesData, isLoading, refetch: refetchPayables, isFetching: isFetchingPayables } = useQuery<
    PayablesResponse | undefined
  >({
    queryKey: ["payables", page, status, supplierId],
    queryFn: async () => {
      const response = await api.get<any>("/payables", {
        params: {
          page,
          limit: 10,
          ...(status && { status }),
          ...(supplierId && { supplierId }),
        },
      });
      return response.data as PayablesResponse;
    },
    enabled: canViewPayables,
  });

  const { data: summaryData, refetch: refetchSummary, isFetching: isFetchingSummary } = useQuery({
    queryKey: ["payables-summary"],
    queryFn: async () => {
      const response = await api.get<any>("/payables/summary");
      return response.data;
    },
    enabled: canViewPayables,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPayableId) throw new Error("No payable selected");
      await api.post(`/payables/${selectedPayableId}/payments`, {
        amount: parseNumericInput(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payables"] });
      queryClient.invalidateQueries({ queryKey: ["payables-summary"] });
      setPaymentDialogOpen(false);
      setSelectedPayableId(null);
      setPaymentAmount("");
      setPaymentMethod("TRANSFER");
      setPaymentReference("");
    },
  });

  const payables = payablesData?.data || [];
  const meta = payablesData?.meta || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  const summary = summaryData || {};

  // Obtener nombre del proveedor filtrado
  const supplierName =
    supplierId && payables.length > 0 ? payables[0].supplier.name : null;

  const handleClearFilter = () => {
    router.push("/dashboard/payables");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800";
      case "OVERDUE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
        return <CheckCircle className="h-4 w-4" />;
      case "OVERDUE":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <Header
            title="Cuentas por Pagar"
            link={
              supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard"
            }
            linkLabel={
              supplierId ? "Volver al Proveedor" : "Volver al Dashboard"
            }
            actions={
              supplierId && supplierName ? (
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                  <span className="text-sm text-blue-700">
                    Filtrado por: <strong>{supplierName}</strong>
                  </span>
                  <button
                    onClick={handleClearFilter}
                    className="text-blue-600 hover:text-blue-800 font-semibold ml-2"
                  >
                    ✕
                  </button>
                </div>
              ) : null
            }
          />

          <Tooltip content="Refrescar datos">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["payables"] });
                queryClient.invalidateQueries({ queryKey: ["payables-summary"] });
                refetchPayables();
                refetchSummary();
              }}
              disabled={isFetchingPayables || isFetchingSummary}
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingPayables || isFetchingSummary ? "animate-spin" : ""}`} />
            </Button>
          </Tooltip>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Adeudado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${isLoading ? "0,00" : (summary.totalPayable || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendiente Pagar
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ${isLoading ? "0,00" : (summary.totalPending || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pagado
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${isLoading ? "0,00" : (summary.totalPaid || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {isLoading ? "0" : summary.overdue || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={status || "PENDING"}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="PARTIAL">Parcial</SelectItem>
                    <SelectItem value="PAID">Pagado</SelectItem>
                    <SelectItem value="OVERDUE">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("PENDING");
                    setPage(1);
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payables List */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LoadingSpinner text="Cargando cuentas por pagar..." />
            </CardContent>
          </Card>
        ) : payables.length > 0 ? (
          <>
            <div className="space-y-4">
              {payables.map((payable: Payable) => {
                const pendingAmount = payable.amount - payable.paidAmount;
                const progressPercent =
                  (payable.paidAmount / payable.amount) * 100;

                return (
                  <Card key={payable.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {payable.supplier.name}
                          </CardTitle>
                          {payable.purchase && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Compra #
                              {payable.purchase.invoiceNumber ||
                                payable.purchase.id.slice(0, 8)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${payable.amount.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {getStatusIcon(payable.status)}
                            <span
                              className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusColor(payable.status)}`}
                            >
                              {payable.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">
                              Pagado: ${payable.paidAmount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              Pendiente: ${pendingAmount.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(progressPercent, 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Due Date */}
                        {payable.dueDate && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Vencimiento:{" "}
                              {new Date(payable.dueDate).toLocaleDateString(
                                "es-AR",
                              )}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/suppliers/${payable.supplier.id}`}
                          >
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Proveedor
                            </Button>
                          </Link>
                          {canUpdatePayables && payable.status !== "PAID" && (
                            <Dialog
                              open={
                                paymentDialogOpen &&
                                selectedPayableId === payable.id
                              }
                              onOpenChange={(open) => {
                                if (open) {
                                  setSelectedPayableId(payable.id);
                                  setPaymentAmount(pendingAmount.toFixed(2));
                                }
                                setPaymentDialogOpen(open);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button size="sm">
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Registrar Pago
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Registrar Pago</DialogTitle>
                                  <DialogDescription>
                                    {payable.supplier.name} - Pendiente: $
                                    {pendingAmount.toFixed(2)}
                                  </DialogDescription>
                                </DialogHeader>
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    recordPaymentMutation.mutate();
                                  }}
                                  className="space-y-4"
                                >
                                  <div>
                                    <Label htmlFor="amount">
                                      Monto a Pagar *
                                    </Label>
                                    <Input
                                      id="amount"
                                      type="number"
                                      step="0.01"
                                      value={paymentAmount}
                                      onChange={(e) =>
                                        setPaymentAmount(e.target.value)
                                      }
                                      max={pendingAmount}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="method">
                                      Método de Pago *
                                    </Label>
                                    <Select
                                      value={paymentMethod}
                                      onValueChange={setPaymentMethod}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="CASH">
                                          Efectivo
                                        </SelectItem>
                                        <SelectItem value="TRANSFER">
                                          Transferencia
                                        </SelectItem>
                                        <SelectItem value="CHECK">
                                          Cheque
                                        </SelectItem>
                                        <SelectItem value="CARD">
                                          Tarjeta
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="reference">
                                      Referencia
                                    </Label>
                                    <Input
                                      id="reference"
                                      placeholder="Ej: Número de cheque, referencia de transferencia"
                                      value={paymentReference}
                                      onChange={(e) =>
                                        setPaymentReference(e.target.value)
                                      }
                                    />
                                  </div>
                                  <Button
                                    type="submit"
                                    disabled={recordPaymentMutation.isPending}
                                    className="w-full"
                                  >
                                    {recordPaymentMutation.isPending
                                      ? "Registrando..."
                                      : "Registrar Pago"}
                                  </Button>
                                </form>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span className="flex items-center px-4">
                  Página {page} de {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={!meta.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay cuentas por pagar</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
