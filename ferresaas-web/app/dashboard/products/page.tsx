"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, ArrowLeft, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const canViewProducts = user?.permissions?.includes("products:read");
  const canCreateProducts = user?.permissions?.includes("products:create");

  useEffect(() => {
    if (!canViewProducts) {
      router.push("/dashboard");
      return;
    }
  }, [canViewProducts, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      const response = await api.get<Product[]>(`/products?q=${search}`);
      return response.data || [];
    },
  });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Productos"
          description="Gestión de catálogo de productos"
          showButton={canCreateProducts}
          buttonLabel="Nuevo Producto"
          buttonIcon={<Plus className="h-4 w-4 mr-2" />}
          buttonAction={() => router.push("/dashboard/products/new")}
        />

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando productos..." />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        SKU: {product.internalSku}
                      </p>
                      {product.barcode && (
                        <p className="text-sm text-muted-foreground">
                          Código: {product.barcode}
                        </p>
                      )}
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        product.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {product.isActive ? "Activo" : "Inactivo"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Precio:</span>
                      <span className="font-semibold">
                        ${Number(product.price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo:</span>
                      <span>${Number(product.cost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock:</span>
                      <span
                        className={
                          product.minStock &&
                          product.stockQuantity <= product.minStock
                            ? "text-red-600 font-semibold"
                            : ""
                        }
                      >
                        {product.stockQuantity} {product.unit}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Link href={`/dashboard/products/${product.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          Ver Detalle
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search
                  ? "No se encontraron productos"
                  : "No hay productos registrados"}
              </p>
              <Link href="/dashboard/products/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Producto
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
