"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  internalSku: string;
  name: string;
  unit: string;
  cost: number;
}

interface PurchaseItem {
  productId: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canCreatePurchase = user?.permissions?.includes("purchases:create");

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [taxRate, setTaxRate] = useState("21");

  useEffect(() => {
    if (!canCreatePurchase) {
      router.push("/dashboard");
      return;
    }
  }, [canCreatePurchase, router]);

  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery<any[]>({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const response = await api.get<any>("/suppliers", {
        params: { limit: 1000 },
      });
      return response.data?.data || [];
    },
    enabled: canCreatePurchase,
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["products-list"],
    queryFn: async () => {
      const response = await api.get<any>("/products", {
        params: { limit: 1000 },
      });
      return response.data?.data || [];
    },
    enabled: canCreatePurchase,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/purchases", {
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          taxRate: parseFloat(item.taxRate.toString()),
        })),
        notes: notes || undefined,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      router.push(`/dashboard/purchases/${data.id}`);
    },
  });

  const handleAddItem = () => {
    if (!selectedProductId || !quantity || !unitCost) {
      alert("Completa todos los campos del producto");
      return;
    }

    const newItem: PurchaseItem = {
      productId: selectedProductId,
      quantity: parseFloat(quantity),
      unitCost: parseFloat(unitCost),
      taxRate: parseFloat(taxRate),
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setQuantity("");
    setUnitCost("");
    setTaxRate("21");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert("Selecciona un proveedor");
      return;
    }
    if (items.length === 0) {
      alert("Agrega al menos un producto");
      return;
    }
    createMutation.mutate();
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitCost;
      const itemTax = (itemSubtotal * item.taxRate) / 100;
      subtotal += itemSubtotal;
      tax += itemTax;
    });

    return { subtotal, tax, total: subtotal + tax };
  };

  const totals = calculateTotals();
  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  if (isLoadingSuppliers || isLoadingProducts) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner text="Cargando datos..." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/purchases">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Nueva Compra</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Proveedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="supplier">Selecciona un proveedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier: Supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles de la Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="invoiceNumber">Número de Factura</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej: FAC-001"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales sobre la compra"
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Items */}
          <Card>
            <CardHeader>
              <CardTitle>Agregar Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="product">Producto *</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={(value: string) => setSelectedProductId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Cantidad *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="unitCost">Precio Unit. *</Label>
                  <Input
                    id="unitCost"
                    type="number"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="taxRate">IVA %</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="21"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>

              {selectedProduct && (
                <div className="text-sm text-muted-foreground">
                  SKU: {selectedProduct.internalSku} • Unidad:{" "}
                  {selectedProduct.unit}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Productos Agregados ({items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const product = products?.find(
                      (p) => p.id === item.productId
                    );
                    const itemSubtotal = item.quantity * item.unitCost;
                    const itemTax = (itemSubtotal * item.taxRate) / 100;

                    return (
                      <div
                        key={index}
                        className="border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold">{product?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {product?.internalSku}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Cantidad</p>
                            <p className="font-semibold">
                              {item.quantity} {product?.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Precio Unit.</p>
                            <p className="font-semibold">
                              ${item.unitCost.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">IVA</p>
                            <p className="font-semibold">{item.taxRate}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Subtotal</p>
                            <p className="font-semibold">
                              ${itemSubtotal.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-semibold">
                              ${(itemSubtotal + itemTax).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">
                  ${totals.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA Total</span>
                <span className="font-semibold">
                  ${totals.tax.toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">
                  ${totals.total.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={createMutation.isPending || items.length === 0}
              className="flex-1"
            >
              {createMutation.isPending ? "Guardando..." : "Crear Compra"}
            </Button>
            <Link href="/dashboard/purchases" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
