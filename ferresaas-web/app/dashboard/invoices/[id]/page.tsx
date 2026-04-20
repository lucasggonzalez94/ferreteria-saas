"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface InvoiceDetail {
  id: string;
  saleId: string;
  voucherType: string;
  status: string;
  pointOfSale: number | null;
  number: number | null;
  cae: string | null;
  caeExpiry: string | null;
  pdfUrl: string | null;
  adjustmentKind: string | null;
  adjustmentReason: string | null;
  relatedInvoice: {
    id: string;
    voucherType: string;
    pointOfSale: number | null;
    number: number | null;
    cae: string | null;
  } | null;
  sale: {
    id: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    customer: {
      type: "PERSON" | "COMPANY";
      firstName?: string | null;
      lastName?: string | null;
      companyName?: string | null;
      cuit?: string | null;
      address?: string | null;
    } | null;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      taxRate: number;
      product: {
        name: string;
        internalSku: string;
      };
    }>;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value);
}

export default function InvoiceDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();

  const canReadSales = user?.permissions?.includes("sales:read");

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-detail", params.id],
    queryFn: async () => {
      const response = await api.get<InvoiceDetail>(`/sales/invoices/${params.id}`);
      return response.data!;
    },
    enabled: Boolean(canReadSales && params.id),
  });

  const handleDownloadPdf = async () => {
    if (!data) return;

    try {
      const blob = await api.getBlob(`/sales/${data.saleId}/invoices/${data.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank");
      if (!newWindow) {
        toast.error("No se pudo abrir el PDF. Revisá bloqueador de popups.");
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el PDF");
    }
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

  if (isLoading || !data) {
    return <div className="p-8">Cargando detalle del comprobante...</div>;
  }

  const customerLabel = data.sale.customer
    ? data.sale.customer.type === "COMPANY"
      ? data.sale.customer.companyName || "Empresa"
      : `${data.sale.customer.firstName || ""} ${data.sale.customer.lastName || ""}`.trim() || "Cliente"
    : "Consumidor Final";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Header
          title={`Comprobante ${data.voucherType}`}
          description={`Detalle del comprobante ${data.pointOfSale || 0}-${data.number || 0}`}
          link="/dashboard/invoices"
          linkLabel="Volver a comprobantes"
        />

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
            <p><strong>Estado:</strong> {data.status}</p>
            <p><strong>CAE:</strong> {data.cae || "-"}</p>
            <p><strong>Vto CAE:</strong> {data.caeExpiry ? new Date(data.caeExpiry).toLocaleDateString("es-AR") : "-"}</p>
            <p><strong>Venta:</strong> {data.saleId}</p>
            <p><strong>Cliente:</strong> {customerLabel}</p>
            <p><strong>Total:</strong> {formatCurrency(data.sale.total)}</p>
            {data.relatedInvoice ? (
              <p className="md:col-span-3">
                <strong>Comprobante asociado:</strong> {data.relatedInvoice.voucherType} {data.relatedInvoice.pointOfSale || 0}-{data.relatedInvoice.number || 0}
              </p>
            ) : null}
            {data.adjustmentReason ? (
              <p className="md:col-span-3"><strong>Motivo:</strong> {data.adjustmentReason}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sale.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.product.internalSku}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleDownloadPdf} disabled={data.status !== "ISSUED"}>
            Descargar PDF
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/invoices">Volver al listado</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
