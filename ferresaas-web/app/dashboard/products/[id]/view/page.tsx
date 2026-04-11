"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Image from "next/image";
import type {
  Product,
  PriceHistoryEntry,
  InventoryMovementEntry,
  SalesSummary,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Power,
  Upload,
  X,
  DollarSign,
  Package,
  TrendingUp,
  BarChart3,
  ImageIcon,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { format, subDays, subYears, startOfYear, startOfMonth } from "date-fns";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { es } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/v1", "") ||
  "http://localhost:3001";

type DatePreset =
  | "7d"
  | "30d"
  | "this-month"
  | "this-year"
  | "last-year"
  | "custom";

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = now;

  switch (preset) {
    case "7d":
      return { from: subDays(now, 7), to };
    case "30d":
      return { from: subDays(now, 30), to };
    case "this-month":
      return { from: startOfMonth(now), to };
    case "this-year":
      return { from: startOfYear(now), to };
    case "last-year": {
      const lastYear = subYears(now, 1);
      return {
        from: startOfYear(lastYear),
        to: new Date(lastYear.getFullYear(), 11, 31, 23, 59, 59),
      };
    }
    default:
      return { from: subDays(now, 30), to };
  }
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: "Recepción de compra",
  SALE: "Venta",
  RETURN: "Devolución",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferencia",
};

const UNIT_LABELS: Record<string, string> = {
  u: "Unidad",
  mt: "Metro",
  kg: "Kilogramo",
  lt: "Litro",
};

