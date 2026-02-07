"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, FileText, TrendingDown } from "lucide-react";
import Header from "@/components/ui/header";
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

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const canViewReports = user?.permissions?.includes("reports:read");

  useEffect(() => {
    if (!canViewReports) {
      router.push("/dashboard");
      return;
    }
  }, [canViewReports, router]);

  // Reporte 1: Movimientos de Inventario
  const { data: movementsReport, isLoading: movementsLoading } = useQuery({
    queryKey: ["reports", "movements", dateRange],
    queryFn: async () => {
      const response = await api.get<any>("/inventory-reports/movements", {
        params: {
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
          limit: 100,
        },
      });
      return response.data || { items: [], totals: {} };
    },
  });

  // Reporte 2: Alertas de Stock
  const { data: alertsReport, isLoading: alertsLoading } = useQuery({
    queryKey: ["reports", "stock-alerts"],
    queryFn: async () => {
      const response = await api.get<any>("/inventory-reports/stock-alerts");
      return response.data || { items: [], summary: {} };
    },
  });

  // Reporte 3: Rotación de Inventario
  const { data: rotationReport, isLoading: rotationLoading } = useQuery({
    queryKey: ["reports", "rotation", dateRange],
    queryFn: async () => {
      const response = await api.get<any>("/inventory-reports/rotation", {
        params: {
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
          limit: 50,
        },
      });
      return response.data || { items: [], summary: {} };
    },
  });

  // Reporte 4: Devoluciones
  const { data: returnsReport, isLoading: returnsLoading } = useQuery({
    queryKey: ["reports", "returns", dateRange],
    queryFn: async () => {
      const response = await api.get<any>("/inventory-reports/returns", {
        params: {
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
          limit: 100,
        },
      });
      return response.data || { items: [], summary: {} };
    },
  });

  // Función para exportar a CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Función para exportar a JSON
  const exportToJSON = (data: any, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header title="Reportes de Inventario" />

        <Tabs defaultValue="movements" className="w-full">
          <TabsList>
            <TabsTrigger value="movements">Movimientos</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="rotation">Rotación</TabsTrigger>
            <TabsTrigger value="returns">Devoluciones</TabsTrigger>
          </TabsList>

          {/* Reporte 1: Movimientos */}
          <TabsContent value="movements">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Movimientos de Inventario</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToCSV(
                          movementsReport?.items || [],
                          "movimientos-inventario"
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToJSON(movementsReport, "movimientos-inventario")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <LoadingSpinner text="Cargando movimientos..." />
                ) : movementsReport?.items && movementsReport.items.length > 0 ? (
                  <div className="space-y-4">
                    {movementsReport.totals && (
                      <div className="grid grid-cols-4 gap-4">
                        {Object.entries(movementsReport.totals).map(
                          ([type, total]: [string, any]) => (
                            <div
                              key={type}
                              className="p-3 bg-blue-50 rounded-lg border border-blue-200"
                            >
                              <p className="text-sm text-blue-600 font-medium">
                                {type === "SALE"
                                  ? "Ventas"
                                  : type === "PURCHASE_RECEIPT"
                                  ? "Compras"
                                  : type === "RETURN"
                                  ? "Devoluciones"
                                  : "Ajustes"}
                              </p>
                              <p className="text-xl font-bold text-blue-900">
                                {total.toFixed(2)}
                              </p>
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
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movementsReport.items.map((movement: any) => (
                            <TableRow key={movement.id}>
                              <TableCell className="text-sm">
                                {new Date(movement.createdAt).toLocaleDateString(
                                  "es-AR"
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    movement.type === "SALE"
                                      ? "bg-red-100 text-red-700"
                                      : movement.type === "PURCHASE_RECEIPT"
                                      ? "bg-green-100 text-green-700"
                                      : movement.type === "RETURN"
                                      ? "bg-blue-100 text-blue-700"
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
                                {movement.quantity.toFixed(2)}
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
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Alertas de Stock</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToCSV(
                          alertsReport?.items || [],
                          "alertas-stock"
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToJSON(alertsReport, "alertas-stock")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <LoadingSpinner text="Cargando alertas..." />
                ) : alertsReport?.items && alertsReport.items.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 font-medium">
                          Críticas
                        </p>
                        <p className="text-2xl font-bold text-red-700">
                          {alertsReport.summary?.critical || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-600 font-medium">
                          Advertencias
                        </p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {alertsReport.summary?.warning || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-600 font-medium">
                          Total
                        </p>
                        <p className="text-2xl font-bold text-blue-700">
                          {alertsReport.summary?.total || 0}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {alertsReport.items.map((alert: any) => (
                        <div
                          key={alert.id}
                          className={`flex justify-between items-center p-4 rounded-lg border ${
                            alert.alertLevel === "CRITICAL"
                              ? "bg-red-50 border-red-200"
                              : "bg-yellow-50 border-yellow-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle
                              className={`h-5 w-5 ${
                                alert.alertLevel === "CRITICAL"
                                  ? "text-red-600"
                                  : "text-yellow-600"
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
                              {Number(alert.stockQuantity).toFixed(2)} {alert.unit}
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
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Rotación de Inventario</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToCSV(
                          rotationReport?.items || [],
                          "rotacion-inventario"
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToJSON(rotationReport, "rotacion-inventario")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rotationLoading ? (
                  <LoadingSpinner text="Cargando rotación..." />
                ) : rotationReport?.items && rotationReport.items.length > 0 ? (
                  <div className="space-y-4">
                    {rotationReport.summary && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-600 font-medium">
                            Rápidos
                          </p>
                          <p className="text-2xl font-bold text-green-700">
                            {rotationReport.summary.fast}
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-600 font-medium">
                            Normales
                          </p>
                          <p className="text-2xl font-bold text-blue-700">
                            {rotationReport.summary.normal}
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-sm text-yellow-600 font-medium">
                            Lentos
                          </p>
                          <p className="text-2xl font-bold text-yellow-700">
                            {rotationReport.summary.slow}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-sm text-purple-600 font-medium">
                            Valor Total
                          </p>
                          <p className="text-2xl font-bold text-purple-700">
                            ${rotationReport.summary.totalStockValue.toFixed(2)}
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
                          {rotationReport.items.map((product: any) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {product.internalSku}
                              </TableCell>
                              <TableCell>{product.name}</TableCell>
                              <TableCell className="text-right">
                                {product.currentStock.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {product.rotationSpeed.toFixed(2)}x
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    product.classification === "FAST"
                                      ? "bg-green-100 text-green-700"
                                      : product.classification === "NORMAL"
                                      ? "bg-blue-100 text-blue-700"
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
                                ${product.stockValue.toFixed(2)}
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

          {/* Reporte 4: Devoluciones */}
          <TabsContent value="returns">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Devoluciones</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToCSV(
                          returnsReport?.items || [],
                          "devoluciones"
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportToJSON(returnsReport, "devoluciones")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {returnsLoading ? (
                  <LoadingSpinner text="Cargando devoluciones..." />
                ) : returnsReport?.items && returnsReport.items.length > 0 ? (
                  <div className="space-y-4">
                    {returnsReport.summary && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-600 font-medium">
                            Total Devoluciones
                          </p>
                          <p className="text-2xl font-bold text-blue-700">
                            {returnsReport.summary.total}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-sm text-purple-600 font-medium">
                            Cantidad
                          </p>
                          <p className="text-2xl font-bold text-purple-700">
                            {returnsReport.summary.totalQuantity.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-600 font-medium">
                            Valor Total
                          </p>
                          <p className="text-2xl font-bold text-green-700">
                            ${returnsReport.summary.totalReturnValue.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <p className="text-sm text-orange-600 font-medium">
                            Promedio
                          </p>
                          <p className="text-2xl font-bold text-orange-700">
                            ${returnsReport.summary.averageReturnValue.toFixed(2)}
                          </p>
                        </div>
                      </div>
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnsReport.items.map((returnItem: any) => (
                            <TableRow key={returnItem.id}>
                              <TableCell className="text-sm">
                                {new Date(returnItem.createdAt).toLocaleDateString(
                                  "es-AR"
                                )}
                              </TableCell>
                              <TableCell>{returnItem.product.name}</TableCell>
                              <TableCell className="text-right">
                                {returnItem.quantity.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${returnItem.returnValue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {returnItem.customer?.firstName}{" "}
                                {returnItem.customer?.lastName ||
                                  returnItem.customer?.companyName ||
                                  "Sin cliente"}
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
