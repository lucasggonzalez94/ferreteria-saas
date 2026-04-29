"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { RefreshCw, FileText, Plus, CheckCircle, XCircle } from "lucide-react";
import { ActionsMenu } from "@/components/ui/actions-menu";

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface CheckItem {
  id: string;
  checkNumber: string;
  amount: number | string;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string;
  recipientName?: string;
  account: {
    id: string;
    name: string;
  };
}

interface CheckSummaryItem {
  accountId: string;
  accountName: string;
  totalPending: number | string;
  count: number;
  currency: string;
}

interface ChecksResponse {
  data: CheckItem[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const STATUS_OPTIONS = ["ISSUED", "CLEARED", "BOUNCED", "CANCELLED"];

function getStatusLabel(status: string): string {
  if (status === "ISSUED") return "Emitido";
  if (status === "CLEARED") return "Cobrado";
  if (status === "BOUNCED") return "Rebotado";
  if (status === "CANCELLED") return "Cancelado";
  return status;
}

function getStatusClass(status: string): string {
  if (status === "ISSUED") return "border border-slate-300 text-slate-700";
  if (status === "CLEARED") return "bg-emerald-100 text-emerald-800";
  if (status === "BOUNCED") return "bg-red-100 text-red-800";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "border border-slate-300 text-slate-700";
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ChecksPage() {
  usePermissionGuard("checks:read");

  const { canRead, canManage } = usePermissions({
    canRead: "checks:read",
    canManage: "checks:manage",
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<string>("all");
  const [accountId, setAccountId] = useState<string>("all");

  const {
    data: checksData,
    isLoading,
    refetch: refetchChecks,
    isFetching,
  } = useQuery<ChecksResponse>({
    queryKey: ["checks", page, limit, status, accountId],
    queryFn: async () => {
      const response = await api.get<ChecksResponse>("/checks", {
        params: {
          page,
          limit,
          ...(status !== "all" && { status }),
          ...(accountId !== "all" && { accountId }),
        },
      });

      const items = (response.data || []) as CheckItem[];
      const rows = items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      }));

      return {
        data: rows,
        meta: (response as any).meta,
      };
    },
    enabled: canRead,
  });

  const { data: summary = [] } = useQuery<CheckSummaryItem[]>({
    queryKey: ["checks-summary", accountId],
    queryFn: async () => {
      const response = await api.get<CheckSummaryItem[]>("/checks/summary", {
        params: accountId !== "all" ? { accountId } : undefined,
      });
      return (response.data || []).map((item) => ({
        ...item,
        totalPending: Number(item.totalPending),
      }));
    },
    enabled: canRead,
  });

  const { data: financialAccounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financial-accounts", "checks-filter"],
    queryFn: async () => {
      const response = await api.get<FinancialAccount[]>("/financial-accounts");
      return response.data || [];
    },
    enabled: canRead,
  });

  const bankAccounts = useMemo(
    () => financialAccounts.filter((account) => account.type === "BANK" && account.isActive),
    [financialAccounts],
  );

  const checks = checksData?.data || [];
  const meta = checksData?.meta || {
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 1,
    hasMore: false,
  };

  const startIndex = checks.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);

  const totalPendingAmount = summary.reduce(
    (acc, item) => acc + Number(item.totalPending || 0),
    0,
  );
  const totalPendingCount = summary.reduce((acc, item) => acc + item.count, 0);
  const summaryCurrency = summary[0]?.currency || "ARS";

  if (!canRead) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
      <Header
        title="Cheques"
        description="Gestiona la cartera de cheques emitidos, su estado y su seguimiento operativo."
        link="/dashboard"
        linkLabel="Volver al inicio"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchChecks();
              }}
              disabled={isFetching}
              aria-label="Refrescar cheques"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            {canManage && (
              <Link href="/dashboard/checks/new">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo cheque
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendiente total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(totalPendingAmount, summaryCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cheques pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalPendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cuentas con cartera</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm mb-1">Estado</p>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm mb-1">Cuenta bancaria</p>
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-16">
            <LoadingSpinner text="Cargando cheques..." />
          </CardContent>
        </Card>
      ) : checks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay cheques para los filtros seleccionados.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className="group relative rounded-lg border border-transparent p-3 flex items-center gap-4 hover:bg-accent/5 hover:border-[hsl(var(--border)/0.5)] hover:rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <div className="app-icon-badge h-12 w-12 rounded-full border-2 border-[hsl(var(--brand-accent-border)/0.5)] bg-gradient-to-br from-[hsl(var(--brand-accent-soft))] to-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate text-[15px]">
                          Cheque #{check.checkNumber}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 border ${
                            check.status === 'ISSUED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : check.status === 'CLEARED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : check.status === 'BOUNCED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : check.status === 'CANCELLED'
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              check.status === 'ISSUED'
                                ? 'bg-blue-500'
                                : check.status === 'CLEARED'
                                ? 'bg-emerald-500'
                                : check.status === 'BOUNCED'
                                ? 'bg-red-500'
                                : check.status === 'CANCELLED'
                                ? 'bg-orange-500'
                                : 'bg-slate-500'
                            }`}
                          />
                          {getStatusLabel(check.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="text-foreground/60">Tercero:</span>
                          <span className="text-xs text-foreground/80">
                            {check.recipientName || '-'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-foreground/60">Cuenta:</span>
                          <span className="text-xs text-foreground/80">
                            {check.account?.name || '-'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-foreground/60">Emision:</span>
                          <span className="text-xs text-foreground/80">
                            {new Date(check.issuedAt).toLocaleDateString('es-AR')}
                          </span>
                        </span>
                        {check.dueDate && (
                          <span className="flex items-center gap-1">
                            <span className="text-foreground/60">Vencimiento:</span>
                            <span className="text-xs text-foreground/80">
                              {new Date(check.dueDate).toLocaleDateString('es-AR')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-muted-foreground/70 uppercase tracking-wide font-medium">
                          Importe
                        </p>
                        <p className="text-base font-bold tabular-nums">
                          {formatMoney(Number(check.amount), check.currency)}
                        </p>
                      </div>
                      <ActionsMenu
                        actions={[
                          {
                            label: 'Ver detalle',
                            onClick: () => window.location.href = `/dashboard/checks/${check.id}`,
                          },
                          ...(canManage && check.status === 'ISSUED' ? [
                            {
                              label: 'Marcar como cobrado',
                              onClick: () => console.log('Marcar como cobrado', check.id),
                            },
                            {
                              label: 'Marcar como rebotado',
                              onClick: () => console.log('Marcar como rebotado', check.id),
                            },
                            {
                              label: 'Anular cheque',
                              onClick: () => console.log('Anular cheque', check.id),
                            },
                          ] : []),
                          ...(canManage && check.status === 'CLEARED' ? [
                            {
                              label: 'Marcar como emitido',
                              onClick: () => console.log('Marcar como emitido', check.id),
                            },
                          ] : []),
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination
            setPage={setPage}
            currentPage={page}
            totalPages={meta.totalPages || 1}
            startIndex={startIndex}
            endIndex={endIndex}
            total={meta.total}
            limit={limit}
            onLimitChange={setLimit}
            hasMore={meta.hasMore || false}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
      )}
      </div>
    </div>
  );
}
