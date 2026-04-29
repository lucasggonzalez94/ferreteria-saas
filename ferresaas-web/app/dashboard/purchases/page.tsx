"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Package, DollarSign, Plus, Truck } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from "next/link";
import Header from "@/components/ui/header";
import {getPurchaseStatusLabel} from "@/lib/purchase-status";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/pagination";
import {
  usePermissionGuard,
  usePermissions,
} from "@/lib/hooks/usePermissionGuard";
import { ActionsMenu } from "@/components/ui/actions-menu";

interface Purchase {
  id: string;
  invoiceNumber?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid?: number;
  currency?: string;
  exchangeRate?: {
    rate: number;
    source: string;
  };
  createdAt: string;
  supplier: {
    id: string;
    name: string;
  };
  _count?: {
    items: number;
  };
}

interface PurchasesResponse {
  data: Purchase[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function PurchasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  usePermissionGuard("purchases:read");
  const { canRead: canViewPurchases, canCreate: canCreatePurchase } =
    usePermissions({
      canRead: "purchases:read",
      canCreate: "purchases:create",
    });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const supplierId = searchParams.get("supplierId");

  // Sincronizar selectedSupplierId con el query parameter
  useEffect(() => {
    if (supplierId) {
      setSelectedSupplierId(supplierId);
    }
  }, [supplierId]);

  const { data: purchasesData, isLoading } = useQuery<
    PurchasesResponse | undefined
  >({
    queryKey: ["purchases", page, limit, startDate, endDate, supplierId],
    queryFn: async () => {
      const response = await api.get<any>("/purchases", {
        params: {
          page,
          limit,
          ...(supplierId && { supplierId }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        },
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      } as PurchasesResponse;
    },
    enabled: canViewPurchases,
  });

  const { data: summaryData } = useQuery<any>({
    queryKey: ["purchases-summary"],
    queryFn: async () => {
      const response = await api.get<any>("/payables/summary");
      return response.data;
    },
    enabled: canViewPurchases,
  });

  const { data: suppliersData } = useQuery<any>({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const response = await api.get<any>("/suppliers", {
        params: { limit: 1000 },
      });
      // response.data contiene { data: [...], meta: {...} }
      return response.data as any;
    },
    enabled: canViewPurchases,
  });

  const purchases = Array.isArray(purchasesData?.data)
    ? purchasesData.data
    : Array.isArray(purchasesData)
      ? purchasesData
      : [];
  const meta = purchasesData?.meta || {
    page: 1,
    limit: limit,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };

  const startIndex = purchases.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);
  const summary = summaryData || {};

  // suppliersData contiene { data: [...], meta: {...} }
  // Manejar tanto si suppliersData es un array directo como si es un objeto con propiedad data
  let suppliers: any[] = [];
  if (suppliersData) {
    if (Array.isArray(suppliersData)) {
      suppliers = suppliersData;
    } else if (Array.isArray(suppliersData.data)) {
      suppliers = suppliersData.data;
    }
  }

  const totalAmount = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const uniqueSuppliers = new Set(purchases.map((p) => p.supplier.id)).size;

  // Obtener nombre del proveedor filtrado desde la lista de proveedores
  const supplierName = supplierId
    ? suppliers.find((s: any) => s.id === supplierId)?.name
    : null;

  const handleSupplierChange = (newSupplierId: string) => {
    if (newSupplierId) {
      router.push(`/dashboard/purchases?supplierId=${newSupplierId}`);
    } else {
      router.push("/dashboard/purchases");
    }
  };

  const handleClearFilter = () => {
    router.push("/dashboard/purchases");
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Compras"
          link={
            supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard"
          }
          linkLabel={supplierId ? "Volver al Proveedor" : "Volver al Dashboard"}
        />
        {supplierId && supplierName && (
          <div className="brand-accent-panel flex items-center gap-2 px-4 py-2">
            <span className="text-sm brand-accent-subtle">
              Filtrado por: <strong>{supplierName}</strong>
            </span>
            <button
              onClick={handleClearFilter}
              className="ml-2 font-semibold brand-accent-text hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Compras"
            value={isLoading ? "..." : meta.total || 0}
            icon={ShoppingCart}
          />
          <StatCard
            title="Proveedores"
            value={isLoading ? "..." : uniqueSuppliers}
            icon={Package}
          />
          <StatCard
            title="Monto Total"
            value={isLoading ? "0,00" : `$${totalAmount.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCard
            title="Pendiente Pagar"
            value={
              isLoading ? "0,00" : `$${(summary.totalPending || 0).toFixed(2)}`
            }
            icon={DollarSign}
            valueClassName="text-amber-600"
          />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Proveedor</label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={(value) => {
                    handleSupplierChange(value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <DatePicker
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha inicio"
                  label="Desde"
                />
              </div>
              <div>
                <DatePicker
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha fin"
                  label="Hasta"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setSelectedSupplierId("");
                    router.push("/dashboard/purchases");
                    setPage(1);
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        {canCreatePurchase && (
          <div className="mb-6">
            <Link href="/dashboard/purchases/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Compra
              </Button>
            </Link>
          </div>
        )}

        {/* Purchases List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando compras..." />
          </div>
        ) : purchases.length > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Listado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {purchases.map((purchase: Purchase) => {
                    const purchaseNumber = purchase.invoiceNumber || purchase.id.slice(0, 8);
                    const totalAmount = Number(purchase.total);
                    const itemsCount = purchase._count?.items || 0;

                    return (
                      <div
                        key={purchase.id}
                        className="rounded-lg border p-3 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer"
                      >
                        <div className="app-icon-badge h-12 w-12 rounded-full border-2 border-[hsl(var(--brand-accent-border)/0.5)] bg-gradient-to-br from-[hsl(var(--brand-accent-soft))] to-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground truncate text-[15px]">
                              Compra #{purchaseNumber}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 border ${
                                purchase.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : purchase.status === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : purchase.status === 'CONFIRMED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  purchase.status === 'PAID'
                                    ? 'bg-emerald-500'
                                    : purchase.status === 'PARTIAL'
                                    ? 'bg-amber-500'
                                    : purchase.status === 'CONFIRMED'
                                    ? 'bg-blue-500'
                                    : 'bg-gray-500'
                                }`}
                              />
                              {getPurchaseStatusLabel(purchase.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Truck className="h-3.5 w-3.5" />
                              <span className="text-xs text-foreground/80">
                                {purchase.supplier.name}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">Fecha:</span>
                              <span className="text-xs text-foreground/80">
                                {new Date(purchase.createdAt).toLocaleDateString('es-AR')}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              <span className="text-xs text-foreground/80">
                                {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 flex-shrink-0">
                          <div className="text-right min-w-[80px]">
                            <p className="text-xs text-muted-foreground/70 uppercase tracking-wide font-medium">
                              Total
                            </p>
                            <p className="text-base font-bold tabular-nums text-foreground">
                              ${totalAmount.toFixed(2)}
                            </p>
                          </div>
                          <ActionsMenu
                            actions={[
                              {
                                label: 'Ver detalle',
                                onClick: () => router.push(`/dashboard/purchases/${purchase.id}`),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay compras registradas
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
