"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const canViewInventory = user?.permissions?.includes("inventory:read");

  useEffect(() => {
    if (!canViewInventory) {
      router.push("/dashboard");
      return;
    }
  }, [canViewInventory, router]);
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: async () => {
      const response = await api.get<any[]>("/inventory/low-stock");
      return response.data || [];
    },
  });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Inventario"
        />

        {/* Low Stock Alert */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Productos con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner text="Cargando..." />
            ) : lowStock && lowStock.length > 0 ? (
              <div className="space-y-2">
                {lowStock.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {product.internalSku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-yellow-700">
                        Stock: {product.stockQuantity} {product.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {product.minStock} {product.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No hay productos con stock bajo
              </p>
            )}
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800 font-medium">
            Módulo de Inventario Completo en Desarrollo
          </p>
          <p className="text-blue-700 text-sm mt-2 mb-4">
            Funcionalidades de movimientos y ajustes estarán disponibles
            próximamente.
          </p>
          <Link href="/dashboard/products">
            <Button
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Ir a Gestión de Productos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
