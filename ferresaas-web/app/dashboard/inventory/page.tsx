"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Plus } from "lucide-react";
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
import {
  todayLocal,
  monthsAgoLocal,
  rangeForLocalDays,
  formatDate,
} from "@/lib/timezone";
import { Pagination } from "@/components/ui/pagination";

interface InventoryProduct {
  id: string;
  internalSku: string;
  name: string;
  unit: string;
  stockQuantity: number;
  minStock?: number;
  category?: { name: string };
}

interface ProductsResponse {
  data: InventoryProduct[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

interface AlertsResponse {
  items: StockAlert[];
  summary: {
    critical: number;
    warning: number;
    total: number;
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
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

interface MovementsResponse {
  data: InventoryMovement[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface AdjustmentData {
  productId: string;
  quantity: number;
  reason: string;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();

  usePermissionGuard("inventory:read");
  const { canRead: canViewInventory, canManage: canManageInventory } =
    usePermissions({
      canRead: "inventory:read",
      canManage: "inventory:manage",
    });

  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(20);
  const [alertPage, setAlertPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [movementLimit, setMovementLimit] = useState(20);
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
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["inventory", "products", productPage, productLimit],
    queryFn: async () => {
      try {
        const response = await api.get("/inventory", {
          params: { page: productPage, limit: productLimit },
        });

        const result = response as unknown as {
          success: boolean;
          data: InventoryProduct[];
          meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
        };

        if (!result.success) {
          throw new Error("Error fetching products");
        }

        return {
          data: result.data || [],
          meta: result.meta || { page: 1, limit: productLimit, total: 0, totalPages: 0, hasMore: false },
        } as ProductsResponse;
      } catch (error) {
        console.error("Error cargando productos:", error);
        return {
          data: [],
          meta: { page: 1, limit: productLimit, total: 0, totalPages: 0, hasMore: false },
        } as ProductsResponse;
      }
    },
    enabled: canViewInventory,
  });

  // Obtener alertas de stock
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["inventory", "alerts", alertPage],
    queryFn: async () => {
      try {
        const response = await api.get("/inventory-reports/stock-alerts", {
          params: { page: alertPage, limit: 20 },
        });

        const result = response as unknown as {
          success: boolean;
          data: { items: StockAlert[]; summary: { critical: number; warning: number; total: number } };
          meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
        };

        if (!result.success) {
          throw new Error("Error fetching alerts");
        }

        return {
          items: result.data?.items || [],
          summary: result.data?.summary || { critical: 0, warning: 0, total: 0 },
          meta: result.meta || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        } as AlertsResponse;
      } catch (error) {
        console.error("Error cargando alertas:", error);
        return {
          items: [],
          summary: { critical: 0, warning: 0, total: 0 },
          meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        } as AlertsResponse;
      }
    },
    enabled: canViewInventory,
  });

  // Obtener movimientos recientes
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory", "movements", dateFilter, movementPage, movementLimit],
    queryFn: async () => {
      try {
        const params: Record<string, string | number> = {
          limit: movementLimit,
          page: movementPage,
        };

        if (dateFilter.from && dateFilter.to) {
          const utcRange = rangeForLocalDays(dateFilter.from, dateFilter.to);
          params.startDate = utcRange.startDate;
          params.endDate = utcRange.endDate;
        }

        const response = await api.get("/inventory/movements", { params });

        const result = response as unknown as {
          success: boolean;
          data: InventoryMovement[];
          meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
        };

        if (!result.success) {
          throw new Error("Error fetching movements");
        }

        return {
          data: result.data || [],
          meta: result.meta || { page: 1, limit: movementLimit, total: 0, totalPages: 0, hasMore: false },
        } as MovementsResponse;
      } catch (error) {
        console.error("Error cargando movimientos:", error);
        return {
          data: [],
          meta: { page: 1, limit: movementLimit, total: 0, totalPages: 0, hasMore: false },
        } as MovementsResponse;
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
          description="Gestiona stock y ajustes manuales. Las devoluciones monetarias de clientes se realizan desde Ventas."
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
            ) : alertsData?.items && alertsData.items.length > 0 ? (
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
                          {alertsData.summary?.critical || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                          Advertencias
                        </p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {alertsData.summary?.warning || 0}
                        </p>
                      </div>
                      <div className="brand-accent-panel p-4">
                        <p className="text-sm font-medium brand-accent-subtle">
                          Total
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {alertsData.summary?.total || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  {alertsData.items.map((alert: StockAlert) => (
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
                {alertsData.meta.total > 0 && alertsData.meta.totalPages > 0 && (
                  <div className="mt-4">
                    <Pagination
                      setPage={setAlertPage}
                      currentPage={alertsData.meta.page}
                      totalPages={alertsData.meta.totalPages}
                      startIndex={(alertsData.meta.page - 1) * alertsData.meta.limit + 1}
                      endIndex={Math.min(
                        alertsData.meta.page * alertsData.meta.limit,
                        alertsData.meta.total,
                      )}
                      total={alertsData.meta.total}
                      limit={alertsData.meta.limit}
                      onLimitChange={() => {}}
                      onPageChange={setAlertPage}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent>
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
            ) : productsData?.data && productsData.data.length > 0 ? (
              <Card>
                <CardContent>
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
                        {productsData.data.map((product: InventoryProduct) => {
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
                  <div className="mt-4">
                    <Pagination
                      setPage={setProductPage}
                      currentPage={productsData.meta.page}
                      totalPages={productsData.meta.totalPages}
                      startIndex={(productsData.meta.page - 1) * productsData.meta.limit + 1}
                      endIndex={Math.min(
                        productsData.meta.page * productsData.meta.limit,
                        productsData.meta.total,
                      )}
                      total={productsData.meta.total}
                      limit={productsData.meta.limit}
                      onLimitChange={setProductLimit}
                      onPageChange={setProductPage}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
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
            ) : movementsData?.data && movementsData.data.length > 0 ? (
              <Card>
                <CardContent>
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
                        {movementsData.data.map((movement: InventoryMovement) => (
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
                  <div className="mt-4">
                    <Pagination
                      setPage={setMovementPage}
                      currentPage={movementsData.meta.page}
                      totalPages={movementsData.meta.totalPages}
                      startIndex={(movementsData.meta.page - 1) * movementsData.meta.limit + 1}
                      endIndex={Math.min(
                        movementsData.meta.page * movementsData.meta.limit,
                        movementsData.meta.total,
                      )}
                      total={movementsData.meta.total}
                      limit={movementsData.meta.limit}
                      onLimitChange={setMovementLimit}
                      onPageChange={setMovementPage}
                    />
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
    </div>
  );
}
