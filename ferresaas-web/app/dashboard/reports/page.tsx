"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, TrendingDown, Package } from "lucide-react";
import Header from "@/components/ui/header";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ReportFilters } from "@/components/reports/report-filters";
import { SalesReport } from "@/components/reports/sales-report";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReportMovement {
  id: string;
  type: string;
  quantity: number;
  reason?: string;
  createdAt: string;
  product: { name: string; unit: string };
}

interface MovementsReport {
  items: ReportMovement[];
  totals: Record<string, Record<string, number>>;
}

interface ReportStockAlert {
  id: string;
  name: string;
  internalSku: string;
  unit: string;
  stockQuantity: number;
  minStock?: number | null;
  alertLevel: string;
  alertMessage: string;
}

interface AlertsReport {
  items: ReportStockAlert[];
  summary: {
    critical: number;
    warning: number;
    total: number;
  };
}

interface RotationProduct {
  id: string;
  internalSku: string;
  name: string;
  currentStock: number;
  minStock?: number;
  rotationSpeed: number;
  classification: string;
  stockValue: number;
}

interface CriticalProduct {
  id: string;
  internalSku: string;
  name: string;
  currentStock: number;
  minStock: number;
  rotationSpeed: number;
  classification: string;
  stockValue: number;
  priority: "CRITICAL" | "ALERT";
}

interface RotationReport {
  items: RotationProduct[];
  summary: {
    fast: number;
    normal: number;
    slow: number;
    totalStockValue: number;
  };
}

interface ReturnItem {
  id: string;
  quantity: number;
  returnValue: number;
  createdAt: string;
  product: { name: string };
  reason?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

interface TopReturnedProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalValue: number;
  percentage: number;
  reason?: string;
}

interface ReturnsReport {
  items: ReturnItem[];
  summary: {
    total: number;
    totalQuantity: number;
    totalReturnValue: number;
    averageReturnValue: number;
    returnRate?: number;
    previousTotal?: number;
    returnsTrendDelta?: number;
    returnsTrendPercentChange?: number;
  };
  topReturnedProducts?: TopReturnedProduct[];
}

