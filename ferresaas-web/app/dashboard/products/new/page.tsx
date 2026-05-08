'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import Header from '@/components/ui/header';
import { Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CategoryFormState {
  name: string;
  description: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreateProducts = user?.permissions?.includes('products:create');

  useEffect(() => {
    if (!canCreateProducts) {
      router.push('/dashboard/products');
      return;
    }
  }, [canCreateProducts, router]);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    description: '',
    categoryId: '',
    unit: 'u',
    cost: '',
    price: '',
    taxRate: '21',
    marginPercent: '',
    minStock: '',
    initialStock: '',
    pricingMode: 'margin',
    targetMargin: '',
    priceLocked: false,
    roundingStep: '10',
    costMethod: 'avg_weighted',
  });

  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: '',
    description: '',
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    targetMargin?: string;
    targetMarkup?: string;
    marginPercent?: string;
  }>({});

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '' });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Ingresa un nombre para la categoría');
      return;
    }
    createCategoryMutation.mutate(categoryForm);
  };

  // Obtener categorías
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<any[]>('/categories');
      return response.data || [];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: CategoryFormState) => {
      const response = await api.post('/categories', {
        name: payload.name,
        description: payload.description || undefined,
      });
      return response.data;
    },
    onSuccess: (newCategory: any) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
      toast.success('Categoría creada');
      resetCategoryForm();
      setCategoryModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear categoría');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/products', data);
      return response.data;
    },
    onSuccess: (newProduct: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (selectedImage) {
        uploadImageMutation.mutate({ productId: newProduct.id, file: selectedImage });
      } else {
        toast.success('Producto creado exitosamente');
        router.push('/dashboard/products');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear producto');
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const formData = new FormData();
      formData.append('image', file);
      await api.upload(`/products/image/${productId}`, formData);
    },
    onSuccess: () => {
      toast.success('Producto creado y imagen subida exitosamente');
      router.push('/dashboard/products');
    },
    onError: (error: any) => {
      toast.warning('Producto creado pero la imagen no se pudo subir');
      router.push('/dashboard/products');
    },
  });

  const calculatePrice = async () => {
    if (!formData.cost || !formData.taxRate || !formData.marginPercent) {
      toast.error('Completa costo, IVA y margen para calcular');
      return;
    }

    try {
      const response = await api.post<any>('/products/calculate-price', {
        cost: parseFloat(formData.cost),
        taxRate: parseFloat(formData.taxRate),
        marginPercent: parseFloat(formData.marginPercent),
      });

      const calculated = response.data.suggestedPrice;
      setSuggestedPrice(calculated);
      toast.success(`Precio sugerido: $${calculated.toFixed(2)}`);
    } catch (error: any) {
      toast.error(error.message || 'Error al calcular precio');
    }
  };

  const applySuggestedPrice = () => {
    if (suggestedPrice !== null) {
      setFormData({ ...formData, price: suggestedPrice.toFixed(2) });
      toast.success('Precio sugerido aplicado');
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
      fileInputRef.current.value = '';
    }
  };

  // Validar targetMargin en tiempo real
  const validateTargetMargin = (value: string, mode: string) => {
    const errors = { ...validationErrors };

    if (mode === 'margin') {
      if (!value) {
        errors.targetMargin = 'El Margen Objetivo es requerido';
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.targetMargin = 'Ingresa un número válido';
        } else if (numValue <= 0) {
          errors.targetMargin = 'El margen debe ser mayor a 0% (ej: 37.5)';
        } else if (numValue >= 100) {
          errors.targetMargin = 'El margen debe ser menor a 100%. Máximo 99.9%';
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

    if (mode === 'markup') {
      if (!value) {
        errors.targetMarkup = 'El Markup Objetivo es requerido';
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.targetMarkup = 'Ingresa un número válido';
        } else if (numValue <= 0) {
          errors.targetMarkup = 'El markup debe ser mayor a 0% (ej: 60)';
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
        errors.marginPercent = 'Ingresa un número válido';
      } else if (numValue < 0 || numValue >= 100) {
        errors.marginPercent = 'El margen debe ser menor a 100%. Máximo 99.9%';
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
    if (mode === 'margin') {
      validateTargetMargin(formData.targetMargin, mode);
    } else if (mode === 'markup') {
      validateTargetMarkup(formData.targetMargin, mode);
    } else {
      setValidationErrors({});
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Si hay errores de validación, no permitir envío
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    // Validación final para modos que requieren valor objetivo
    if (formData.pricingMode === 'margin' && !formData.targetMargin) {
      toast.error("Debes configurar un Margen Objetivo para el modo 'Mantener Margen'");
      return;
    }

    if (formData.pricingMode === 'markup' && !formData.targetMargin) {
      toast.error("Debes configurar un Markup Objetivo para el modo 'Mantener Markup'");
      return;
    }

    const payload = {
      name: formData.name,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined,
      categoryId: formData.categoryId || undefined,
      unit: formData.unit,
      isFractional: formData.unit !== 'u',
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

    console.log('📤 Enviando producto al backend:', payload);
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="col-span-1 md:col-span-2">
                  <h3 className="text-sm font-semibold">Datos básicos</h3>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <Input
                    id="name"
                    label="Nombre *"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                      >
                        <SelectTrigger label="Categoría">
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

                <div>
                  <Input
                    id="barcode"
                    label="Código de barras"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <Textarea
                    id="description"
                    label="Descripción"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger label="Unidad *">
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

                <div className="col-span-1 md:col-span-2 pt-2">
                  <h3 className="text-sm font-semibold">Inventario</h3>
                </div>

                <div>
                  <Input
                    id="initialStock"
                    label="Stock inicial"
                    type="number"
                    step={formData.unit === 'u' ? '1' : '0.01'}
                    min="0"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cantidad disponible al momento de crear el producto.
                  </p>
                </div>

                <div>
                  <Input
                    id="minStock"
                    label="Stock mínimo"
                    type="number"
                    step="0.01"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  />
                </div>

                <div className="col-span-1 md:col-span-2 pt-2">
                  <h3 className="text-sm font-semibold">Precio rápido</h3>
                </div>

                <div>
                  <Input
                    id="cost"
                    label="Costo *"
                    labelTooltip="Lo que te cuesta comprar o producir una unidad del producto."
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Input
                    id="price"
                    label="Precio de venta *"
                    labelTooltip="Lo que pagará tu cliente por cada unidad."
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>

                <Input
                  id="taxRate"
                  label="IVA (%)"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                />

                <div>
                  <Input
                    id="marginPercent"
                    label="Margen (%)"
                    labelTooltip="Ganancia sobre el precio de venta. Ejemplo: costo 10.000 y venta 16.000 da margen 37,5%."
                    type="number"
                    step="0.01"
                    value={formData.marginPercent}
                    onChange={handleMarginPercentChange}
                    placeholder="Ej: 30"
                    className={`w-full ${validationErrors.marginPercent ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.marginPercent && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors.marginPercent}</p>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end">
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-none">Precio sugerido</p>
                      <div className="mt-2 flex h-11 w-full rounded-xl border border-input/80 bg-muted px-3.5 py-2.5 text-sm items-center">
                        {suggestedPrice !== null
                          ? `$${suggestedPrice.toFixed(2)}`
                          : 'Completa costo, IVA y margen'}
                      </div>
                    </div>
                    <div className="flex gap-2">
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fórmula: Precio = Costo × (1 + Margen%) × (1 + IVA%).
                  </p>
                </div>

                <div className="col-span-1 md:col-span-2 pt-2">
                  <details className="rounded-xl border border-input/60 bg-muted/30 p-4">
                    <summary className="cursor-pointer text-sm font-semibold select-none">
                      Opciones avanzadas de precios
                    </summary>
                    <p className="text-xs text-muted-foreground mt-2 mb-4">
                      Ajusta cómo se recalcula el precio cuando cambia el costo.
                    </p>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Select
                          value={formData.pricingMode}
                          onValueChange={(value: any) => {
                            setFormData({ ...formData, pricingMode: value });
                            handlePricingModeChange({ target: { value } } as any);
                          }}
                        >
                          <SelectTrigger
                            id="pricingMode"
                            label="Modo de precios"
                            labelTooltip="Define cómo se comporta el precio automático: fijo, por margen, por markup o solo sugerencia."
                          >
                            <SelectValue placeholder="Selecciona modo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Precio fijo</SelectItem>
                            <SelectItem value="margin">Mantener margen</SelectItem>
                            <SelectItem value="markup">Mantener recargo (Markup)</SelectItem>
                            <SelectItem value="suggest">Solo sugerir precio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Input
                          id="targetMargin"
                          label={formData.pricingMode === 'markup' ? 'Markup objetivo (%)' : 'Margen objetivo (%)'}
                          labelTooltip={
                            formData.pricingMode === 'markup'
                              ? 'Recargo sobre costo que quieres mantener. Ejemplo: costo 10.000 con 60% da 16.000.'
                              : 'Ganancia sobre venta que quieres mantener automáticamente.'
                          }
                          type="number"
                          step="0.01"
                          value={formData.targetMargin}
                          onChange={
                            formData.pricingMode === 'markup'
                              ? handleTargetMarkupChange
                              : handleTargetMarginChange
                          }
                          placeholder={formData.pricingMode === 'markup' ? 'Ej: 60' : 'Ej: 37.5'}
                          className={
                            validationErrors.targetMargin || validationErrors.targetMarkup
                              ? 'border-red-500'
                              : ''
                          }
                          disabled={formData.pricingMode === 'fixed'}
                        />
                        {(validationErrors.targetMargin || validationErrors.targetMarkup) && (
                          <p className="text-sm text-red-500 mt-1">
                            {validationErrors.targetMargin || validationErrors.targetMarkup}
                          </p>
                        )}
                        {formData.targetMargin &&
                          !validationErrors.targetMargin &&
                          !validationErrors.targetMarkup && (
                            <p className="brand-accent-panel mt-2 p-2 text-xs brand-accent-subtle">
                              {formData.pricingMode === 'markup'
                                ? `Equivalente: Margen ${calculateEquivalentMargin(parseFloat(formData.targetMargin)).toFixed(2)}%`
                                : `Equivalente: Markup ${calculateEquivalentMarkup(parseFloat(formData.targetMargin)).toFixed(2)}%`}
                            </p>
                          )}
                      </div>

                      <div>
                        <Select
                          value={formData.roundingStep}
                          onValueChange={(value) =>
                            setFormData({ ...formData, roundingStep: value })
                          }
                        >
                          <SelectTrigger
                            id="roundingStep"
                            label="Redondeo de precio"
                            labelTooltip="Redondea el precio final para vender con cifras más simples."
                          >
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
                        <Select
                          value={formData.costMethod}
                          onValueChange={(value) => setFormData({ ...formData, costMethod: value })}
                        >
                          <SelectTrigger
                            id="costMethod"
                            label="Método de costo"
                            labelTooltip="Promedio ponderado usa el historial. Último costo usa la compra más reciente."
                          >
                            <SelectValue placeholder="Selecciona método" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="avg_weighted">Costo promedio ponderado</SelectItem>
                            <SelectItem value="last_cost">Último costo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-1 md:col-span-2 flex items-start gap-2">
                        <div className="mt-[3px]">
                          <Checkbox
                            id="priceLocked"
                            checked={formData.priceLocked}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, priceLocked: Boolean(checked) })
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="priceLocked" className="text-sm">
                            Mantener precio fijo
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Si se activa, el sistema no ajusta el precio automáticamente.
                          </p>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <p className="text-sm font-medium leading-none">Imagen del Producto</p>
                  {imagePreview ? (
                    <div className="w-full max-w-xs flex justify-start gap-2 items-start mt-4">
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
                      className="w-full border-2 border-dashed border-input rounded-md p-6 mt-2 text-center cursor-pointer hover:bg-muted transition-colors"
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
                <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? 'Creando...' : 'Crear Producto'}
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
              <Input
                id="category-name"
                label="Nombre *"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Ferretería"
                required
              />
            </div>
            <div>
              <Textarea
                id="category-description"
                label="Descripción"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Opcional"
                rows={3}
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
                {createCategoryMutation.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
