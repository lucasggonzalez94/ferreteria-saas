"use client";

import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Plus, TrendingDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import {
  usePermissionGuard,
  usePermissions,
} from "@/lib/hooks/usePermissionGuard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { X } from "lucide-react";
import AdjustmentModal from "@/components/inventory/adjustment-modal";
import ReturnModal from "@/components/inventory/return-modal";
import {
  todayLocal,
  monthsAgoLocal,
  rangeForLocalDays,
  formatDate,
} from "@/lib/timezone";

interface InventoryProduct {
  id: string;
  internalSku: string;
  name: string;
  unit: string;
  stockQuantity: number;
  minStock?: number;
  category?: { name: string };
}

interface StockAlert {
  id: string;
  name: string;
  internalSku: string;
  unit: string;
  stockQuantity: number;
  minStock?: number;
  alertLevel: string;
  alertMessage: string;
}

interface StockAlertsResponse {
  items: StockAlert[];
  summary: {
    critical: number;
    warning: number;
    total: number;
  };
}

interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  reason?: string;
  createdAt: string;
  user?: { name?: string; username?: string };
  product: { name: string; unit?: string };
}

interface AdjustmentData {
  productId: string;
  quantity: number;
  reason: string;
}

interface ReturnData {
  productId: string;
  quantity: number;
  reason: string;
  saleId?: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  usePermissionGuard("inventory:read");
  const { canRead: canViewInventory, canManage: canManageInventory } =
    usePermissions({
      canRead: "inventory:read",
      canManage: "inventory:manage",
    });

  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>(
    () => {
      // Usar utilidades de timezone para obtener fechas locales correctas
      return {
        from: monthsAgoLocal(1),
        to: todayLocal(),
      };
    },
  );

