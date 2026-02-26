"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  ShoppingCart,
  Package,
  DollarSign,
  Plus,
  Eye,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from "next/link";
import Header from "@/components/ui/header";
import { getPurchaseStatusLabel, getPurchaseStatusColor } from "@/lib/purchase-status";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/pagination";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";

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
  const {
    canRead: canViewPurchases,
    canCreate: canCreatePurchase,
  } = usePermissions({
    canRead: "purchases:read",
    canCreate: "purchases:create",
  });

  const [page, setPage] = useState(1);
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

  const { data: purchasesData, isLoading } = useQuery<PurchasesResponse | undefined>({
    queryKey: ["purchases", page, startDate, endDate, supplierId],
    queryFn: async () => {
      const response = await api.get<any>("/purchases", {
        params: {
          page,
          limit: 10,
          ...(supplierId && { supplierId }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        },
      });
      return {
        data: response.data || [],
        meta: (response as any).meta || { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false },
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

  const purchases = Array.isArray(purchasesData?.data) ? purchasesData.data : (Array.isArray(purchasesData) ? purchasesData : []);
  const meta = purchasesData?.meta || { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false };
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
        <div className="flex items-center justify-between mb-8">
          <Header 
            title="Compras" 
            link={supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard"} 
            linkLabel={supplierId ? "Volver al Proveedor" : "Volver al Dashboard"} 
          />
          {supplierId && supplierName && (
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <span className="text-sm text-blue-700">
                Filtrado por: <strong>{supplierName}</strong>
              </span>
              <button
                onClick={handleClearFilter}
                className="text-blue-600 hover:text-blue-800 font-semibold ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>

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
            value={isLoading ? "0,00" : `$${(summary.totalPending || 0).toFixed(2)}`}
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
                <label className="text-sm font-medium">Desde</label>
                <DatePicker
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha inicio"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Hasta</label>
                <DatePicker
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setPage(1);
                  }}
                  placeholder="Selecciona fecha fin"
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
          <Card>
            <CardContent className="py-12 text-center">
              <LoadingSpinner text="Cargando compras..." />
            </CardContent>
          </Card>
        ) : purchases.length > 0 ? (
          <>
            <div className="space-y-4">
              {purchases.map((purchase: Purchase) => (
                <Card key={purchase.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          Compra #{purchase.invoiceNumber || purchase.id.slice(0, 8)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Proveedor: {purchase.supplier.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          ${Number(purchase.total).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(purchase.createdAt).toLocaleDateString(
                            "es-AR"
                          )}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full border ${getPurchaseStatusColor(purchase.status)}`}>
                          {getPurchaseStatusLabel(purchase.status)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        {purchase._count?.items || 0} productos • Subtotal: $
                        {Number(purchase.subtotal).toFixed(2)} • IVA: $
                        {Number(purchase.tax).toFixed(2)}
                      </div>
                      <Link href={`/dashboard/purchases/${purchase.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalle
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={meta.totalPages}
              hasMore={meta.hasMore}
              onPageChange={setPage}
              className="mt-6"
            />
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
