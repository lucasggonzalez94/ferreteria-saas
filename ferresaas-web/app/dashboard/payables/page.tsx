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
import {
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
} from "lucide-react";
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

interface Payable {
  id: string;
  amount: number;
  paidAmount: number;
  currency?: string;
  status: string;
  dueDate?: string;
  supplier: {
    id: string;
    name: string;
  };
  purchase?: {
    id: string;
    invoiceNumber?: string;
    currency?: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    currency?: string;
    amountUSD?: number;
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

interface Supplier {
  id: string;
  name: string;
}

export default function PayablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canViewPayables = user?.permissions?.includes("purchases:read");
  const canUpdatePayables = user?.permissions?.includes("purchases:update");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const urlSupplierId = searchParams.get("supplierId");

  useEffect(() => {
    if (!canViewPayables) {
      router.push("/dashboard");
      return;
    }
    if (urlSupplierId) {
      setSupplierId(urlSupplierId);
    }
  }, [canViewPayables, router, urlSupplierId]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await api.get<any>("/suppliers", {
          params: { limit: 1000 },
        });
        setSuppliers(response.data?.data || []);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };
    if (canViewPayables) {
      fetchSuppliers();
    }
  }, [canViewPayables]);

  const {
    data: payablesData,
    isLoading,
    refetch: refetchPayables,
    isFetching: isFetchingPayables,
  } = useQuery<PayablesResponse>({
    queryKey: [
      "payables",
      page,
      status,
      supplierId,
      search,
      dueDateFrom,
      dueDateTo,
      minAmount,
      maxAmount,
    ],
    queryFn: async () => {
      const response = await api.get<any>("/payables", {
        params: {
          page,
          limit: 10,
          ...(status && { status }),
          ...(supplierId && { supplierId }),
          ...(search && { search }),
          ...(dueDateFrom && { dueDateFrom }),
          ...(dueDateTo && { dueDateTo }),
          ...(minAmount && { minAmount: parseNumericInput(minAmount) }),
          ...(maxAmount && { maxAmount: parseNumericInput(maxAmount) }),
        },
      });
      
      // La respuesta del API wrapper tiene estructura: { success: true, data: [...], meta: {...} }
      // Pero response.data ya contiene { data: [...], meta: {...} }
      const apiData = Array.isArray(response.data) ? response.data : (response.data.data || response.data);
      const apiMeta = !Array.isArray(response.data) ? response.data.meta : undefined;
      
      // Convertir strings numéricos a números
      const payables = apiData.map((payable: any) => ({
        ...payable,
        amount: Number(payable.amount),
        paidAmount: Number(payable.paidAmount),
        payments: payable.payments.map((payment: any) => ({
          ...payment,
          amount: Number(payment.amount),
          amountUSD: payment.amountUSD ? Number(payment.amountUSD) : null,
        })),
      }));
      
      return {
        data: payables,
        meta: apiMeta,
      } as PayablesResponse;
    },
    enabled: canViewPayables,
  });

  const {
    data: summaryData,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useQuery({
    queryKey: ["payables-summary"],
    queryFn: async () => {
      const response = await api.get<any>("/payables/summary");
      return response.data.data || {};
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
    totalPages: 1,
    hasMore: false,
  };
  const summary = summaryData || {};

  // Obtener nombre del proveedor filtrado
  const supplierName = supplierId
    ? suppliers.find((s) => s.id === supplierId)?.name
    : null;

  const handleClearFilters = () => {
    setStatus("");
    setSupplierId("");
    setSearch("");
    setDueDateFrom("");
    setDueDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setPage(1);
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
        <Header
          title="Cuentas por Pagar"
          link={
            supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard"
          }
          linkLabel={supplierId ? "Volver al Proveedor" : "Volver al Dashboard"}
          actions={
            <div className="flex items-center gap-2">
              <Tooltip content="Refrescar datos">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["payables"] });
                    queryClient.invalidateQueries({
                      queryKey: ["payables-summary"],
                    });
                    refetchPayables();
                    refetchSummary();
                  }}
                  disabled={isFetchingPayables || isFetchingSummary}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isFetchingPayables || isFetchingSummary ? "animate-spin" : ""}`}
                  />
                </Button>
              </Tooltip>
            </div>
          }
        />

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
                ${!summaryData ? "0,00" : (summary.totalPayable || 0).toFixed(2)}
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
                ${!summaryData ? "0,00" : (summary.totalPending || 0).toFixed(2)}
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
                ${!summaryData ? "0,00" : (summary.totalPaid || 0).toFixed(2)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos los estados</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="PAID">Pagado</option>
                  <option value="OVERDUE">Vencido</option>
                </select>
              </div>

              <div>
                <Label htmlFor="supplier">Proveedor</Label>
                <select
                  id="supplier"
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setPage(1);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos los proveedores</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="search">Buscar Proveedor</Label>
                <Input
                  id="search"
                  placeholder="Nombre del proveedor..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="dueDateFrom">Vencimiento Desde</Label>
                <Input
                  id="dueDateFrom"
                  type="date"
                  value={dueDateFrom}
                  onChange={(e) => {
                    setDueDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="dueDateTo">Vencimiento Hasta</Label>
                <Input
                  id="dueDateTo"
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => {
                    setDueDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="minAmount">Monto Mínimo</Label>
                <Input
                  id="minAmount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={minAmount}
                  onChange={(e) => {
                    setMinAmount(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="maxAmount">Monto Máximo</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={maxAmount}
                  onChange={(e) => {
                    setMaxAmount(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="w-full"
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
                                    <select
                                      id="method"
                                      value={paymentMethod}
                                      onChange={(e) =>
                                        setPaymentMethod(e.target.value)
                                      }
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                      <option value="CASH">Efectivo</option>
                                      <option value="TRANSFER">
                                        Transferencia
                                      </option>
                                      <option value="CHECK">Cheque</option>
                                      <option value="CARD">Tarjeta</option>
                                    </select>
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
