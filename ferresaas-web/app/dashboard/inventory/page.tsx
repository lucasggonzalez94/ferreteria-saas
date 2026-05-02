"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
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
import { StockAlertsList } from "@/components/stock-alerts/stock-alerts-list";
import {
  todayLocal,
  monthsAgoLocal,
  rangeForLocalDays,
  formatDate,
} from "@/lib/timezone";
import { Pagination } from "@/components/ui/pagination";

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
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          {/* Tab: Alertas */}
          <TabsContent value="alerts">
            <StockAlertsList />
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