  // Obtener productos con stock
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["inventory", "products"],
    queryFn: async () => {
      try {
        const response = await api.get<
          InventoryProduct[] | { data: InventoryProduct[] }
        >("/inventory");
        const productList = Array.isArray(response.data)
          ? response.data
          : (response.data as { data: InventoryProduct[] })?.data || [];
        return productList as InventoryProduct[];
      } catch (error) {
        console.error("Error cargando productos:", error);
        return [] as InventoryProduct[];
      }
    },
    enabled: canViewInventory,
  });

  // Obtener alertas de stock
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["inventory", "alerts"],
    queryFn: async () => {
      try {
        const response = await api.get<
          StockAlertsResponse | { data: StockAlertsResponse }
        >("/inventory-reports/stock-alerts");
        const responseData = response.data as
          | StockAlertsResponse
          | { data: StockAlertsResponse };
        const alertsData = (responseData as { data: StockAlertsResponse })
          ?.data ||
          responseData || { items: [], summary: {} };
        return alertsData as StockAlertsResponse;
      } catch (error) {
        console.error("Error cargando alertas:", error);
        return {
          items: [],
          summary: { critical: 0, warning: 0, total: 0 },
        } as StockAlertsResponse;
      }
    },
    enabled: canViewInventory,
  });

  // Obtener movimientos recientes
  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory", "movements", dateFilter],
    queryFn: async () => {
      try {
        const params: Record<string, string | number> = {
          limit: 50,
          page: 1,
        };

        // Usar utilidades de timezone para convertir fechas locales a UTC
        if (dateFilter.from && dateFilter.to) {
          const utcRange = rangeForLocalDays(dateFilter.from, dateFilter.to);
          params.startDate = utcRange.startDate;
          params.endDate = utcRange.endDate;
        }

        const response = await api.get<
          InventoryMovement[] | { data: InventoryMovement[] }
        >("/inventory/movements", {
          params,
        });
        const movementList = Array.isArray(response.data)
          ? response.data
          : (response.data as { data: InventoryMovement[] })?.data || [];
        return movementList as InventoryMovement[];
      } catch (error) {
        console.error("Error cargando movimientos:", error);
        return [] as InventoryMovement[];
      }
    },
    enabled: canViewInventory,
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (data: AdjustmentData) => {
      const response = await api.post("/inventory/adjustments", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustmentOpen(false);
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (data: ReturnData) => {
      const response = await api.post("/inventory/returns", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setReturnOpen(false);
    },
  });

  const getAlertColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
      case "WARNING":
        return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700";
    }
  };

  const getAlertIcon = (level: string) => {
    return level === "CRITICAL" ? (
      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    );
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Inventario"
          actions={
            <div className="flex gap-2">
              {canManageInventory && (
                <Button
                  onClick={() => setAdjustmentOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Ajuste Manual
                </Button>
              )}
              {canManageInventory && (
                <Button
                  onClick={() => setReturnOpen(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <TrendingDown className="h-4 w-4" />
                  Devolución
                </Button>
              )}
            </div>
          }
        />

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          {/* Tab: Alertas */}
          <TabsContent value="alerts">
            {alertsLoading ? (
              <LoadingSpinner text="Cargando alertas..." />
            ) : alerts?.items && alerts.items.length > 0 ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Resumen de Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                          Críticas
                        </p>
                        <p className="text-2xl font-bold text-red-700">
                          {alerts.summary?.critical || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                          Advertencias
                        </p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {alerts.summary?.warning || 0}
                        </p>
                      </div>
                      <div className="brand-accent-panel p-4">
                        <p className="text-sm font-medium brand-accent-subtle">
                          Total
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {alerts.summary?.total || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  {alerts.items.map((alert: StockAlert) => (
                    <div
                      key={alert.id}
                      className={`flex justify-between items-center p-4 rounded-lg border ${getAlertColor(
                        alert.alertLevel,
                      )}`}
                    >
                      <div className="flex items-center gap-3">
                        {getAlertIcon(alert.alertLevel)}
                        <div>
                          <p className="font-medium">{alert.name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {alert.internalSku}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {Number(alert.stockQuantity).toFixed(2)} {alert.unit}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {alert.alertMessage}
                        </p>
                        {alert.minStock && (
                          <p className="text-xs text-muted-foreground">
                            Mín: {Number(alert.minStock).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No hay alertas de stock
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Productos */}
          <TabsContent value="products">
            {productsLoading ? (
              <LoadingSpinner text="Cargando productos..." />
            ) : products && products.length > 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: InventoryProduct) => {
                          const stockLevel =
                            product.minStock &&
                            product.stockQuantity < product.minStock
                              ? "low"
                              : product.stockQuantity === 0
                                ? "critical"
                                : "ok";

                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {product.internalSku}
                              </TableCell>
                              <TableCell>{product.name}</TableCell>
                              <TableCell>
                                {product.category?.name || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(product.stockQuantity).toFixed(2)}{" "}
                                {product.unit}
                              </TableCell>
                              <TableCell className="text-right">
                                {product.minStock
                                  ? Number(product.minStock).toFixed(2)
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                {stockLevel === "critical" && (
                                  <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                    Sin stock
                                  </span>
                                )}
                                {stockLevel === "low" && (
                                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                    Bajo
                                  </span>
                                )}
                                {stockLevel === "ok" && (
                                  <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                    OK
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No hay productos
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Movimientos */}
          <TabsContent value="movements">
            <div className="mb-4 flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Desde
                </p>
                <DatePicker
                  value={dateFilter.from}
                  onChange={(date) =>
                    setDateFilter((prev) => ({ ...prev, from: date }))
                  }
                  className="w-[180px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Hasta
                </p>
                <DatePicker
                  value={dateFilter.to}
                  onChange={(date) =>
                    setDateFilter((prev) => ({ ...prev, to: date }))
                  }
                  className="w-[180px]"
                />
              </div>
              {(dateFilter.from || dateFilter.to) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter({ from: "", to: "" })}
                  className="h-10 gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>

            {movementsLoading ? (
              <LoadingSpinner text="Cargando movimientos..." />
            ) : movements && movements.length > 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((movement: InventoryMovement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-sm">
                              {formatDate(movement.createdAt, "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {movement.user?.name ||
                                movement.user?.username ||
                                "Sistema"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-block px-2 py-1 text-xs rounded-full ${
                                  movement.type === "SALE"
                                    ? "bg-red-100 text-red-700"
                                    : movement.type === "PURCHASE_RECEIPT"
                                      ? "bg-green-100 text-green-700"
                                      : movement.type === "RETURN"
                                        ? "border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-foreground"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {movement.type === "SALE"
                                  ? "Venta"
                                  : movement.type === "PURCHASE_RECEIPT"
                                    ? "Compra"
                                    : movement.type === "RETURN"
                                      ? "Devolución"
                                      : "Ajuste"}
                              </span>
                            </TableCell>
                            <TableCell>{movement.product.name}</TableCell>
                            <TableCell className="text-right font-medium">
                              {movement.quantity > 0 ? "+" : ""}
                              {Number(movement.quantity).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {movement.reason || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center min-h-[200px]">
                  <p className="text-muted-foreground">No hay movimientos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modales */}
      {canManageInventory && (
        <AdjustmentModal
          open={adjustmentOpen}
          onOpenChange={setAdjustmentOpen}
          onSubmit={(data) => adjustmentMutation.mutate(data)}
          isLoading={adjustmentMutation.isPending}
        />
      )}

      {canManageInventory && (
        <ReturnModal
          open={returnOpen}
          onOpenChange={setReturnOpen}
          onSubmit={(data) => returnMutation.mutate(data)}
          isLoading={returnMutation.isPending}
        />
      )}
    </div>
  );
}
