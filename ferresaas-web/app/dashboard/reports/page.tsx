"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Package } from "lucide-react";

export default function ReportsPage() {
  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const response = await api.get<any>("/sales");
      return response.data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get<any[]>("/products");
      return response.data || [];
    },
  });

  const totalSales =
    sales?.reduce((sum: number, sale: any) => sum + sale.total, 0) || 0;
  const totalProducts = products?.length || 0;
  const lowStockProducts =
    products?.filter((p: any) => p.minStock && p.stockQuantity <= p.minStock)
      .length || 0;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Reportes</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ventas Totales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Histórico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cantidad de Ventas
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sales?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Registradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">En catálogo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockProducts}</div>
              <p className="text-xs text-muted-foreground">Productos</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {sales && sales.length > 0 ? (
              <div className="space-y-3">
                {sales.slice(0, 10).map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        Venta #{sale.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${sale.total.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {sale._count?.items || 0} productos
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No hay ventas registradas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
