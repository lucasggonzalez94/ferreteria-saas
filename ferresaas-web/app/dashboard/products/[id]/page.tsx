"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Printer, Upload, X } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { parseNumericInput } from "@/lib/numeric-input";
import { Tooltip } from "@/components/ui/tooltip";

export default function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    marginPercent: "",
    minStock: "",
    isActive: true,
    pricingMode: "margin",
    targetMargin: "",
    priceLocked: false,
    roundingStep: "10",
    costMethod: "avg_weighted",
  });
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    targetMargin?: string;
    targetMarkup?: string;
    marginPercent?: string;
  }>({});

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
        marginPercent: product.marginPercent ? product.marginPercent.toString() : "",
        minStock: product.minStock ? product.minStock.toString() : "",
        isActive: product.isActive,
        pricingMode: product.pricingMode || "margin",
        targetMargin: product.targetMargin ? product.targetMargin.toString() : "",
        priceLocked: product.priceLocked || false,
        roundingStep: product.roundingStep ? product.roundingStep.toString() : "10",
        costMethod: product.costMethod || "avg_weighted",
      });
      if (product.imageUrl) {
        setImagePreview(product.imageUrl);
      }
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

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      await api.upload(`/products/image/${params.id}`, formData);
    },
    onSuccess: () => {
      toast.success("Imagen subida correctamente");
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo subir la imagen");
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/products/${params.id}/image`);
    },
    onSuccess: () => {
      toast.success("Imagen eliminada");
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "No se pudo eliminar la imagen");
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = () => {
    deleteImageMutation.mutate();
  };

  // Validar targetMargin en tiempo real
  const validateTargetMargin = (value: string, mode: string) => {
    const errors = { ...validationErrors };
    
    if (mode === "margin") {
      if (!value) {
        errors.targetMargin = "El Margen Objetivo es requerido";
      } else {
        const numValue = parseNumericInput(value);
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
        const numValue = parseNumericInput(value);
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
      const numValue = parseNumericInput(value);
      if (isNaN(numValue)) {
        errors.marginPercent = "Ingresa un número válido";
      } else if (numValue < 0 || numValue >= 100) {
        errors.marginPercent = "El margen debe estar entre 0 y 100 (exclusivo)";
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
      cost: parseNumericInput(formData.cost),
      price: parseNumericInput(formData.price),
      taxRate: parseNumericInput(formData.taxRate),
      marginPercent: formData.marginPercent ? parseNumericInput(formData.marginPercent) : undefined,
      minStock: formData.minStock ? parseNumericInput(formData.minStock) : undefined,
      isActive: formData.isActive,
      pricingMode: formData.pricingMode,
      targetMargin: formData.targetMargin ? parseNumericInput(formData.targetMargin) : undefined,
      priceLocked: formData.priceLocked,
      roundingStep: parseInt(formData.roundingStep),
      costMethod: formData.costMethod,
    };
    
    console.log("📤 Actualizando producto:", payload);
    updateMutation.mutate(payload);
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
        <Header
          title="Editar Producto"
          description="Modificar datos del producto"
          link="/dashboard/products"
          linkLabel="Volver"
          actions={
            <div className="flex gap-2">
              <Tooltip content="Imprimir Etiqueta">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrintLabel}
                  disabled={isPrinting}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Eliminar Producto">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (
                      // TODO: Mostrar modal customizado
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
              </Tooltip>
            </div>
          }
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
                    onChange={handleMarginPercentChange}
                    placeholder="Ej: 30"
                    className={validationErrors.marginPercent ? "border-red-500" : ""}
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
                  <Label>Imagen del Producto</Label>
                  {imagePreview ? (
                    <div className="w-full max-w-xs flex justify-start gap-2 items-start">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-48 h-48 object-cover rounded-md border border-input"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadImageMutation.isPending}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={handleDeleteImage}
                          disabled={deleteImageMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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

                <div className="col-span-2">
                  <h3 className="text-sm font-semibold mb-3 mt-4">Configuración de Pricing Automático</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pricingMode">Modo de Pricing</Label>
                      <select
                        id="pricingMode"
                        value={formData.pricingMode}
                        onChange={handlePricingModeChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="fixed">Precio Fijo</option>
                        <option value="margin">Mantener Margen</option>
                        <option value="markup">Mantener Markup</option>
                        <option value="suggest">Solo Sugerir</option>
                      </select>
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
                        <p className="text-xs text-muted-foreground mt-2 p-2 bg-blue-50 rounded">
                          {formData.pricingMode === "markup" 
                            ? `📊 Equivalente: Margen ${calculateEquivalentMargin(parseNumericInput(formData.targetMargin)).toFixed(2)}%`
                            : `📊 Equivalente: Markup ${calculateEquivalentMarkup(parseNumericInput(formData.targetMargin)).toFixed(2)}%`
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="roundingStep">Redondeo de Precio</Label>
                      <select
                        id="roundingStep"
                        value={formData.roundingStep}
                        onChange={(e) =>
                          setFormData({ ...formData, roundingStep: e.target.value })
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="1">Sin redondeo</option>
                        <option value="10">Múltiplo de 10</option>
                        <option value="50">Múltiplo de 50</option>
                        <option value="100">Múltiplo de 100</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="costMethod">Método de Costo</Label>
                      <select
                        id="costMethod"
                        value={formData.costMethod}
                        onChange={(e) =>
                          setFormData({ ...formData, costMethod: e.target.value })
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="avg_weighted">Costo Promedio Ponderado</option>
                        <option value="last_cost">Último Costo</option>
                      </select>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        id="priceLocked"
                        type="checkbox"
                        checked={formData.priceLocked}
                        onChange={(e) =>
                          setFormData({ ...formData, priceLocked: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                      <Label htmlFor="priceLocked" className="text-sm">
                        Precio congelado (no permitir cambios automáticos)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isActive" className="text-sm">
                    Producto activo
                  </Label>
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
