"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import { toast } from "sonner";
import { ActionsMenu } from "@/components/ui/actions-menu";

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState(""); // "" | "active" | "inactive"
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState("name-asc");

  const canViewProducts = user?.permissions?.includes("products:read");
  const canCreateProducts = user?.permissions?.includes("products:create");

  useEffect(() => {
    if (!canViewProducts) {
      router.push("/dashboard");
      return;
    }
  }, [canViewProducts, router]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "products",
      search,
      categoryId,
      status,
      lowStockOnly,
      priceMin,
      priceMax,
      sort,
    ],
    queryFn: async () => {
      const response = await api.get<Product[]>("/products", {
        params: {
          q: search || undefined,
          categoryId: categoryId || undefined,
          active:
            status === "active" ? true : status === "inactive" ? false : undefined,
          lowStock: lowStockOnly || undefined,
          priceMin: priceMin || undefined,
          priceMax: priceMax || undefined,
          sort: sort || undefined,
        },
      });
      return response.data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<any[]>("/categories");
      return response.data || [];
    },
  });

  const clearFilters = () => {
    setCategoryId("");
    setStatus("");
    setLowStockOnly(false);
    setPriceMin("");
    setPriceMax("");
    setSort("name-asc");
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo eliminar el producto");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.put(`/products/${id}`, { isActive });
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo actualizar el estado");
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
              <div>
                <Label className="text-sm text-muted-foreground">Categoría</Label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todas</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Estado</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  id="lowStock"
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="lowStock" className="text-sm text-muted-foreground">
                  Sólo bajo stock
                </Label>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Precio mín</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Precio máx</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Orden</Label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="name-asc">Nombre A-Z</option>
                  <option value="price-asc">Precio asc</option>
                  <option value="price-desc">Precio desc</option>
                  <option value="stock-asc">Stock asc</option>
                  <option value="stock-desc">Stock desc</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando productos..." />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {data.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer"
                onClick={() => router.push(`/dashboard/products/${product.id}`)}
              >
                <CardHeader className="relative pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{product.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        SKU: {product.internalSku}
                      </p>
                      {product.barcode && (
                        <p className="text-sm text-muted-foreground truncate">
                          Código: {product.barcode}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {product.isActive ? "Activo" : "Inactivo"}
                      </div>
                      <ActionsMenu
                        actions={[
                          {
                            label: "Editar",
                            onClick: () => router.push(`/dashboard/products/${product.id}`),
                          },
                          {
                            label: product.isActive ? "Marcar inactivo" : "Marcar activo",
                            onClick: () =>
                              toggleActiveMutation.mutate({
                                id: product.id,
                                isActive: !product.isActive,
                              }),
                            disabled: toggleActiveMutation.isPending,
                          },
                          {
                            label: "Eliminar",
                            onClick: () => {
                              const confirmDelete = window.confirm(
                                "¿Eliminar este producto? Esta acción no se puede deshacer."
                              );
                              if (confirmDelete) {
                                deleteMutation.mutate(product.id);
                              }
                            },
                            disabled: deleteMutation.isPending,
                            variant: "danger",
                          },
                        ]}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <div className="space-y-2 flex-1">
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
                  </div>
                  <div className="mt-auto" />
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