export default function ProductDetailViewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const productId = params.id as string;

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { fromISO, toISO } = useMemo(() => {
    const dateRange =
      datePreset === "custom" && customFrom && customTo
        ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") }
        : getDateRange(datePreset);

    return {
      fromISO: dateRange.from.toISOString(),
      toISO: dateRange.to.toISOString(),
    };
  }, [datePreset, customFrom, customTo]);

  // Queries
  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const res = await api.get<Product>(`/products/${productId}`);
      return res.data!;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  console.log(`${API_BASE}${product?.imageUrl}`);

  const { data: priceHistory, isLoading: loadingPriceHistory } = useQuery({
    queryKey: ["price-history", productId],
    queryFn: async () => {
      const res = await api.get<PriceHistoryEntry[]>(
        `/price-suggestions/history/${productId}`,
        { params: { limit: "50" } },
      );
      return res.data || [];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
  });

  const { data: salesSummary, isLoading: loadingSales } = useQuery({
    queryKey: ["sales-summary", productId, fromISO, toISO],
    queryFn: async () => {
      const res = await api.get<SalesSummary>(
        `/products/${productId}/sales-summary`,
        { params: { from: fromISO, to: toISO } },
      );
      return res.data!;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const { data: stockMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ["stock-movements", productId, fromISO, toISO],
    queryFn: async () => {
      const res = await api.get<InventoryMovementEntry[]>(
        `/products/${productId}/stock-movements`,
        { params: { from: fromISO, to: toISO, limit: "50" } },
      );
      return res.data || [];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/products/${productId}`);
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/dashboard/products");
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo eliminar el producto");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      await api.put(`/products/${productId}`, { isActive });
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo actualizar el estado");
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      await api.upload(`/products/image/${productId}`, formData);
    },
    onSuccess: () => {
      toast.success("Imagen subida correctamente");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo subir la imagen");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/products/${productId}/image`);
    },
    onSuccess: () => {
      toast.success("Imagen eliminada");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo eliminar la imagen");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = () => {
    setDeleteDialog(true);
  };

  // Preparar datos para gráfico de precios
  const priceChartData = useMemo(
    () =>
      (priceHistory || [])
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((entry) => ({
          date: format(new Date(entry.createdAt), "dd/MM/yy"),
          fullDate: format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", {
            locale: es,
          }),
          precio: Number(entry.newPrice),
          costo: Number(entry.newCost),
        })),
    [priceHistory],
  );

  // Preparar datos para gráfico de ventas
  const salesChartData = useMemo(
    () =>
      (salesSummary?.points || []).map((point) => ({
        date: format(new Date(point.date), "dd/MM"),
        fullDate: format(new Date(point.date), "dd/MM/yyyy", { locale: es }),
        unidades: point.units,
        ingresos: point.revenue,
      })),
    [salesSummary?.points],
  );

  if (loadingProduct) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner text="Cargando producto..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Producto no encontrado</p>
        <Button
          className="mt-4"
          onClick={() => router.push("/dashboard/products")}
        >
          Volver al listado
        </Button>
      </div>
    );
  }

  const margin =
    product.cost > 0
      ? (((product.price - product.cost) / product.cost) * 100).toFixed(1)
      : "N/A";

  const stockQuantityNumber = Number(product.stockQuantity);
  const minStockNumber =
    product.minStock !== undefined && product.minStock !== null
      ? Number(product.minStock)
      : null;

  const isLowStock =
    minStockNumber !== null && !Number.isNaN(stockQuantityNumber)
      ? stockQuantityNumber <= minStockNumber
      : false;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/products")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    product.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {product.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                SKU: {product.internalSku}
                {product.barcode && ` · Código: ${product.barcode}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleActiveMutation.mutate(!product.isActive)}
              disabled={toggleActiveMutation.isPending}
            >
              <Power className="h-4 w-4 mr-1" />
              {product.isActive ? "Desactivar" : "Activar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/products/${productId}`)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Filtro de rango de fechas */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground mr-2">
                Rango:
              </span>
              {(
                [
                  { value: "7d", label: "7 días" },
                  { value: "30d", label: "30 días" },
                  { value: "this-month", label: "Este mes" },
                  { value: "this-year", label: "Este año" },
                  { value: "last-year", label: "Año anterior" },
                  { value: "custom", label: "Personalizado" },
                ] as { value: DatePreset; label: string }[]
              ).map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 ml-2">
                  <DatePicker
                    value={customFrom}
                    onChange={(value) => setCustomFrom(value)}
                    placeholder="Desde"
                  />
                  <span className="text-sm text-muted-foreground">a</span>
                  <DatePicker
                    value={customTo}
                    onChange={(value) => setCustomTo(value)}
                    placeholder="Hasta"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Precio</span>
              </div>
              <p className="text-xl font-bold">
                ${Number(product.price).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Costo</span>
              </div>
              <p className="text-xl font-bold">
                ${Number(product.cost).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Margen</span>
              </div>
              <p className="text-xl font-bold">{margin}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Stock</span>
              </div>
              <p
                className={`text-xl font-bold ${isLowStock ? "text-red-600" : ""}`}
              >
                {Number(product.stockQuantity)} {product.unit}
              </p>
              {product.minStock !== undefined && product.minStock !== null && (
                <p className="text-xs text-muted-foreground">
                  Mín: {Number(product.minStock)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Ventas (uds)
                </span>
              </div>
              <p className="text-xl font-bold">
                {loadingSales ? "..." : (salesSummary?.totalUnits ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ingresos</span>
              </div>
              <p className="text-xl font-bold">
                {loadingSales
                  ? "..."
                  : `$${(salesSummary?.totalRevenue ?? 0).toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos y detalles - 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: gráficos y tablas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Historial de precios - Gráfico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historial de Precios</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPriceHistory ? (
                  <div className="h-64 flex items-center justify-center">
                    <LoadingSpinner text="Cargando historial..." />
                  </div>
                ) : priceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={priceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `$${Number(value).toFixed(2)}`,
                          name === "precio" ? "Precio" : "Costo",
                        ]}
                        labelFormatter={(label: any, payload: any[]) =>
                          payload?.[0]?.payload?.fullDate || label
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="precio"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="precio"
                      />
                      <Line
                        type="monotone"
                        dataKey="costo"
                        stroke="#64748b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        strokeDasharray="5 5"
                        name="costo"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No hay cambios de precio en el rango seleccionado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historial de precios - Tabla */}
            {priceHistory && priceHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cambios de Precio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">
                            Fecha
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Precio anterior
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Precio nuevo
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Costo anterior
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Costo nuevo
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Margen
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceHistory.map((entry) => {
                          const oldMargin = entry.oldMargin ? Number(entry.oldMargin) : null;
                          const newMargin = entry.newMargin ? Number(entry.newMargin) : null;
                          const marginChange = oldMargin !== null && newMargin !== null 
                            ? newMargin - oldMargin 
                            : null;
                          
                          return (
                            <tr key={entry.id} className="border-b last:border-0">
                              <td className="py-2 px-2">
                                {format(
                                  new Date(entry.createdAt),
                                  "dd/MM/yyyy HH:mm",
                                  { locale: es },
                                )}
                              </td>
                              <td className="text-right py-2 px-2">
                                ${Number(entry.oldPrice).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-2 font-medium">
                                ${Number(entry.newPrice).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-2">
                                ${Number(entry.oldCost).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-2 font-medium">
                                ${Number(entry.newCost).toFixed(2)}
                              </td>
                              <td className="text-right py-2 px-2">
                                {newMargin !== null ? (
                                  <span className={marginChange !== null && marginChange !== 0 ? (marginChange > 0 ? "text-green-600" : "text-red-600") : ""}>
                                    {newMargin.toFixed(1)}%
                                    {marginChange !== null && marginChange !== 0 && (
                                      <span className="text-xs ml-1">
                                        ({marginChange > 0 ? "+" : ""}{marginChange.toFixed(1)})
                                      </span>
                                    )}
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {entry.reason === "purchase" ? "Compra" : 
                                 entry.reason === "manual_adjustment" ? "Ajuste manual" :
                                 entry.reason === "approved_suggestion" ? "Sugerencia aprobada" :
                                 entry.reason || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ventas - Gráfico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSales ? (
                  <div className="h-64 flex items-center justify-center">
                    <LoadingSpinner text="Cargando ventas..." />
                  </div>
                ) : salesChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={salesChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          name === "unidades"
                            ? `${value} uds`
                            : `$${Number(value).toFixed(2)}`,
                          name === "unidades" ? "Unidades" : "Ingresos",
                        ]}
                        labelFormatter={(label: any, payload: any[]) =>
                          payload?.[0]?.payload?.fullDate || label
                        }
                      />
                      <Bar
                        dataKey="unidades"
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                        name="unidades"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No hay ventas en el rango seleccionado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Movimientos de stock */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Movimientos de Stock</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMovements ? (
                  <div className="py-8 text-center">
                    <LoadingSpinner text="Cargando movimientos..." />
                  </div>
                ) : stockMovements && stockMovements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">
                            Fecha
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            Tipo
                          </th>
                          <th className="text-right py-2 px-2 font-medium">
                            Cantidad
                          </th>
                          <th className="text-left py-2 px-2 font-medium">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements.map((mov) => (
                          <tr key={mov.id} className="border-b last:border-0">
                            <td className="py-2 px-2">
                              {format(
                                new Date(mov.createdAt),
                                "dd/MM/yyyy HH:mm",
                                { locale: es },
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {MOVEMENT_TYPE_LABELS[mov.type] || mov.type}
                            </td>
                            <td
                              className={`text-right py-2 px-2 font-medium ${
                                Number(mov.quantity) > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {Number(mov.quantity) > 0 ? "+" : ""}
                              {Number(mov.quantity)}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">
                              {mov.reason || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay movimientos de stock en el rango seleccionado
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha: detalles e imagen */}
          <div className="space-y-6">
            {/* Imagen del producto */}
            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Imagen
                </CardTitle>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 bg-white dark:bg-slate-800 dark:border-slate-700"
                    aria-label="Subir imagen del producto"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadImageMutation.isPending}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 bg-white text-red-600 hover:text-red-700 dark:bg-slate-800 dark:border-slate-700 dark:text-red-300 dark:hover:text-red-200"
                    aria-label="Eliminar imagen del producto"
                    onClick={() => deleteImageMutation.mutate()}
                    disabled={deleteImageMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {product.imageUrl ? (
                  <div className="flex items-center justify-center">
                    <Image
                      src={
                        product.imageUrl.startsWith("http")
                          ? product.imageUrl
                          : `${API_BASE}${product.imageUrl}`
                      }
                      alt={product.name}
                      width={192}
                      height={192}
                      unoptimized
                      className="w-48 h-48 object-cover rounded-md border bg-gray-50 dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-md bg-gray-50 dark:bg-slate-900 dark:border-slate-700">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Sin imagen
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadImageMutation.isPending}
                      className="bg-white dark:bg-slate-900 dark:border-slate-700"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Subir imagen
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </CardContent>
            </Card>

            {/* Detalles del producto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Nombre" value={product.name} />
                <DetailRow label="SKU interno" value={product.internalSku} />
                {product.barcode && (
                  <DetailRow label="Código de barras" value={product.barcode} />
                )}
                {product.description && (
                  <DetailRow label="Descripción" value={product.description} />
                )}
                <DetailRow
                  label="Categoría"
                  value={product.category?.name || "Sin categoría"}
                />
                <DetailRow
                  label="Marca"
                  value={product.brand?.name || "Sin marca"}
                />
                <DetailRow
                  label="Unidad de medida"
                  value={UNIT_LABELS[product.unit] || product.unit}
                />
                <DetailRow
                  label="Permite fracciones"
                  value={product.isFractional ? "Sí" : "No"}
                />
                <DetailRow label="IVA" value={`${Number(product.taxRate)}%`} />
                {product.marginPercent !== undefined &&
                  product.marginPercent !== null && (
                    <DetailRow
                      label="Margen configurado"
                      value={`${Number(product.marginPercent)}%`}
                    />
                  )}
                {product.suggestedPrice !== undefined &&
                  product.suggestedPrice !== null && (
                    <DetailRow
                      label="Precio sugerido"
                      value={`$${Number(product.suggestedPrice).toFixed(2)}`}
                    />
                  )}
                {product.createdAt && (
                  <DetailRow
                    label="Creado"
                    value={format(
                      new Date(product.createdAt),
                      "dd/MM/yyyy HH:mm",
                      { locale: es },
                    )}
                  />
                )}
                {product.updatedAt && (
                  <DetailRow
                    label="Última actualización"
                    value={format(
                      new Date(product.updatedAt),
                      "dd/MM/yyyy HH:mm",
                      { locale: es },
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        onConfirm={() => deleteMutation.mutate()}
        title="Eliminar Producto"
        description="¿Eliminar este producto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
