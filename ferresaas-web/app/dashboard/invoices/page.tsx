"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionsMenu } from "@/components/ui/actions-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  InvoiceStatus,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
} from "@/lib/invoice-status";
type VoucherType = "A" | "B" | "C" | "NC_A" | "NC_B" | "NC_C" | "ND_A" | "ND_B" | "ND_C";
type DatePreset = "all" | "today" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "custom";

interface InvoiceListItem {
  id: string;
  saleId: string;
  provider: string;
  voucherType: VoucherType;
  status: InvoiceStatus;
  pointOfSale: number | null;
  number: number | null;
  cae: string | null;
  caeExpiry: string | null;
  createdAt: string;
  issuedAt: string | null;
  pdfUrl: string | null;
  sale: {
    id: string;
    total: number;
    customer: {
      type: "PERSON" | "COMPANY";
      firstName?: string | null;
      lastName?: string | null;
      companyName?: string | null;
      cuit?: string | null;
    } | null;
  };
}

function customerName(invoice: InvoiceListItem): string {
  const customer = invoice.sale.customer;
  if (!customer) return "Consumidor Final";
  if (customer.type === "COMPANY") return customer.companyName || "Empresa";
  const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  return fullName || "Cliente";
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") {
    return {
      startDate: formatDateInput(today),
      endDate: formatDateInput(today),
    };
  }

  if (preset === "last_7_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
    };
  }

  if (preset === "last_30_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
    };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
    };
  }

  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(end),
    };
  }

  return { startDate: "", endDate: "" };
}

function toStartDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T00:00:00.000`).toISOString();
}

function toEndDateIso(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
}

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [voucherType, setVoucherType] = useState<VoucherType | "all">("all");
  const [saleId, setSaleId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canReadSales = user?.permissions?.includes("sales:read");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["invoices", status, voucherType, saleId, startDate, endDate],
    queryFn: async () => {
      const response = await api.get<InvoiceListItem[]>("/sales/invoices", {
        params: {
          status: status === "all" ? undefined : status,
          voucherType: voucherType === "all" ? undefined : voucherType,
          saleId: saleId.trim() || undefined,
          startDate: toStartDateIso(startDate),
          endDate: toEndDateIso(endDate),
          page: 1,
          limit: 100,
        },
      });

      return response.data || [];
    },
    enabled: Boolean(canReadSales),
  });

  const totals = useMemo(() => {
    const invoices = data || [];
    return {
      total: invoices.length,
      issued: invoices.filter((invoice) => invoice.status === "ISSUED").length,
      failed: invoices.filter((invoice) => invoice.status === "FAILED").length,
      pending: invoices.filter((invoice) => invoice.status === "PENDING").length,
    };
  }, [data]);

  const handleDownloadPdf = async (invoice: InvoiceListItem) => {
    try {
      const blob = await api.getBlob(`/sales/${invoice.saleId}/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank");
      if (!newWindow) {
        toast.error("No se pudo abrir el PDF. Revisá bloqueador de popups.");
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el PDF");
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);

    if (preset === "custom") {
      return;
    }

    const range = getDatePresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  if (!canReadSales) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Tu usuario no tiene permiso `sales:read` para ver comprobantes.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Header
          title="Comprobantes"
          description="Consulta, seguimiento y descarga de invoices"
          link="/dashboard"
          linkLabel="Volver al inicio"
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle>{totals.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Emitidos</CardDescription>
              <CardTitle>{totals.issued}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendientes</CardDescription>
              <CardTitle>{totals.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fallidos</CardDescription>
              <CardTitle>{totals.failed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refina por estado, tipo, venta y período.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus | "all")}> 
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ISSUED">Emitido</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="FAILED">Fallido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={voucherType} onValueChange={(value) => setVoucherType(value as VoucherType | "all")}> 
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="NC_A">NC A</SelectItem>
                  <SelectItem value="NC_B">NC B</SelectItem>
                  <SelectItem value="NC_C">NC C</SelectItem>
                  <SelectItem value="ND_A">ND A</SelectItem>
                  <SelectItem value="ND_B">ND B</SelectItem>
                  <SelectItem value="ND_C">ND C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Venta (ID)</label>
              <Input
                placeholder="Cuid de venta"
                value={saleId}
                onChange={(event) => setSaleId(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={datePreset} onValueChange={(value) => handlePresetChange(value as DatePreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el historial</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="last_7_days">Últimos 7 días</SelectItem>
                  <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
                  <SelectItem value="this_month">Mes actual</SelectItem>
                  <SelectItem value="last_month">Mes anterior</SelectItem>
                  <SelectItem value="custom">Rango personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Desde</label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setDatePreset("custom");
                  setStartDate(event.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hasta</label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setDatePreset("custom");
                  setEndDate(event.target.value);
                }}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={() => refetch()}>
                Aplicar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado de comprobantes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando comprobantes...</p>
            ) : (data?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No hay comprobantes para los filtros seleccionados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>CAE</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="font-medium">{invoice.voucherType}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.pointOfSale || 0}-{invoice.number || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Venta {invoice.saleId}</div>
                      </TableCell>
                      <TableCell>{customerName(invoice)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${INVOICE_STATUS_STYLES[invoice.status]}`}
                        >
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={invoice.cae || "-"}>
                        {invoice.cae || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.issuedAt || invoice.createdAt).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionsMenu
                          actions={[
                            {
                              label: "Ver detalle",
                              onClick: () => router.push(`/dashboard/invoices/${invoice.id}`),
                            },
                            {
                              label: "Descargar PDF",
                              onClick: () => handleDownloadPdf(invoice),
                              disabled: invoice.status !== "ISSUED",
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
      </div>
    </div>
  );
}
