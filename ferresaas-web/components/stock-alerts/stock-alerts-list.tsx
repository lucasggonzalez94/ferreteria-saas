"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";

interface StockAlert {
  id: string;
  name: string;
  internalSku: string;
  unit: string;
  stockQuantity: number;
  minStock?: number | null;
}

interface AlertsResponse {
  items: StockAlert[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface StockAlertsListProps {
  showExportButton?: boolean;
  exportPdfEndpoint?: string;
  exportPdfFilename?: string;
}

export function StockAlertsList({
  showExportButton = false,
  exportPdfEndpoint = "/inventory-reports/stock-alerts/pdf",
  exportPdfFilename = "alertas-stock",
}: StockAlertsListProps) {
  const [page, setPage] = useState(1);

  const { data: lowStockTotal } = useQuery({
    queryKey: ["products", "lowStockCount"],
    queryFn: async () => {
      try {
        const response = await api.get("/products", {
          params: { page: 1, limit: 1, lowStock: true },
        });
        return (response as any).meta?.total || 0;
      } catch {
        return 0;
      }
    },
  });

  const { data: alertsData, isLoading } = useQuery<AlertsResponse>({
    queryKey: ["products", "lowStock", page],
    queryFn: async () => {
      try {
        const response = await api.get("/products", {
          params: { page, limit: 20, lowStock: true },
        });

        const data = (response as any).data || [];
        const meta = (response as any).meta || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        };

        return { items: data, meta };
      } catch (error) {
        console.error("Error cargando bajo stock:", error);
        return {
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        };
      }
    },
  });

  const exportToPDF = async () => {
    try {
      const blob = await api.getBlob(exportPdfEndpoint);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportPdfFilename}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      toast.error("Error al generar el PDF. Por favor, intenta nuevamente.");
    }
  };

  const criticalCount = alertsData?.items.filter(
    (item) => item.stockQuantity === 0
  ).length || 0;
  const warningCount =
    (alertsData?.meta.total || 0) - criticalCount;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Alertas de Stock
          </CardTitle>
          {showExportButton && (
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner text="Cargando alertas..." />
        ) : alertsData?.items && alertsData.items.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Críticas
                </p>
                <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  Advertencias
                </p>
                <p className="text-2xl font-bold text-yellow-700">
                  {warningCount}
                </p>
              </div>
              <div className="brand-accent-panel p-3">
                <p className="text-sm font-medium brand-accent-subtle">Bajo Stock</p>
                <p className="text-2xl font-bold text-foreground">
                  {lowStockTotal ?? 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {alertsData.items.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex justify-between items-center p-4 rounded-lg border ${
                    alert.stockQuantity === 0
                      ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        alert.stockQuantity === 0
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
                      {Number(alert.stockQuantity).toFixed(2)} {alert.unit}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {alert.stockQuantity === 0
                        ? "Sin stock"
                        : alert.minStock
                          ? `Por debajo del mínimo (${alert.minStock})`
                          : "Bajo stock"}
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
                  setPage={setPage}
                  currentPage={alertsData.meta.page}
                  totalPages={alertsData.meta.totalPages}
                  startIndex={(alertsData.meta.page - 1) * alertsData.meta.limit + 1}
                  endIndex={Math.min(
                    alertsData.meta.page * alertsData.meta.limit,
                    alertsData.meta.total
                  )}
                  total={alertsData.meta.total}
                  limit={alertsData.meta.limit}
                  onLimitChange={() => {}}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No hay alertas de stock
          </p>
        )}
      </CardContent>
    </Card>
  );
}