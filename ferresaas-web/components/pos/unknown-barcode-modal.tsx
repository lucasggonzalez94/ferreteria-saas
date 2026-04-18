"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityAutocomplete } from "@/components/shared/entity-autocomplete";
import { toast } from "sonner";
import {
  AlertTriangle,
  Barcode,
  PackagePlus,
  PackageSearch,
  X,
} from "lucide-react";
import type { Product } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Step =
  | "choose" // Paso 1: elegir acción
  | "create" // Paso 2a: crear nuevo producto
  | "assign" // Paso 2b: buscar producto existente
  | "confirm-replace"; // Paso 2b sub: confirmar reemplazo de barcode

interface UnknownBarcodeModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  onProductCreated: (product: Product) => void;
  onProductAssigned: (product: Product) => void;
}

// ─── Formulario de creación rápida (estado inicial) ──────────────────────────

const INITIAL_FORM = {
  name: "",
  cost: "",
  price: "",
  categoryId: "",
  unit: "u" as const,
  taxRate: "21",
  initialStock: "0",
};

// ─── Componente ──────────────────────────────────────────────────────────────

export function UnknownBarcodeModal({
  isOpen,
  barcode,
  onClose,
  onProductCreated,
  onProductAssigned,
}: UnknownBarcodeModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canCreate = user?.permissions?.includes("products:create") ?? false;
  const canUpdate = user?.permissions?.includes("products:update") ?? false;

  // ─── Estado interno ────────────────────────────────────────────────────────

  const [step, setStep] = useState<Step>("choose");
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  // Producto a confirmar reemplazo (tiene barcode existente)
  const [productToReplace, setProductToReplace] = useState<Product | null>(
    null,
  );

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get<any[]>("/categories");
      return res.data || [];
    },
    enabled: step === "create",
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        barcode,
        name: form.name.trim(),
        cost: parseFloat(form.cost),
        price: parseFloat(form.price),
        unit: form.unit,
        isFractional: form.unit !== "u",
        taxRate: parseFloat(form.taxRate),
        initialStock: parseFloat(form.initialStock) || 0,
        categoryId: form.categoryId || undefined,
        pricingMode: "fixed",
      };
      const res = await api.post<Product>("/products", payload);
      return res.data!;
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.removeQueries({ queryKey: ["products-search"] });
      toast.success(`Producto "${newProduct.name}" creado`);
      handleClose();
      onProductCreated(newProduct);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear el producto");
    },
  });

  const assignBarcodeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await api.put<Product>(`/products/${productId}`, { barcode });
      return res.data!;
    },
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.removeQueries({ queryKey: ["products-search"] });
      toast.success(`Código asignado a "${updatedProduct.name}"`);
      handleClose();
      onProductAssigned(updatedProduct);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al asignar el código de barras");
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep("choose");
    setForm({ ...INITIAL_FORM });
    setSelectedProduct(null);
    setProductToReplace(null);
    onClose();
  };

  const handleCreateSubmit = () => {
    if (!form.name.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }
    const cost = parseFloat(form.cost);
    const price = parseFloat(form.price);
    if (!form.cost || isNaN(cost) || cost <= 0) {
      toast.error("Ingresa un costo válido");
      return;
    }
    if (!form.price || isNaN(price) || price <= 0) {
      toast.error("Ingresa un precio de venta válido");
      return;
    }
    createMutation.mutate();
  };

  // Cuando el usuario selecciona un producto en el autocomplete
  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
    if (!product) return;

    // Si el producto ya tiene un barcode diferente: pedir confirmación
    if (product.barcode && product.barcode !== barcode) {
      setProductToReplace(product);
      setStep("confirm-replace");
    } else {
      // Sin barcode previo: asignar directamente
      assignBarcodeMutation.mutate(product.id);
    }
  };

  const handleConfirmReplace = () => {
    if (!productToReplace) return;
    assignBarcodeMutation.mutate(productToReplace.id);
  };

  // ─── Guard ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        {/* Header con código escaneado */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Barcode className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Código no encontrado
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Código escaneado:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {barcode}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Paso 1: elegir acción ──────────────────────────────────── */}
          {step === "choose" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ningún producto tiene asignado este código. ¿Qué deseas hacer?
              </p>

              {!canCreate && !canUpdate && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    No tienes permisos para crear ni modificar productos.
                    Contacta a un administrador.
                  </p>
                </div>
              )}

              <div className="grid gap-3">
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setStep("create")}
                    className="flex items-center gap-4 p-4 border-2 rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] transition-colors group-hover:bg-[hsl(var(--brand-accent-soft))]">
                      <PackagePlus className="h-5 w-5 brand-accent-text" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        Crear nuevo producto
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El código <span className="font-mono">{barcode}</span>{" "}
                        quedará asignado al producto nuevo.
                      </p>
                    </div>
                  </button>
                )}

                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => setStep("assign")}
                    className="flex items-center gap-4 p-4 border-2 rounded-lg text-left hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 flex items-center justify-center flex-shrink-0 transition-colors">
                      <PackageSearch className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        Asignar a producto existente
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Busca un producto y asígnale este código de barras.
                      </p>
                    </div>
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* ── Paso 2a: crear nuevo producto ──────────────────────────── */}
          {step === "create" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Volver
              </button>

              <div className="grid grid-cols-2 gap-3">
                {/* Nombre */}
                <div className="col-span-2">
                  <Label htmlFor="ub-name">Nombre *</Label>
                  <Input
                    id="ub-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Ej: Tornillo 6mm"
                    autoFocus
                  />
                </div>

                {/* Costo */}
                <div>
                  <Label htmlFor="ub-cost">Costo *</Label>
                  <Input
                    id="ub-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cost: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>

                {/* Precio de venta */}
                <div>
                  <Label htmlFor="ub-price">Precio de venta *</Label>
                  <Input
                    id="ub-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <Label htmlFor="ub-category">Categoría</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, categoryId: v }))
                    }
                  >
                    <SelectTrigger id="ub-category">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin categoría</SelectItem>
                      {categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Unidad */}
                <div>
                  <Label htmlFor="ub-unit">Unidad *</Label>
                  <Select
                    value={form.unit}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, unit: v as typeof form.unit }))
                    }
                  >
                    <SelectTrigger id="ub-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="u">Unidad (u)</SelectItem>
                      <SelectItem value="mt">Metro (mt)</SelectItem>
                      <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                      <SelectItem value="lt">Litro (lt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* IVA */}
                <div>
                  <Label htmlFor="ub-tax">IVA (%)</Label>
                  <Input
                    id="ub-tax"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxRate: e.target.value }))
                    }
                  />
                </div>

                {/* Stock inicial */}
                <div>
                  <Label htmlFor="ub-stock">Stock inicial</Label>
                  <Input
                    id="ub-stock"
                    type="number"
                    step={form.unit === "u" ? "1" : "0.01"}
                    min="0"
                    value={form.initialStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialStock: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Código que se asignará */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                Código de barras que se asignará:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {barcode}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep("choose")}
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateSubmit}
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Creando..."
                    : "Crear y agregar al carrito"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Paso 2b: asignar a existente ───────────────────────────── */}
          {step === "assign" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Volver
              </button>

              <p className="text-sm text-muted-foreground">
                Busca el producto al que quieres asignar el código{" "}
                <span className="font-mono font-semibold text-foreground">
                  {barcode}
                </span>
                .
              </p>

              <EntityAutocomplete<Product>
                value={selectedProduct}
                onChange={handleProductSelect}
                fetchFn={async (search) => {
                  const res = await api.get<any>(`/products?q=${search}`);
                  // La API devuelve paginado: { data: { items: [...] } }
                  return res.data?.items ?? res.data ?? [];
                }}
                displayFn={(p) => p.name}
                placeholder="Buscar por nombre o SKU..."
                renderItem={(p) => (
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {p.internalSku}
                      {p.barcode ? (
                        <span className="ml-2 text-amber-600">
                          · Código actual: {p.barcode}
                        </span>
                      ) : (
                        <span className="ml-2 text-green-600">
                          · Sin código
                        </span>
                      )}
                    </p>
                  </div>
                )}
              />

              {assignBarcodeMutation.isPending && (
                <p className="text-sm text-muted-foreground text-center">
                  Asignando código...
                </p>
              )}

              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
                disabled={assignBarcodeMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* ── Paso confirm-replace: confirmar reemplazo de barcode ────── */}
          {step === "confirm-replace" && productToReplace && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Este producto ya tiene un código asignado
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Al confirmar, el código actual será reemplazado.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 text-sm">
                <div className="font-medium text-foreground">
                  {productToReplace.name}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Código actual:</span>
                  <span className="font-mono font-semibold text-red-600 dark:text-red-400 line-through">
                    {productToReplace.barcode}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Nuevo código:</span>
                  <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                    {barcode}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    setProductToReplace(null);
                    setSelectedProduct(null);
                    setStep("assign");
                  }}
                  className="flex-1"
                  disabled={assignBarcodeMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmReplace}
                  className="flex-1"
                  disabled={assignBarcodeMutation.isPending}
                >
                  {assignBarcodeMutation.isPending
                    ? "Reemplazando..."
                    : "Confirmar reemplazo"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