interface SalesReportData {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRevenue: number;
    totalSales: number;
    avgTicket: number;
    totalItems: number;
    costTotal?: number;
    grossMargin?: number;
    grossMarginPercent?: number;
  };
  comparison?: {
    period: {
      start: Date;
      end: Date;
    };
    previousRevenue: number;
    revenueDelta: number;
    revenuePercentChange: number;
    previousSales: number;
    salesDelta: number;
    salesPercentChange: number;
    previousAvgTicket: number;
    avgTicketDelta: number;
    avgTicketPercentChange: number;
    previousItems: number;
    itemsDelta: number;
    itemsPercentChange: number;
    previousGrossMargin?: number;
    grossMarginDelta?: number;
    grossMarginPercentChange?: number;
  };
  timeSeries: Array<{
    date: string;
    revenue: number;
    count: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalRevenue: number;
    totalUnits: number;
    cost?: number;
    margin?: number;
    marginPercent?: number;
  }>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    totalRevenue: number;
    percentage: number;
  }>;
  paymentMethods: Record<string, number>;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ 
    startDate: "", 
    endDate: "" 
  });

  usePermissionGuard("reports:read");
  const { canRead: canViewReports } = usePermissions({
    canRead: "reports:read",
  });

  // Reporte 1: Movimientos de Inventario
  const { data: movementsReport, isLoading: movementsLoading } = useQuery({
    queryKey: ["reports", "movements", dateRange],
    queryFn: async () => {
      const response = await api.get<MovementsReport>("/inventory-reports/movements", {
        params: {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          limit: 100,
        },
      });
      return response.data || { items: [], totals: {} };
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Reporte 2: Alertas de Stock
  const { data: alertsReport, isLoading: alertsLoading } = useQuery({
    queryKey: ["reports", "stock-alerts"],
    queryFn: async () => {
      const response = await api.get<AlertsReport>("/inventory-reports/stock-alerts");
      return response.data || { items: [], summary: { critical: 0, warning: 0, total: 0 } };
    },
  });

  // Reporte 3: Rotación de Inventario
  const { data: rotationReport, isLoading: rotationLoading } = useQuery({
    queryKey: ["reports", "rotation", dateRange],
    queryFn: async () => {
      const response = await api.get<RotationReport>("/inventory-reports/rotation", {
        params: {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          limit: 50,
        },
      });
      return response.data || { items: [], summary: { fast: 0, normal: 0, slow: 0, totalStockValue: 0 } };
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Reporte 4: Devoluciones
  const { data: returnsReport, isLoading: returnsLoading } = useQuery({
    queryKey: ["reports", "returns", dateRange],
    queryFn: async () => {
      const response = await api.get<ReturnsReport>("/inventory-reports/returns", {
        params: {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          limit: 100,
        },
      });
      return response.data || { items: [], summary: { total: 0, totalQuantity: 0, totalReturnValue: 0, averageReturnValue: 0 } };
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Reporte 5: Ventas
  const { data: salesReport, isLoading: salesLoading } = useQuery({
    queryKey: ["reports", "sales", dateRange],
    queryFn: async () => {
      const response = await api.get<SalesReportData>("/sales-reports/summary", {
        params: {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          compareWithPrevious: true,
        },
      });
      return response.data;
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Función para exportar a PDF
  const exportToPDF = async (endpoint: string, filename: string) => {
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const queryString = params.toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

      const blob = await api.getBlob(fullEndpoint);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al generar el PDF. Por favor, intenta nuevamente.');
    }
  };

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Reportes"
          description="Lecturas operativas y comerciales con filtros por periodo, métricas más claras y exportación directa."
        />
        
        <ReportFilters 
          onFilterChange={setDateRange}
          defaultPreset="30d"
        />

        <Tabs defaultValue="sales" className="w-full">
          <TabsList>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="rotation">Rotación</TabsTrigger>
            <TabsTrigger value="critical">Reposición Prioritaria</TabsTrigger>
            <TabsTrigger value="returns">Devoluciones</TabsTrigger>
          </TabsList>

          {/* Reporte 0: Ventas */}
          <TabsContent value="sales">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Reporte de Ventas</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/sales-reports/summary/pdf",
                        "reporte-ventas"
                      )
                    }
                    disabled={!dateRange.startDate || !dateRange.endDate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <LoadingSpinner text="Cargando reporte de ventas..." />
                ) : salesReport ? (
                  <SalesReport data={salesReport} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay datos de ventas en el período seleccionado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte 1: Movimientos */}
          <TabsContent value="movements">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Movimientos de Inventario</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/inventory-reports/movements/pdf",
                        "movimientos-inventario"
                      )
                    }
                    disabled={!dateRange.startDate || !dateRange.endDate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <LoadingSpinner text="Cargando movimientos..." />
                ) : movementsReport?.items && movementsReport.items.length > 0 ? (
                  <div className="space-y-4">
                    {movementsReport.totals && Object.keys(movementsReport.totals).length > 0 && (
                      <div className="space-y-3">
                        {Object.entries(movementsReport.totals).map(
                          ([type, unitTotals]: [string, Record<string, number>]) => (
                            <div
                              key={type}
                                className="brand-accent-panel p-4"
                              >
                              <p className="brand-accent-text mb-2 text-sm font-semibold">
                                {type === "SALE"
                                  ? "Ventas"
                                  : type === "PURCHASE_RECEIPT"
                                  ? "Compras"
                                  : type === "RETURN"
                                  ? "Devoluciones"
                                  : "Ajustes"}
                              </p>
                              <div className="space-y-1">
                                {Object.entries(unitTotals).map(([unit, quantity]: [string, number]) => (
                                  <div key={unit} className="flex items-baseline gap-2">
                                    <span className="text-lg font-bold text-foreground">
                                      {Number(quantity).toFixed(2)}
                                    </span>
                                    <span className="text-sm brand-accent-subtle">
                                      {unit === "u" ? "unidades" : 
                                       unit === "mt" ? "metros" : 
                                       unit === "kg" ? "kilogramos" : 
                                       unit === "lt" ? "litros" : unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movementsReport.items.map((movement: ReportMovement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="text-sm">
                                {format(new Date(movement.createdAt), "dd/MM/yyyy", { locale: es })}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
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
                              <TableCell className="text-sm">
                                {movement.product.unit === "u" ? "unidades" : 
                                 movement.product.unit === "mt" ? "metros" : 
                                 movement.product.unit === "kg" ? "kilogramos" : 
                                 movement.product.unit === "lt" ? "litros" : 
                                 movement.product.unit}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {movement.reason || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay movimientos
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte 2: Alertas */}
          <TabsContent value="alerts">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Alertas de Stock</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/inventory-reports/stock-alerts/pdf",
                        "alertas-stock"
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <LoadingSpinner text="Cargando alertas..." />
                ) : alertsReport?.items && alertsReport.items.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                          Críticas
                        </p>
                        <p className="text-2xl font-bold text-red-700">
                          {alertsReport.summary?.critical || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                          Advertencias
                        </p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {alertsReport.summary?.warning || 0}
                        </p>
                      </div>
                      <div className="brand-accent-panel p-3">
                        <p className="text-sm font-medium brand-accent-subtle">
                          Total
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {alertsReport.summary?.total || 0}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {alertsReport.items.map((alert: ReportStockAlert) => (
                        <div
                          key={alert.id}
                          className={`flex justify-between items-center p-4 rounded-lg border ${
                            alert.alertLevel === "CRITICAL"
                              ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                              : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle
                              className={`h-5 w-5 ${
                                alert.alertLevel === "CRITICAL"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-yellow-600 dark:text-yellow-400"
                              }`}
                            />
                            <div>
                              <p className="font-medium">{alert.name}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {alert.internalSku}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {Number(alert.stockQuantity).toFixed(2)}{" "}
                              {alert.unit === "u" ? "unidades" : 
                               alert.unit === "mt" ? "metros" : 
                               alert.unit === "kg" ? "kilogramos" : 
                               alert.unit === "lt" ? "litros" : alert.unit}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {alert.alertMessage}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay alertas
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte 3: Rotación */}
          <TabsContent value="rotation">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Rotación de Inventario</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/inventory-reports/rotation/pdf",
                        "rotacion-inventario"
                      )
                    }
                    disabled={!dateRange.startDate || !dateRange.endDate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rotationLoading ? (
                  <LoadingSpinner text="Cargando rotación..." />
                ) : rotationReport?.items && rotationReport.items.length > 0 ? (
                  <div className="space-y-4">
                    {rotationReport.summary && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            Rápidos
                          </p>
                          <p className="text-2xl font-bold text-green-700">
                            {rotationReport.summary.fast}
                          </p>
                        </div>
                        <div className="brand-accent-panel p-3">
                          <p className="text-sm font-medium brand-accent-subtle">
                            Normales
                          </p>
                          <p className="text-2xl font-bold text-foreground">
                            {rotationReport.summary.normal}
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                            Lentos
                          </p>
                          <p className="text-2xl font-bold text-yellow-700">
                            {rotationReport.summary.slow}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                            Valor Total
                          </p>
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            ${Number(rotationReport.summary.totalStockValue).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Rotación</TableHead>
                            <TableHead>Clasificación</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rotationReport.items.map((product: RotationProduct) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {product.internalSku}
                              </TableCell>
                              <TableCell>{product.name}</TableCell>
                              <TableCell className="text-right">
                                {Number(product.currentStock).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {Number(product.rotationSpeed).toFixed(2)}x
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    product.classification === "FAST"
                                      ? "bg-green-100 text-green-700"
                                      : product.classification === "NORMAL"
                                      ? "border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-foreground"
                                      : "bg-yellow-100 text-yellow-700"
                                   }`}
                                >
                                  {product.classification === "FAST"
                                    ? "Rápido"
                                    : product.classification === "NORMAL"
                                    ? "Normal"
                                    : "Lento"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                ${Number(product.stockValue).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay datos de rotación
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte: Reposición Prioritaria (Productos Críticos) */}
          <TabsContent value="critical">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Reposición Prioritaria</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/inventory-reports/stock-alerts/pdf",
                        "reposicion-prioritaria"
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {alertsLoading || rotationLoading ? (
                  <LoadingSpinner text="Cargando productos críticos..." />
                ) : (
                  <div className="space-y-4">
                    {/* Calcular productos críticos: bajo stock + rotación rápida */}
                    {(() => {
                      const alertItems = alertsReport?.items || [];
                      const rotationItems = rotationReport?.items || [];

                      const criticalProducts: CriticalProduct[] = [];

                      // Productos con alerta (bajo stock)
                      alertItems.forEach(alert => {
                        const rotationItem = rotationItems.find(r => r.internalSku === alert.internalSku);
                        const minStock = Number(alert.minStock ?? 0);
                        const currentStock = Number(alert.stockQuantity);
                        const hasConfiguredMin = minStock > 0;
                        const isUnderMinStock = hasConfiguredMin && currentStock <= minStock;

                        if (!isUnderMinStock) {
                          return;
                        }

                        const isFast = rotationItem?.classification === "FAST";

                        criticalProducts.push({
                          id: alert.id,
                          internalSku: alert.internalSku,
                          name: alert.name,
                          currentStock,
                          minStock,
                          rotationSpeed: rotationItem?.rotationSpeed || 0,
                          classification: rotationItem?.classification || "UNKNOWN",
                          stockValue: rotationItem?.stockValue || 0,
                          priority: isFast ? "CRITICAL" : "ALERT"
                        });
                      });

                      const criticalCount = criticalProducts.filter(p => p.priority === "CRITICAL").length;
                      const alertCount = criticalProducts.filter(p => p.priority === "ALERT").length;

                      if (criticalProducts.length === 0) {
                        return (
                          <div className="text-center py-12">
                            <Package className="h-12 w-12 mx-auto text-green-500 mb-4" />
                            <p className="text-lg font-medium">No hay productos que requieran reposición urgente</p>
                            <p className="text-muted-foreground">Todos los productos tienen stock adecuado</p>
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {/* Tarjetas resumen */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                Críticos
                              </p>
                              <p className="text-2xl font-bold text-red-700">
                                {criticalCount}
                              </p>
                              <p className="text-xs text-red-500">
                                Bajo stock + alta rotación
                              </p>
                            </div>
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                                En Alerta
                              </p>
                              <p className="text-2xl font-bold text-yellow-700">
                                {alertCount}
                              </p>
                              <p className="text-xs text-yellow-500">
                                Solo bajo stock
                              </p>
                            </div>
                            <div className="brand-accent-panel p-3">
                              <p className="text-sm font-medium brand-accent-subtle">
                                Total
                              </p>
                              <p className="text-2xl font-bold text-foreground">
                                {criticalProducts.length}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Productos a reponer
                              </p>
                            </div>
                          </div>
                          
                          {/* Tabla de productos críticos */}
                          <div className="overflow-x-auto mt-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>SKU</TableHead>
                                  <TableHead>Producto</TableHead>
                                  <TableHead className="text-right">Stock</TableHead>
                                  <TableHead className="text-right">Mínimo</TableHead>
                                  <TableHead className="text-right">Rotación</TableHead>
                                  <TableHead>Clasificación</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                  <TableHead>Prioridad</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {criticalProducts
                                  .sort((a, b) => {
                                    if (a.priority === "CRITICAL" && b.priority !== "CRITICAL") return -1;
                                    if (b.priority === "CRITICAL" && a.priority !== "CRITICAL") return 1;
                                    return b.rotationSpeed - a.rotationSpeed;
                                  })
                                  .map((product) => (
                                    <TableRow key={product.id}>
                                      <TableCell className="font-medium">
                                        {product.internalSku}
                                      </TableCell>
                                      <TableCell>{product.name}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        {Number(product.currentStock).toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-right text-muted-foreground">
                                        {Number(product.minStock).toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {Number(product.rotationSpeed).toFixed(2)}x
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={`px-2 py-1 text-xs rounded-full ${
                                            product.classification === "FAST"
                                              ? "bg-green-100 text-green-700"
                                              : product.classification === "NORMAL"
                                              ? "border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-foreground"
                                              : "bg-yellow-100 text-yellow-700"
                                          }`}
                                        >
                                          {product.classification === "FAST"
                                            ? "Rápido"
                                            : product.classification === "NORMAL"
                                            ? "Normal"
                                            : "Lento"}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        ${Number(product.stockValue).toFixed(2)}
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            product.priority === "CRITICAL"
                                              ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                          }`}
                                        >
                                          {product.priority === "CRITICAL" ? "CRÍTICO" : "ALERTA"}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reporte 4: Devoluciones */}
          <TabsContent value="returns">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Devoluciones</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToPDF(
                        "/inventory-reports/returns/pdf",
                        "devoluciones"
                      )
                    }
                    disabled={!dateRange.startDate || !dateRange.endDate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {returnsLoading ? (
                  <LoadingSpinner text="Cargando devoluciones..." />
                ) : returnsReport?.items && returnsReport.items.length > 0 ? (
                  <div className="space-y-6">
                    {returnsReport.summary && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="brand-accent-panel p-3">
                            <p className="text-sm font-medium brand-accent-subtle">
                              Total Devoluciones
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {returnsReport.summary.total}
                            </p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-sm text-purple-600 font-medium">
                              Cantidad
                            </p>
                            <p className="text-2xl font-bold text-purple-700">
                              {Number(returnsReport.summary.totalQuantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Valor Total
                            </p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              ${Number(returnsReport.summary.totalReturnValue).toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                              Promedio
                            </p>
                            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                              ${Number(returnsReport.summary.averageReturnValue).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tendencia vs período anterior: {returnsReport.summary.returnsTrendDelta && returnsReport.summary.returnsTrendDelta > 0 ? "+" : ""}
                          {returnsReport.summary.returnsTrendDelta ?? 0} devoluciones ({returnsReport.summary.returnsTrendPercentChange && returnsReport.summary.returnsTrendPercentChange > 0 ? "+" : ""}
                          {Number(returnsReport.summary.returnsTrendPercentChange ?? 0).toFixed(1)}%)
                        </div>
                      </div>
                    )}

                    {/* Top 5 Productos más devueltos */}
                    {returnsReport.topReturnedProducts && returnsReport.topReturnedProducts.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-orange-600" />
                            Top 5 Productos Más Devueltos
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {returnsReport.topReturnedProducts.slice(0, 5).map((product, index) => (
                              <div
                                key={product.productId}
                                className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 font-bold text-sm">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium">{product.productName}</p>
                                    {product.reason && (
                                      <p className="text-sm text-muted-foreground">
                                        Motivo: {product.reason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-orange-700 dark:text-orange-300">
                                    {Number(product.totalQuantity).toFixed(2)} unidades
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    ${Number(product.totalValue).toFixed(2)} ({Number(product.percentage).toFixed(1)}%)
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnsReport.items.map((returnItem: ReturnItem) => (
                            <TableRow key={returnItem.id}>
                              <TableCell className="text-sm">
                                {format(new Date(returnItem.createdAt), "dd/MM/yyyy", { locale: es })}
                              </TableCell>
                              <TableCell>{returnItem.product.name}</TableCell>
                              <TableCell className="text-right">
                                {Number(returnItem.quantity).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${Number(returnItem.returnValue).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {returnItem.customer?.firstName}{" "}
                                {returnItem.customer?.lastName ||
                                  returnItem.customer?.companyName ||
                                  "Sin cliente"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {returnItem.reason || "Sin motivo registrado"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay devoluciones
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
