"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import { toast } from "sonner";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { Pagination } from "@/components/ui/pagination";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { useConfirmDialog } from "@/lib/hooks/useConfirmDialog";
import { CatalogImportDialog } from "@/components/products/catalog-import-dialog";
import { Upload } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/v1", "") || "http://localhost:3001";

interface ProductListItem {
  id: string;
  name: string;
  internalSku: string;
  barcode?: string | null;
  price: number;
  cost: number;
  stockQuantity: number;
  unit?: string;
  minStock?: number | null;
  isActive: boolean;
  imageUrl?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
}

interface ProductsResponse {
  data: ProductListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState(""); // "" | "active" | "inactive"
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const deleteDialog = useConfirmDialog<{ id: string; name: string }>();

  usePermissionGuard("products:read");
  const {
    canRead: canViewProducts,
    canCreate: canCreateProducts,
  } = usePermissions({
    canRead: "products:read",
    canCreate: "products:create",
  });

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: [
      "products",
      page,
      limit,
      search,
      categoryId,
      status,
      lowStockOnly,
      priceMin,
      priceMax,
      sort,
    ],
    queryFn: async () => {
      const response = await api.get<ProductListItem[]>("/products", {
        params: {
          page,
          limit,
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
      return {
        data: response.data || [],
        meta: (response as any).meta || {
          page: 1,
          limit,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    },
    enabled: canViewProducts,
  });

  const { data: lowStockTotal } = useQuery({
    queryKey: ["products", "lowStockCount"],
    queryFn: async () => {
      const response = await api.get<ProductListItem[]>("/products", {
        params: {
          page: 1,
          limit: 1,
          lowStock: true,
        },
      });
      return (response as any).meta?.total || 0;
    },
    enabled: canViewProducts,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<any[]>("/categories");
      return response.data || [];
    },
    enabled: canViewProducts,
  });

  const clearFilters = () => {
    setCategoryId("");
    setStatus("");
    setLowStockOnly(false);
    setPriceMin("");
    setPriceMax("");
    setSort("name-asc");
    setPage(1);
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

  const products = useMemo(() => data?.data || [], [data?.data]);
  const meta = data?.meta || { page: 1, limit: limit, total: 0, totalPages: 1, hasMore: false };

  const totals = useMemo(() => {
    const startIndex = products.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
    const endIndex = products.length === 0 ? 0 : startIndex + products.length - 1;
    const activeProducts = products.filter((p) => p.isActive).length;

    return {
      totalFiltered: meta.total,
      pageCount: products.length,
      startIndex,
      endIndex,
      activeProducts,
      lowStockProducts: lowStockTotal || 0,
    };
  }, [products, meta.page, meta.limit, meta.total, lowStockTotal]);

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  };

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Productos"
          description="Catálogo operativo con filtros rápidos, lectura clara y acceso directo a edición y stock crítico."
          showButton={canCreateProducts}
          buttonLabel="Nuevo Producto"
          buttonIcon={<Plus className="h-4 w-4 mr-2" />}
          buttonAction={() => router.push("/dashboard/products/new")}
          buttonClassName="h-10 px-4"
          actions={
            canCreateProducts ? (
              <div className="flex items-center gap-2">
                <CatalogImportDialog
                  triggerClassName="h-10 px-4"
                  triggerIcon={<Upload className="h-4 w-4 mr-2" />}
                  onImported={handleImportComplete}
                />
              </div>
            ) : undefined
          }
        />

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Resultados totales (filtro)</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{meta.total}</p>
            <p className="mt-2 text-sm text-muted-foreground">Productos en la base de datos.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Bajo stock</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{totals.lowStockProducts}</p>
            <p className="mt-2 text-sm brand-accent-subtle">Productos que conviene revisar o reponer primero.</p>
          </div>
        </div>

        <Card className="mb-6 overflow-hidden">
          <CardContent>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, SKU o código de barras..."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
              <div>
                <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1); }}>
                  <SelectTrigger label="Categoría">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
                  <SelectTrigger label="Estado">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  id="lowStock"
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }}
                  className="h-4 w-4"
                />
                <label htmlFor="lowStock" className="text-sm text-muted-foreground">
                  Sólo bajo stock
                </label>
              </div>

              <div>
                <Input
                  label="Precio mín"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMin}
                  onChange={(e) => { setPriceMin(e.target.value); setPage(1); }}
                />
              </div>

              <div>
                <Input
                  label="Precio máx"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceMax}
                  onChange={(e) => { setPriceMax(e.target.value); setPage(1); }}
                />
              </div>

              <div>
                <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
                  <SelectTrigger label="Orden">
                    <SelectValue placeholder="Nombre A-Z" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Nombre A-Z</SelectItem>
                    <SelectItem value="price-asc">Precio asc</SelectItem>
                    <SelectItem value="price-desc">Precio desc</SelectItem>
                    <SelectItem value="stock-asc">Stock asc</SelectItem>
                    <SelectItem value="stock-desc">Stock desc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

<div className="mt-3 flex flex-wrap items-center justify-end gap-2">
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
        ) : products.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border p-3 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/products/${product.id}/view`)}
                  >
                    {product.imageUrl && (
                      <Image
                        src={product.imageUrl.startsWith('http') ? product.imageUrl : `${API_BASE}${product.imageUrl}`}
                        alt={product.name}
                        width={48}
                        height={48}
                        unoptimized
                        className="w-12 h-12 object-cover rounded-lg border flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{product.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            product.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {product.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        SKU: {product.internalSku}
                        {product.barcode && ` | Código: ${product.barcode}`}
                        {product.category && ` | ${product.category.name}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground">Precio</p>
                        <p className="font-semibold">${Number(product.price).toFixed(2)}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground">Costo</p>
                        <p className="text-sm">${Number(product.cost).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Stock</p>
                        <p className={`text-sm font-medium ${
                          product.minStock &&
                          product.stockQuantity <= product.minStock
                            ? "brand-accent-text"
                            : ""
                        }`}>
                          {product.stockQuantity} {product.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {product.stockQuantity === 0 ? (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            Sin stock
                          </span>
                        ) : product.minStock && product.stockQuantity < product.minStock ? (
                          <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            Bajo
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            OK
                          </span>
                        )}
                      </div>
                      <ActionsMenu
                        actions={[
                          {
                            label: "Ver detalle",
                            onClick: () => router.push(`/dashboard/products/${product.id}/view`),
                          },
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
                              deleteDialog.open({ id: product.id, name: product.name });
                            },
                            disabled: deleteMutation.isPending,
                            variant: "danger",
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search ||
                categoryId ||
                status ||
                lowStockOnly ||
                priceMin ||
                priceMax
                  ? "No se encontraron productos"
                  : "No hay productos registrados"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <Pagination
            setPage={setPage}
            currentPage={meta.page}
            totalPages={Math.max(meta.totalPages || 1, 1)}
            hasMore={meta.hasMore}
            startIndex={totals.startIndex}
            endIndex={totals.endIndex}
            total={meta.total}
            limit={limit}
            onLimitChange={setLimit}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && deleteDialog.close()}
        onConfirm={() => {
          if (deleteDialog.data) {
            deleteMutation.mutate(deleteDialog.data.id);
            deleteDialog.close();
          }
        }}
        title="Eliminar Producto"
        description={`¿Eliminar "${deleteDialog.data?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
