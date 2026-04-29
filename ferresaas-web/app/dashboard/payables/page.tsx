"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import { parseNumericInput } from "@/lib/numeric-input";
import {
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { ActionsMenu } from "@/components/ui/actions-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/pagination";

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

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
}

interface SuppliersListResponse {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface PayablesSummary {
  totalPayable: number;
  totalPending: number;
  totalPaid: number;
  overdue: number;
}

export default function PayablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  usePermissionGuard("purchases:read");
  const {
    canRead: canViewPayables,
    canUpdate: canUpdatePayables,
  } = usePermissions({
    canRead: "purchases:read",
    canUpdate: "purchases:update",
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
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
  const [checkNumber, setCheckNumber] = useState("");
  const [checkAccountId, setCheckAccountId] = useState("");

  const urlSupplierId = searchParams.get("supplierId");

  useEffect(() => {
    if (urlSupplierId) {
      setSupplierId(urlSupplierId);
    }
  }, [urlSupplierId]);

  const { data: suppliersData } = useQuery<SuppliersListResponse>({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const response = await api.get<SuppliersListResponse>("/suppliers", {
        params: { limit: 1000 },
      });
      return response.data as SuppliersListResponse;
    },
    enabled: canViewPayables,
  });

  const suppliers: Supplier[] = suppliersData?.data || [];

  const { data: financialAccounts } = useQuery<FinancialAccount[]>({
    queryKey: ["financial-accounts"],
    queryFn: async () => {
      const response = await api.get<FinancialAccount[]>("/financial-accounts");
      return response.data || [];
    },
    enabled: canUpdatePayables,
  });

  const bankAccounts = (financialAccounts || []).filter(
    (account) => account.type === "BANK" && account.isActive,
  );

  const {
    data: payablesData,
    isLoading,
    refetch: refetchPayables,
    isFetching: isFetchingPayables,
  } = useQuery<PayablesResponse>({
    queryKey: [
      "payables",
      page,
      limit,
      status,
      supplierId,
      search,
      dueDateFrom,
      dueDateTo,
      minAmount,
      maxAmount,
    ],
    queryFn: async () => {
      const response = await api.get<PayablesResponse>("/payables", {
        params: {
          page,
          limit,
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
      const responseData = response.data as PayablesResponse | Payable[];
      const apiData = Array.isArray(responseData) ? responseData : ((responseData as PayablesResponse).data || responseData);
      const apiMeta = !Array.isArray(responseData) ? (responseData as PayablesResponse).meta : undefined;
      
      // Convertir strings numéricos a números
      const payables = (apiData as Payable[]).map((payable) => ({
        ...payable,
        amount: Number(payable.amount),
        paidAmount: Number(payable.paidAmount),
        payments: payable.payments.map((payment) => ({
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
      const response = await api.get<PayablesSummary>("/payables/summary");
      return response.data || {} as PayablesSummary;
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
        checkNumber:
          paymentMethod === "CHECK" && checkNumber.trim()
            ? checkNumber.trim()
            : undefined,
        checkAccountId:
          paymentMethod === "CHECK" && checkAccountId ? checkAccountId : undefined,
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
      setCheckNumber("");
      setCheckAccountId("");
    },
  });

  const payables = payablesData?.data || [];
  const meta = payablesData?.meta || {
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 1,
    hasMore: false,
  };

  const startIndex = payables.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);
  const summary = summaryData || {} as PayablesSummary;

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
                  aria-label="Refrescar cuentas por pagar"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatCard
            title="Total Adeudado"
            value={!summaryData ? "0,00" : `$${(summary.totalPayable || 0).toFixed(2)}`}
            icon={DollarSign}
            valueClassName={(summary.totalPayable || 0) > 0 ? "text-red-600" : ""}
          />
          <StatCard
            title="Vencidas"
            value={isLoading ? "..." : summary.overdue || 0}
            icon={AlertCircle}
            valueClassName={(summary.overdue || 0) > 0 ? "text-red-600" : ""}
          />
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
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="status" className="mt-1">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="PARTIAL">Parcial</SelectItem>
                    <SelectItem value="PAID">Pagado</SelectItem>
                    <SelectItem value="OVERDUE">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="supplier">Proveedor</Label>
                <Select
                  value={supplierId}
                  onValueChange={(value) => {
                    setSupplierId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="supplier" className="mt-1">
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <DatePicker
                  value={dueDateFrom}
                  onChange={(value) => {
                    setDueDateFrom(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha inicio"
                />
              </div>

              <div>
                <Label htmlFor="dueDateTo">Vencimiento Hasta</Label>
                <DatePicker
                  value={dueDateTo}
                  onChange={(value) => {
                    setDueDateTo(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha fin"
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
            <Card>
              <CardHeader>
                <CardTitle>Listado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payables.map((payable: Payable) => {
                    const pendingAmount = payable.amount - payable.paidAmount;
                    const progressPercent =
                      (payable.paidAmount / payable.amount) * 100;
                    const purchaseNumber = payable.purchase?.invoiceNumber || payable.purchase?.id?.slice(0, 8) || '-';

                    return (
                      <div
                        key={payable.id}
                        className="rounded-lg border p-3 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer"
                      >
                        <div className="app-icon-badge h-12 w-12 rounded-full border-2 border-[hsl(var(--brand-accent-border)/0.5)] bg-gradient-to-br from-[hsl(var(--brand-accent-soft))] to-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow flex items-center justify-center">
                          {getStatusIcon(payable.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground truncate text-[15px]">
                              {payable.supplier.name}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 border ${
                                payable.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : payable.status === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : payable.status === 'OVERDUE'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  payable.status === 'PAID'
                                    ? 'bg-emerald-500'
                                    : payable.status === 'PARTIAL'
                                    ? 'bg-amber-500'
                                    : payable.status === 'OVERDUE'
                                    ? 'bg-red-500'
                                    : 'bg-gray-500'
                                }`}
                              />
                              {payable.status === 'PAID' ? 'Pagado' : payable.status === 'PARTIAL' ? 'Parcial' : payable.status === 'OVERDUE' ? 'Vencido' : 'Pendiente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">Compra:</span>
                              <span className="text-xs text-foreground/80">
                                #{purchaseNumber}
                              </span>
                            </span>
                            {payable.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-xs text-foreground/80">
                                  Vence: {new Date(payable.dueDate).toLocaleDateString('es-AR')}
                                </span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">Pagado:</span>
                              <span className="text-xs text-foreground/80">
                                ${payable.paidAmount.toFixed(2)} / ${payable.amount.toFixed(2)}
                              </span>
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-green-600 h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(progressPercent, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 flex-shrink-0">
                          <div className="text-right min-w-[100px]">
                            <p className="text-xs text-muted-foreground/70 uppercase tracking-wide font-medium">
                              Pendiente
                            </p>
                            <p className="text-base font-bold tabular-nums text-amber-600">
                              ${pendingAmount.toFixed(2)}
                            </p>
                          </div>
                          <ActionsMenu
                            actions={[
                              {
                                label: 'Ver proveedor',
                                onClick: () => router.push(`/dashboard/suppliers/${payable.supplier.id}`),
                              },
                              ...(canUpdatePayables && payable.status !== 'PAID' ? [
                                {
                                  label: 'Registrar pago',
                                  onClick: () => {
                                    setSelectedPayableId(payable.id);
                                    setPaymentAmount(pendingAmount.toFixed(2));
                                    setPaymentDialogOpen(true);
                                  },
                                }
                              ] : [])
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Payment Dialog - Global */}
            <Dialog
              open={paymentDialogOpen && !!selectedPayableId}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedPayableId(null);
                  setPaymentAmount("");
                  setPaymentMethod("TRANSFER");
                  setPaymentReference("");
                  setCheckNumber("");
                  setCheckAccountId("");
                }
                setPaymentDialogOpen(open);
              }}
            >
              <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-lg">
                <DialogHeader>
                  <DialogTitle>Registrar Pago</DialogTitle>
                  <DialogDescription>
                    {selectedPayableId && payables.find(p => p.id === selectedPayableId)?.supplier.name}
                    {' - Pendiente: $'}
                    {selectedPayableId && (() => {
                      const p = payables.find(p => p.id === selectedPayableId);
                      return p ? (p.amount - p.paidAmount).toFixed(2) : '0.00';
                    })()}
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
                      max={
                        selectedPayableId
                          ? (payables.find(p => p.id === selectedPayableId)?.amount || 0) - (payables.find(p => p.id === selectedPayableId)?.paidAmount || 0)
                          : undefined
                      }
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
                      <SelectTrigger id="method" className="mt-1">
                        <SelectValue placeholder="Selecciona método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Efectivo</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="CHECK">Cheque</SelectItem>
                        <SelectItem value="CARD">Tarjeta</SelectItem>
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
                  {paymentMethod === "CHECK" && (
                    <>
                      <div>
                        <Label htmlFor="checkAccountId">
                          Cuenta bancaria *
                        </Label>
                        <Select
                          value={checkAccountId}
                          onValueChange={setCheckAccountId}
                        >
                          <SelectTrigger id="checkAccountId" className="mt-1">
                            <SelectValue placeholder="Selecciona cuenta bancaria" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                                {account.bankName ? ` - ${account.bankName}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="checkNumber">
                          Numero de cheque *
                        </Label>
                        <Input
                          id="checkNumber"
                          value={checkNumber}
                          onChange={(e) => setCheckNumber(e.target.value)}
                          placeholder="Ej: 00012345"
                          maxLength={100}
                        />
                      </div>
                    </>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      recordPaymentMutation.isPending ||
                      (paymentMethod === "CHECK" &&
                        (!checkNumber.trim() || !checkAccountId))
                    }
                    className="w-full"
                  >
                    {recordPaymentMutation.isPending
                      ? "Registrando..."
                      : "Registrar Pago"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Pagination */}
            <div className="mt-4">
              <Pagination
                setPage={setPage}
                currentPage={page}
                totalPages={meta.totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                total={meta.total}
                limit={limit}
                onLimitChange={setLimit}
                hasMore={meta.hasMore}
                onPageChange={setPage}
              />
            </div>
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
