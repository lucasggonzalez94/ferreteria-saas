"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function SalesPage() {
  usePermissionGuard("sales:read");

  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<SalesResponse>({
    queryKey: ["sales", page, status],
    queryFn: async () => {
      const response = await api.get<SaleListItem[]>("/sales", {
        params: {
          page,
          limit: 20,
          status: status === "ALL" ? undefined : status,
        },
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    },
  });

  const sales = useMemo(() => data?.data || [], [data?.data]);
  const meta = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false };

  const totals = useMemo(() => {
    const confirmed = sales.filter((sale) => sale.status === "CONFIRMED");
    return {
      count: sales.length,
      confirmed: confirmed.length,
      amount: confirmed.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    };
  }, [sales]);

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
              <p className="text-sm text-muted-foreground">Ventas en pagina</p>
              <p className="text-2xl font-semibold">{totals.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Confirmadas</p>
              <p className="text-2xl font-semibold">{totals.confirmed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Total confirmado</p>
              <p className="text-2xl font-semibold">${totals.amount.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
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
                        {new Date(sale.createdAt).toLocaleString("es-AR")} - {getStatusLabel(sale.status)}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="font-semibold">${Number(sale.total).toFixed(2)}</p>
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
          currentPage={meta.page}
          totalPages={Math.max(meta.totalPages || 1, 1)}
          hasMore={meta.hasMore}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
