"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { parseNumericInput } from "@/lib/numeric-input";

interface QuickCreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (productId: string) => void;
}

export function QuickCreateProductModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickCreateProductModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    description: "",
    categoryId: "",
    unit: "u",
    cost: "",
    price: "",
    taxRate: "21",
    marginPercent: "",
    minStock: "",
  });

  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<any[]>("/categories");
      return response.data || [];
    },
    enabled: open,
  });

  const { data: existingProducts } = useQuery({
    queryKey: ["products-list"],
    enabled: open,
  });

  useEffect(() => {
    if (formData.name && existingProducts) {
      const nameLower = formData.name.toLowerCase().trim();
      const duplicate = (existingProducts as any[]).find(
        (p: any) => p.name.toLowerCase().trim() === nameLower
      );
      if (duplicate) {
        setDuplicateWarning(`Ya existe un producto con el nombre "${duplicate.name}"`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.name, existingProducts]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/products", {
        name: formData.name,
        barcode: formData.barcode || undefined,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        isFractional: formData.unit !== "u",
        cost: parseFloat(formData.cost),
        price: parseFloat(formData.price),
        taxRate: parseFloat(formData.taxRate),
        marginPercent: formData.marginPercent ? parseFloat(formData.marginPercent) : undefined,
        minStock: formData.minStock ? parseFloat(formData.minStock) : undefined,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast.success("Producto creado exitosamente");
      resetForm();
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(data.id);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear producto");
    },
  });

  const calculatePrice = async () => {
    if (!formData.cost || !formData.taxRate || !formData.marginPercent) {
      toast.error("Completa costo, IVA y margen para calcular");
      return;
    }

    try {
      const response = await api.post<any>("/products/calculate-price", {
        cost: parseFloat(formData.cost),
        taxRate: parseFloat(formData.taxRate),
        marginPercent: parseFloat(formData.marginPercent),
      });

      const calculated = response.data.suggestedPrice;
      setSuggestedPrice(calculated);
      toast.success(`Precio sugerido: $${calculated.toFixed(2)}`);
    } catch (error: any) {
      toast.error(error.message || "Error al calcular precio");
    }
  };

  const applySuggestedPrice = () => {
    if (suggestedPrice !== null) {
      setFormData({ ...formData, price: suggestedPrice.toFixed(2) });
      toast.success("Precio sugerido aplicado");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      barcode: "",
      description: "",
      categoryId: "",
      unit: "u",
      cost: "",
      price: "",
      taxRate: "21",
      marginPercent: "",
      minStock: "",
    });
    setSuggestedPrice(null);
    setDuplicateWarning(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.cost || !formData.price) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    createMutation.mutate();
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Producto</DialogTitle>
          <DialogDescription>
            Completa los datos del nuevo producto. Los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tornillo 1/4"
              required
            />
            {duplicateWarning && (
              <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barcode">Código de Barras</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="7798123456789"
              />
            </div>

            <div>
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sin categoría</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Descripción del producto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">Unidad *</Label>
              <select
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="u">Unidad (u)</option>
                <option value="mt">Metro (mt)</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="lt">Litro (lt)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="minStock">Stock Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost">Costo *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="price">Precio de Venta *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="taxRate">IVA (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                placeholder="21"
              />
            </div>

            <div>
              <Label htmlFor="marginPercent">Margen (%)</Label>
              <Input
                id="marginPercent"
                type="number"
                step="0.01"
                value={formData.marginPercent}
                onChange={(e) => setFormData({ ...formData, marginPercent: e.target.value })}
                placeholder="Ej: 30"
              />
            </div>
          </div>

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Precio Sugerido</Label>
                <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm items-center">
                  {suggestedPrice !== null ? `$${suggestedPrice.toFixed(2)}` : "Calcular primero"}
                </div>
              </div>
              <Button
                type="button"
                onClick={calculatePrice}
                variant="outline"
                size="sm"
                disabled={!formData.cost || !formData.taxRate || !formData.marginPercent}
              >
                Calcular
              </Button>
              <Button
                type="button"
                onClick={applySuggestedPrice}
                variant="secondary"
                size="sm"
                disabled={suggestedPrice === null}
              >
                Aplicar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fórmula: Precio = Costo × (1 + Margen%) × (1 + IVA%)
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
