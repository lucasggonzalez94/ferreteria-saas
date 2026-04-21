"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { RefundModal } from "@/components/sales/refund-modal";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

interface SaleDetail {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  confirmedAt?: string | null;
  customer?: {
    type: "PERSON" | "COMPANY";
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    currentBalance?: number;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: {
      id: string;
      name: string;
      unit: string;
    };
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    notes?: string | null;
  }>;
  refunds: Array<{
    id: string;
    reason?: string | null;
    total: number;
    createdAt: string;
    items: Array<{
      id: string;
      saleItemId: string;
      quantity: number;
      amount: number;
      product: {
        name: string;
        unit: string;
      };
    }>;
    payments: Array<{
      id: string;
      method: string;
      amount: number;
    }>;
  }>;
}

function customerLabel(customer: SaleDetail["customer"]): string {
  if (!customer) return "Consumidor final";
  if (customer.type === "COMPANY") return customer.companyName || "Empresa";
  const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  return fullName || "Cliente";
}

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const canReadSales = user?.permissions?.includes("sales:read");
  const canRefundSales = user?.permissions?.includes("sales:refund");

  const { data, isLoading } = useQuery({
    queryKey: ["sale-detail", params.id],
    queryFn: async () => {
      const response = await api.get<SaleDetail>(`/sales/${params.id}`);
      return response.data!;
    },
    enabled: Boolean(canReadSales && params.id),
  });

  const refundMutation = useMutation({
    mutationFn: async (payload: {
      items: Array<{ saleItemId: string; quantity: number }>;
      refundPayments: Array<{ method: string; amount: number; notes?: string }>;
      reason: string;
      notes?: string;
    }) => {
      const response = await api.post<SaleDetail>(`/sales/${params.id}/refund`, payload);
      return response.data!;
    },
    onSuccess: () => {
      toast.success("Devolucion registrada correctamente");
      setRefundModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sale-detail", params.id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo procesar la devolucion");
    },
  });

  if (!canReadSales) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Tu usuario no tiene permiso `sales:read` para ver ventas.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="p-8">Cargando venta...</div>;
  }

  const refundedTotal = data.refunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
  const refundableBalance = Math.max(Number(data.total) - refundedTotal, 0);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Header
          title={`Venta #${data.id.slice(0, 8)}`}
          description={`Estado: ${data.status} - ${new Date(data.createdAt).toLocaleString("es-AR")}`}
          link="/dashboard/sales"
          linkLabel="Volver a ventas"
          actions={
            canRefundSales && data.status === "CONFIRMED" ? (
              <Button onClick={() => setRefundModalOpen(true)} disabled={refundableBalance <= 0 || refundMutation.isPending}>
                Devolver dinero
              </Button>
            ) : null
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{customerLabel(data.customer)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total venta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${Number(data.total).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Saldo devolvible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${refundableBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Devuelto acumulado: ${refundedTotal.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right">{Number(item.quantity).toFixed(3)}</TableCell>
                    <TableCell className="text-right">${Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(item.subtotal).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos originales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border rounded-md p-3">
                  <p className="text-sm">{payment.method}</p>
                  <p className="font-medium">${Number(payment.amount).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devoluciones registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {data.refunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aun no hay devoluciones para esta venta.</p>
            ) : (
              <div className="space-y-3">
                {data.refunds.map((refund) => (
                  <div key={refund.id} className="border rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Refund #{refund.id.slice(0, 8)}</p>
                      <p className="text-sm font-semibold">${Number(refund.total).toFixed(2)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(refund.createdAt).toLocaleString("es-AR")} - {refund.reason || "Sin motivo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Metodos: {refund.payments.map((payment) => `${payment.method} $${Number(payment.amount).toFixed(2)}`).join(" | ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button asChild variant="outline">
          <Link href="/dashboard/sales">Volver al listado</Link>
        </Button>
      </div>

      {canRefundSales ? (
        <RefundModal
          open={refundModalOpen}
          onOpenChange={setRefundModalOpen}
          sale={data}
          isLoading={refundMutation.isPending}
          onSubmit={(payload) => refundMutation.mutate(payload)}
        />
      ) : null}
    </div>
  );
}
