"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Printer } from "lucide-react";
import Link from "next/link";

export default function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPrinting, setIsPrinting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    description: "",
    categoryId: "",
    unit: "u",
    cost: "",
    price: "",
    taxRate: "21",
    minStock: "",
  });

  // Obtener categorías
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<any[]>("/categories");
      return response.data || [];
    },
  });

  const handlePrintLabel = async () => {
    try {
      setIsPrinting(true);
      const blob = await api.getBlob(`/products/${params.id}/barcode`);
      const fileUrl = URL.createObjectURL(blob);
      const newWindow = window.open(fileUrl);

      if (!newWindow) {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = `${product?.name || "producto"}-etiqueta.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(fileUrl), 5000);
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar la etiqueta");
    } finally {
      setIsPrinting(false);
    }
  };

  // Obtener producto
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", params.id],
    queryFn: async () => {
      const response = await api.get<any>(`/products/${params.id}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        barcode: product.barcode || "",
        description: product.description || "",
        categoryId: product.categoryId || "",
        unit: product.unit,
        cost: product.cost.toString(),
        price: product.price.toString(),
        taxRate: product.taxRate.toString(),
        minStock: product.minStock ? product.minStock.toString() : "",
      });
    }
  }, [product]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/products/${params.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
      toast.success("Producto actualizado exitosamente");
      router.push("/dashboard/products");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar producto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/products/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto eliminado exitosamente");
      router.push("/dashboard/products");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar producto");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMutation.mutate({
      name: formData.name,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined,
      categoryId: formData.categoryId || undefined,
      unit: formData.unit,
      isFractional: formData.unit !== "u",
      cost: parseFloat(formData.cost),
      price: parseFloat(formData.price),
      taxRate: parseFloat(formData.taxRate),
      minStock: formData.minStock ? parseFloat(formData.minStock) : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <Link href="/dashboard/products">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Editar Producto</h1>
            <p className="text-muted-foreground">
              Modificar datos del producto
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              title="Imprimir Etiqueta"
              onClick={handlePrintLabel}
              disabled={isPrinting}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              title="Eliminar Producto"
              onClick={() => {
                if (
                  window.confirm(
                    "¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.",
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="categoryId">Categoría</Label>
                  <select
                    id="categoryId"
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
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

                <div className="col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unidad *</Label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="cost">Costo *</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="taxRate">IVA (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, taxRate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending
                    ? "Guardando..."
                    : "Guardar Cambios"}
                </Button>
                <Link href="/dashboard/products" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
