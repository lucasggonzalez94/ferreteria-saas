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
  rangeForLocalDays,
  formatDate,
} from "@/lib/timezone";
import { Pagination } from "@/components/ui/pagination";
import {
  DATE_PRESETS,
  getDatePresetRange,
  DatePreset,
} from "@/lib/date-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  reason?: string;
  createdAt: string;
  user?: { id?: string; name?: string; username?: string; firstName?: string; lastName?: string };
  product: { id: string; name: string; internalSku: string; unit?: string };
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

const MOVEMENT_TYPES = [
  { value: "SALE", label: "Venta" },
  { value: "PURCHASE_RECEIPT", label: "Compra" },
  { value: "RETURN", label: "Devolución" },
  { value: "STOCK_ADJUSTMENT", label: "Ajuste" },
  { value: "INITIAL_STOCK", label: "Stock Inicial" },
  { value: "TRANSFER", label: "Transferencia" },
];

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
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30_days");
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>(() => {
    const range = getDatePresetRange("last_30_days");
    return {
      from: range.startDate,
      to: range.endDate,
    };
  });
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");

  // Obtener usuarios para el filtro
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ["users", "all"],
    queryFn: async () => {
      try {
        const response = await api.get<any>("/users");
        return response.data?.data || response.data || [];
      } catch {
        return [];
      }
    },
    enabled: canViewInventory,
  });

  // Obtener movimientos recientes
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory", "movements", dateFilter, movementPage, movementLimit, typeFilter, userFilter, productSearch],
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

        if (typeFilter) {
          params.type = typeFilter;
        }

        if (userFilter) {
          params.userId = userFilter;
        }

        if (productSearch) {
          params.productSearch = productSearch;
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

  const handleDatePresetChange = (value: string) => {
    const preset = value as DatePreset;
    setDatePreset(preset);
    if (preset === "custom") {
      setMovementPage(1);
      return;
    }

    const range = getDatePresetRange(preset);
    setDateFilter({ from: range.startDate, to: range.endDate });
    setMovementPage(1);
  };

  const handleClearFilters = () => {
    setDatePreset("last_30_days");
    const range = getDatePresetRange("last_30_days");
    setDateFilter({ from: range.startDate, to: range.endDate });
    setTypeFilter("");
    setUserFilter("");
    setProductSearch("");
    setMovementPage(1);
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
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
          </TabsList>

          {/* Tab: Alertas */}
          <TabsContent value="alerts">
            <StockAlertsList />
          </TabsContent>

          {/* Tab: Movimientos */}
          <TabsContent value="movements">
            <div className="mb-4 flex flex-wrap gap-4 items-end">
              <div>
                <Select value={datePreset} onValueChange={handleDatePresetChange}>
                  <SelectTrigger label="Periodo" className="w-[180px]">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Tipo
                </p>
                <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setMovementPage(1); }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {MOVEMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Usuario
                </p>
                <Select value={userFilter} onValueChange={(value) => { setUserFilter(value); setMovementPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {usersData?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.username || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Producto
                </p>
                <Input
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setMovementPage(1); }}
                  className="w-[180px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Desde
                </p>
                <DatePicker
                  value={dateFilter.from}
                  onChange={(date) => {
                    setDateFilter((prev) => ({ ...prev, from: date }));
                    setDatePreset("custom");
                    setMovementPage(1);
                  }}
                  className="w-[140px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Hasta
                </p>
                <DatePicker
                  value={dateFilter.to}
                  onChange={(date) => {
                    setDateFilter((prev) => ({ ...prev, to: date }));
                    setDatePreset("custom");
                    setMovementPage(1);
                  }}
                  className="w-[140px]"
                />
              </div>
              {(dateFilter.from || dateFilter.to || typeFilter || userFilter || productSearch) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
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
                              {movement.user?.firstName && movement.user?.lastName
                                ? `${movement.user.firstName} ${movement.user.lastName}`
                                : movement.user?.username || "Sistema"}
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
                                        : movement.type === "INITIAL_STOCK"
                                          ? "bg-blue-100 text-blue-700"
                                          : movement.type === "TRANSFER"
                                            ? "bg-purple-100 text-purple-700"
                                            : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {movement.type === "SALE"
                                  ? "Venta"
                                  : movement.type === "PURCHASE_RECEIPT"
                                    ? "Compra"
                                    : movement.type === "RETURN"
                                      ? "Devolución"
                                      : movement.type === "INITIAL_STOCK"
                                        ? "Stock Inicial"
                                        : movement.type === "TRANSFER"
                                          ? "Transferencia"
                                          : "Ajuste"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {movement.product.internalSku} - {movement.product.name}
                            </TableCell>
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
