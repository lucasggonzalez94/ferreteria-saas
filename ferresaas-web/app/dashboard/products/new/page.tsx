"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import Header from "@/components/ui/header";
import { Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CategoryFormState {
  name: string;
  description: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreateProducts = user?.permissions?.includes("products:create");

  useEffect(() => {
    if (!canCreateProducts) {
      router.push("/dashboard/products");
      return;
    }
  }, [canCreateProducts, router]);
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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    description: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const resetCategoryForm = () => {
    setCategoryForm({ name: "", description: "" });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Ingresa un nombre para la categoría");
      return;
    }
    createCategoryMutation.mutate(categoryForm);
  };

  // Obtener categorías
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get<any[]>("/categories");
      return response.data || [];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: CategoryFormState) => {
      const response = await api.post("/categories", {
        name: payload.name,
        description: payload.description || undefined,
      });
      return response.data;
    },
    onSuccess: (newCategory: any) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
      toast.success("Categoría creada");
      resetCategoryForm();
      setCategoryModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear categoría");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/products", data);
      return response.data;
    },
    onSuccess: (newProduct: any) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (selectedImage) {
        uploadImageMutation.mutate({ productId: newProduct.id, file: selectedImage });
      } else {
        toast.success("Producto creado exitosamente");
        router.push("/dashboard/products");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear producto");
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      await api.upload(`/products/image/${productId}`, formData);
    },
    onSuccess: () => {
      toast.success("Producto creado y imagen subida exitosamente");
      router.push("/dashboard/products");
    },
    onError: (error: any) => {
      toast.warning("Producto creado pero la imagen no se pudo subir");
      router.push("/dashboard/products");
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate({
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
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <Header
          title="Nuevo Producto"
          description="Crear un nuevo producto en el catálogo"
          link="/dashboard/products"
          linkLabel="Volver"
        />

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
                  <div className="flex gap-2 items-center">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setCategoryModalOpen(true)}
                    >
                      Nueva
                    </Button>
                  </div>
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

                <div>
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

                <div>
                  <Label htmlFor="marginPercent">Margen (%)</Label>
                  <Input
                    id="marginPercent"
                    type="number"
                    step="0.01"
                    value={formData.marginPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, marginPercent: e.target.value })
                    }
                    placeholder="Ej: 30"
                  />
                </div>

                <div className="col-span-2">
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
                      disabled={!formData.cost || !formData.taxRate || !formData.marginPercent}
                    >
                      Calcular
                    </Button>
                    <Button
                      type="button"
                      onClick={applySuggestedPrice}
                      variant="secondary"
                      disabled={suggestedPrice === null}
                    >
                      Aplicar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fórmula: Precio = Costo × (1 + Margen%) × (1 + IVA%)
                  </p>
                </div>

                <div className="col-span-2">
                  <Label>Imagen del Producto</Label>
                  {imagePreview ? (
                    <div className="w-full max-w-xs flex justify-start gap-2 items-start">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-48 h-48 object-cover rounded-md border border-input"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="w-full border-2 border-dashed border-input rounded-md p-6 text-center cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Haz clic para seleccionar una imagen</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF hasta 5MB</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending ? "Creando..." : "Crear Producto"}
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

      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nombre *</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ej: Ferretería"
                required
              />
            </div>
            <div>
              <Label htmlFor="category-description">Descripción</Label>
              <textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCategoryForm();
                  setCategoryModalOpen(false);
                }}
                disabled={createCategoryMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending ? "Creando..." : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
