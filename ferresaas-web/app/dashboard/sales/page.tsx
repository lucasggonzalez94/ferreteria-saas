"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";
import { usePermissionGuard } from "@/lib/hooks/usePermissionGuard";
import {
  getDateRangePreset,
  localDateToUTC,
  localDateToUTCEndOfDay,
  todayLocal,
} from "@/lib/timezone";

interface SaleListItem {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  invoiceStatus: string;
  total: number;
  createdAt: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    type?: "PERSON" | "COMPANY";
  } | null;
  _count?: {
    items: number;
    payments: number;
    refunds: number;
  };
}

interface SalesResponse {
  data: SaleListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

type DatePreset = "all" | "today" | "last_7_days" | "this_month" | "custom";
type InvoiceStatusFilter = "ALL" | "PENDING_INVOICE" | "INVOICED" | "FAILED";

function getCustomerLabel(sale: SaleListItem): string {
  if (!sale.customer) return "Consumidor final";
  if (sale.customer.type === "COMPANY") return sale.customer.companyName || "Empresa";
  const fullName = `${sale.customer.firstName || ""} ${sale.customer.lastName || ""}`.trim();
  return fullName || "Cliente";
}

function getStatusLabel(status: SaleListItem["status"]): string {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Borrador";
}

function getInvoiceStatusLabel(status: string): string {
  if (status === "INVOICED") return "Facturada";
  if (status === "FAILED") return "Factura fallida";
  return "Pendiente de factura";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  if (preset === "today") {
    const today = todayLocal();
    return { startDate: today, endDate: today };
  }

  if (preset === "last_7_days") {
    const range = getDateRangePreset("7d");
    return { startDate: range.start, endDate: range.end };
  }

  if (preset === "this_month") {
    const range = getDateRangePreset("thisMonth");
    return { startDate: range.start, endDate: range.end };
  }

  return { startDate: "", endDate: "" };
}

function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "todo el historico";
  if (startDate && endDate) return `${startDate} al ${endDate}`;
  if (startDate) return `desde ${startDate}`;
  return `hasta ${endDate}`;
}

export default function SalesPage() {
  usePermissionGuard("sales:read");

  const [status, setStatus] = useState<string>("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<SalesResponse>({
    queryKey: ["sales", page, limit, status, invoiceStatus, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string | number | undefined> = {
        page,
        limit,
        status: status === "ALL" ? undefined : status,
        invoiceStatus: invoiceStatus === "ALL" ? undefined : invoiceStatus,
      };

      if (startDate) {
        params.startDate = localDateToUTC(startDate);
      }

      if (endDate) {
        params.endDate = localDateToUTCEndOfDay(endDate);
      }

      const response = await api.get<SaleListItem[]>("/sales", {
        params,
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    },
  });

  const sales = useMemo(() => data?.data || [], [data?.data]);
  const meta = data?.meta || { page: 1, limit, total: 0, totalPages: 1, hasMore: false };

  const totals = useMemo(() => {
    const confirmed = sales.filter((sale) => sale.status === "CONFIRMED");
    const startIndex = sales.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
    const endIndex = sales.length === 0 ? 0 : startIndex + sales.length - 1;

    return {
      totalFiltered: meta.total,
      pageCount: sales.length,
      startIndex,
      endIndex,
      confirmed: confirmed.length,
      amount: confirmed.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    };
  }, [sales, meta.page, meta.limit, meta.total]);

  const periodLabel = useMemo(() => formatDateRangeLabel(startDate, endDate), [startDate, endDate]);

  const handleDatePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value === "custom") {
      setPage(1);
      return;
    }

    const range = getDatePresetRange(value);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatus("ALL");
    setInvoiceStatus("ALL");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setLimit(20);
    setPage(1);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header
          title="Ventas"
          description="Consulta ventas confirmadas, revisa pagos y gestiona devoluciones monetarias desde el detalle."
          link="/dashboard"
          linkLabel="Volver al dashboard"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Resultados totales (filtro)</p>
              <p className="text-2xl font-semibold">{totals.totalFiltered}</p>
              <p className="text-xs text-muted-foreground mt-1">Periodo: {periodLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Confirmadas (pagina actual)</p>
              <p className="text-2xl font-semibold">{totals.confirmed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mostrando {totals.pageCount} registros
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Total confirmado (pagina actual)</p>
              <p className="text-2xl font-semibold">{formatCurrency(totals.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Solo estado CONFIRMED</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Estado de venta</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="DRAFT">Borrador</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado de factura</Label>
                <Select
                  value={invoiceStatus}
                  onValueChange={(value) => {
                    setInvoiceStatus(value as InvoiceStatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Factura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="PENDING_INVOICE">Pendiente</SelectItem>
                    <SelectItem value="INVOICED">Facturada</SelectItem>
                    <SelectItem value="FAILED">Fallida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Periodo</Label>
                <Select
                  value={datePreset}
                  onValueChange={(value) => handleDatePresetChange(value as DatePreset)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Historico completo</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="last_7_days">Ultimos 7 dias</SelectItem>
                    <SelectItem value="this_month">Este mes</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setDatePreset("custom");
                    setStartDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setDatePreset("custom");
                    setEndDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
              <p className="text-xs text-muted-foreground">
                Rango activo: {periodLabel}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando ventas...</p>
            ) : sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas para los filtros seleccionados.</p>
            ) : (
              <div className="space-y-3">
                {sales.map((sale) => (
                  <div key={sale.id} className="rounded-lg border p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium">Venta #{sale.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">{getCustomerLabel(sale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleString("es-AR")} - {getStatusLabel(sale.status)} - {getInvoiceStatusLabel(sale.invoiceStatus)}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="font-semibold">{formatCurrency(Number(sale.total))}</p>
                      <p className="text-xs text-muted-foreground">
                        Items: {sale._count?.items || 0} | Pagos: {sale._count?.payments || 0} | Devoluciones: {sale._count?.refunds || 0}
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/sales/${sale.id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Pagination
          setPage={setPage}
          currentPage={meta.page}
          totalPages={Math.max(meta.totalPages || 1, 1)}
          startIndex={totals.startIndex}
          endIndex={totals.endIndex}
          total={meta.total}
          limit={limit}
          onLimitChange={setLimit}
          hasMore={meta.hasMore}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
