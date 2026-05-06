"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionsMenu } from "@/components/ui/actions-menu";
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
import { formatCurrency } from "@/lib/formatters";
import { getDatePresetRange, formatDateRangeLabel } from "@/lib/date-filters";
import type { DatePreset } from "@/lib/date-filters";
import { localDateToUTC, localDateToUTCEndOfDay } from "@/lib/timezone";
import { usePermissionGuard } from "@/lib/hooks/usePermissionGuard";

interface SaleListItem {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "PENDING";
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
    confirmedCount: number;
    confirmedTotal: number;
  };
}

type InvoiceStatusFilter = "ALL" | "PENDING_INVOICE" | "INVOICED" | "FAILED";
const DEFAULT_DATE_PRESET: DatePreset = "last_30_days";

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

export default function SalesPage() {
  usePermissionGuard("sales:read");
  const router = useRouter();

  const [status, setStatus] = useState<string>("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>(DEFAULT_DATE_PRESET);
  const [startDate, setStartDate] = useState(() => getDatePresetRange(DEFAULT_DATE_PRESET).startDate);
  const [endDate, setEndDate] = useState(() => getDatePresetRange(DEFAULT_DATE_PRESET).endDate);
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
  const meta = data?.meta || { 
    page: 1, 
    limit, 
    total: 0, 
    totalPages: 1, 
    hasMore: false,
    confirmedCount: 0,
    confirmedTotal: 0 
  };

  const totals = useMemo(() => {
    const startIndex = sales.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
    const endIndex = sales.length === 0 ? 0 : startIndex + sales.length - 1;

    return {
      totalFiltered: meta.total,
      pageCount: sales.length,
      startIndex,
      endIndex,
      confirmed: meta.confirmedCount,
      amount: meta.confirmedTotal,
    };
  }, [sales, meta.page, meta.limit, meta.total, meta.confirmedCount, meta.confirmedTotal]);

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
    setDatePreset(DEFAULT_DATE_PRESET);
    const range = getDatePresetRange(DEFAULT_DATE_PRESET);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
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
              <p className="text-sm text-muted-foreground">Confirmadas (filtro)</p>
              <p className="text-2xl font-semibold">{totals.confirmed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.pageCount > 0 ? `Mostrando ${totals.pageCount} en esta pagina` : 'Sin resultados'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Total confirmado (filtro)</p>
              <p className="text-2xl font-semibold">{formatCurrency(totals.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Solo ventas CONFIRMED</p>
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
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger label="Estado de venta">
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
                <Select
                  value={invoiceStatus}
                  onValueChange={(value) => {
                    setInvoiceStatus(value as InvoiceStatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger label="Estado de factura">
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
                <Select
                  value={datePreset}
                  onValueChange={(value) => handleDatePresetChange(value as DatePreset)}
                >
                  <SelectTrigger label="Periodo">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="last_7_days">Ultimos 7 dias</SelectItem>
                    <SelectItem value="last_30_days">Ultimos 30 dias</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <DatePicker
                  label="Desde"
                  value={startDate}
                  onChange={(value) => {
                    setDatePreset("custom");
                    setStartDate(value);
                    setPage(1);
                  }}
                  placeholder="dd/mm/aaaa"
                />
              </div>

              <div className="space-y-2">
                <DatePicker
                  label="Hasta"
                  value={endDate}
                  onChange={(value) => {
                    setDatePreset("custom");
                    setEndDate(value);
                    setPage(1);
                  }}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <span className="font-medium">#{sale.id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell>{getCustomerLabel(sale)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          sale.status === "CONFIRMED" ? "bg-green-100 text-green-800" :
                          sale.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                          sale.status === "CANCELLED" || sale.status === "DRAFT" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {getStatusLabel(sale.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{getInvoiceStatusLabel(sale.invoiceStatus)}</span>
                      </TableCell>
                      <TableCell>
                          {new Date(sale.createdAt).toLocaleString("es-AR", { hour12: false })}
                        </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(sale.total))}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionsMenu
                          actions={[
                            {
                              label: "Ver detalle",
                              onClick: () => router.push(`/dashboard/sales/${sale.id}`),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
