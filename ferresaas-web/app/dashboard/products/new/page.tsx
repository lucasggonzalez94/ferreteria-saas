"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import Header from "@/components/ui/header";
import { Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    initialStock: "",
    pricingMode: "margin",
    targetMargin: "",
    priceLocked: false,
    roundingStep: "10",
    costMethod: "avg_weighted",
  });

  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    description: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    targetMargin?: string;
    targetMarkup?: string;
    marginPercent?: string;
  }>({});

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

  // Validar targetMargin en tiempo real
  const validateTargetMargin = (value: string, mode: string) => {
    const errors = { ...validationErrors };
    
    if (mode === "margin") {
      if (!value) {
        errors.targetMargin = "El Margen Objetivo es requerido";
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.targetMargin = "Ingresa un número válido";
        } else if (numValue <= 0) {
          errors.targetMargin = "El margen debe ser mayor a 0% (ej: 37.5)";
        } else if (numValue >= 100) {
          errors.targetMargin = "El margen debe ser menor a 100%. Máximo 99.9%";
        } else {
          delete errors.targetMargin;
        }
      }
    } else {
      delete errors.targetMargin;
    }
    
    setValidationErrors(errors);
  };

  // Validar targetMarkup en tiempo real
  const validateTargetMarkup = (value: string, mode: string) => {
    const errors = { ...validationErrors };
    
    if (mode === "markup") {
      if (!value) {
        errors.targetMarkup = "El Markup Objetivo es requerido";
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.targetMarkup = "Ingresa un número válido";
        } else if (numValue <= 0) {
          errors.targetMarkup = "El markup debe ser mayor a 0% (ej: 60)";
        } else {
          delete errors.targetMarkup;
        }
      }
    } else {
      delete errors.targetMarkup;
    }
    
    setValidationErrors(errors);
  };

  // Validar margen actual (marginPercent) en tiempo real
  const validateMarginPercent = (value: string) => {
    const errors = { ...validationErrors };
    
    if (value) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.marginPercent = "Ingresa un número válido";
      } else if (numValue < 0 || numValue >= 100) {
        errors.marginPercent = "El margen debe ser menor a 100%. Máximo 99.9%";
      } else {
        delete errors.marginPercent;
      }
    } else {
      delete errors.marginPercent;
    }
    
    setValidationErrors(errors);
  };

  // Manejar cambio de marginPercent
  const handleMarginPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, marginPercent: value });
    validateMarginPercent(value);
  };

  // Manejar cambio de targetMargin
  const handleTargetMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, targetMargin: value });
    validateTargetMargin(value, formData.pricingMode);
  };

  // Manejar cambio de targetMarkup (mismo campo, diferente validación)
  const handleTargetMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, targetMargin: value });
    validateTargetMarkup(value, formData.pricingMode);
  };

  // Calcular margen equivalente a partir de markup
  const calculateEquivalentMargin = (markup: number): number => {
    if (markup <= 0) return 0;
    return (markup / (1 + markup)) * 100;
  };

  // Calcular markup equivalente a partir de margen
  const calculateEquivalentMarkup = (margin: number): number => {
    if (margin <= 0 || margin >= 100) return 0;
    return (margin / (100 - margin)) * 100;
  };

  // Manejar cambio de pricingMode
  const handlePricingModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value;
    setFormData({ ...formData, pricingMode: mode });
    // Validar el campo objetivo según el nuevo modo
    if (mode === "margin") {
      validateTargetMargin(formData.targetMargin, mode);
    } else if (mode === "markup") {
      validateTargetMarkup(formData.targetMargin, mode);
    } else {
      setValidationErrors({});
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Si hay errores de validación, no permitir envío
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Por favor corrige los errores en el formulario");
      return;
    }

    // Validación final para modos que requieren valor objetivo
    if (formData.pricingMode === "margin" && !formData.targetMargin) {
      toast.error("Debes configurar un Margen Objetivo para el modo 'Mantener Margen'");
      return;
    }

    if (formData.pricingMode === "markup" && !formData.targetMargin) {
      toast.error("Debes configurar un Markup Objetivo para el modo 'Mantener Markup'");
      return;
    }

    const payload = {
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
      initialStock: formData.initialStock ? parseFloat(formData.initialStock) : undefined,
      pricingMode: formData.pricingMode,
      targetMargin: formData.targetMargin ? parseFloat(formData.targetMargin) : undefined,
      priceLocked: formData.priceLocked,
      roundingStep: parseInt(formData.roundingStep),
      costMethod: formData.costMethod,
    };
    
    console.log("📤 Enviando producto al backend:", payload);
    createMutation.mutate(payload);
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
                    <div className="flex-1">
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, categoryId: value })
                        }
                      >
                        <SelectTrigger id="categoryId">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-10"
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
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                  >
                    <SelectTrigger id="unit" className="mt-1">
                      <SelectValue placeholder="Selecciona unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="u">Unidad (u)</SelectItem>
                      <SelectItem value="mt">Metro (mt)</SelectItem>
                      <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                      <SelectItem value="lt">Litro (lt)</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="initialStock">Stock Inicial</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    step={formData.unit === "u" ? "1" : "0.01"}
                    min="0"
                    value={formData.initialStock}
                    onChange={(e) =>
                      setFormData({ ...formData, initialStock: e.target.value })
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cantidad de unidades existentes al crear el producto
                  </p>
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

                <div className="col-span-2">
                  <Label htmlFor="marginPercent">Margen (%)</Label>
                  <Input
                    id="marginPercent"
                    type="number"
                    step="0.01"
                    value={formData.marginPercent}
                    onChange={handleMarginPercentChange}
                    placeholder="Ej: 30"
                    className={`w-full ${validationErrors.marginPercent ? "border-red-500" : ""}`}
                  />
                  {validationErrors.marginPercent && (
                    <p className="text-sm text-red-500 mt-1">
                      {validationErrors.marginPercent}
                    </p>
                  )}
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
                  <h3 className="text-sm font-semibold mb-3 mt-4">Configuración de Pricing Automático</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pricingMode">Modo de Pricing</Label>
                      <Select
                        value={formData.pricingMode}
                        onValueChange={(value: any) => {
                          setFormData({ ...formData, pricingMode: value });
                          handlePricingModeChange({ target: { value } } as any);
                        }}
                      >
                        <SelectTrigger id="pricingMode" className="mt-1">
                          <SelectValue placeholder="Selecciona modo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Precio Fijo</SelectItem>
                          <SelectItem value="margin">Mantener Margen</SelectItem>
                          <SelectItem value="markup">Mantener Markup</SelectItem>
                          <SelectItem value="suggest">Solo Sugerir</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define cómo se recalcula el precio al cambiar el costo
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="targetMargin">
                        {formData.pricingMode === "markup" ? "Markup Objetivo (%)" : "Margen Objetivo (%)"}
                      </Label>
                      <Input
                        id="targetMargin"
                        type="number"
                        step="0.01"
                        value={formData.targetMargin}
                        onChange={formData.pricingMode === "markup" ? handleTargetMarkupChange : handleTargetMarginChange}
                        placeholder={formData.pricingMode === "markup" ? "Ej: 60" : "Ej: 37.5"}
                        className={validationErrors.targetMargin || validationErrors.targetMarkup ? "border-red-500" : ""}
                        disabled={formData.pricingMode === "fixed"}
                      />
                      {(validationErrors.targetMargin || validationErrors.targetMarkup) && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors.targetMargin || validationErrors.targetMarkup}
                        </p>
                      )}
                      {formData.targetMargin && !validationErrors.targetMargin && !validationErrors.targetMarkup && (
                        <p className="brand-accent-panel mt-2 p-2 text-xs brand-accent-subtle">
                          {formData.pricingMode === "markup" 
                            ? `📊 Equivalente: Margen ${calculateEquivalentMargin(parseFloat(formData.targetMargin)).toFixed(2)}%`
                            : `📊 Equivalente: Markup ${calculateEquivalentMarkup(parseFloat(formData.targetMargin)).toFixed(2)}%`
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="roundingStep">Redondeo de Precio</Label>
                      <Select
                        value={formData.roundingStep}
                        onValueChange={(value) =>
                          setFormData({ ...formData, roundingStep: value })
                        }
                      >
                        <SelectTrigger id="roundingStep" className="mt-1">
                          <SelectValue placeholder="Selecciona redondeo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Sin redondeo</SelectItem>
                          <SelectItem value="10">Múltiplo de 10</SelectItem>
                          <SelectItem value="50">Múltiplo de 50</SelectItem>
                          <SelectItem value="100">Múltiplo de 100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="costMethod">Método de Costo</Label>
                      <Select
                        value={formData.costMethod}
                        onValueChange={(value) =>
                          setFormData({ ...formData, costMethod: value })
                        }
                      >
                        <SelectTrigger id="costMethod" className="mt-1">
                          <SelectValue placeholder="Selecciona método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="avg_weighted">Costo Promedio Ponderado</SelectItem>
                          <SelectItem value="last_cost">Último Costo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id="priceLocked"
                        checked={formData.priceLocked}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, priceLocked: Boolean(checked) })
                        }
                      />
                      <Label htmlFor="priceLocked" className="text-sm">
                        Precio congelado (no permitir cambios automáticos)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>Imagen del Producto</Label>
                  {imagePreview ? (
                    <div className="w-full max-w-xs flex justify-start gap-2 items-start">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={192}
                        height={192}
                        unoptimized
                        className="w-48 h-48 object-cover rounded-md border border-input"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label="Eliminar imagen seleccionada"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full border-2 border-dashed border-input rounded-md p-6 text-center cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Seleccionar imagen del producto"
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Haz clic para seleccionar una imagen</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF hasta 5MB</p>
                    </button>
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
            <DialogDescription>
              Crea una categoría para asignarla al producto que estás cargando.
            </DialogDescription>
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
