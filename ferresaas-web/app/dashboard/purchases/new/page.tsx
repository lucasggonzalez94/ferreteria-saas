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
import { ArrowLeft, Plus, Trash2, PackagePlus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { QuickCreateProductModal } from "@/components/quick-create-product-modal";
import { toast } from "sonner";
import { parseNumericInput } from "@/lib/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/ui/header";

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
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [fundError, setFundError] = useState<string>("");

  useEffect(() => {
    if (!canCreatePurchase) {
      router.push("/dashboard");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }, [canCreatePurchase, router, queryClient]);

  const { data: suppliers, isLoading: isLoadingSuppliers, error: suppliersError, refetch: refetchSuppliers } = useQuery<any[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const response = await api.get<any>("/suppliers", {
        params: { limit: 1000 },
      });
      return response.data || [];
    },
    enabled: canCreatePurchase,
  });

  const { data: products, isLoading: isLoadingProducts, error: productsError, refetch: refetchProducts } = useQuery<any[]>({
    queryKey: ["products-list"],
    queryFn: async () => {
      const response = await api.get<any>("/products", {
        params: { limit: 1000 },
      });
      return response.data || [];
    },
    enabled: canCreatePurchase,
  });

  const { data: financialAccounts } = useQuery<any[]>({
    queryKey: ["financial-accounts"],
    queryFn: async () => {
      const response = await api.get<any>("/financial-accounts");
      return response.data || [];
    },
    enabled: canCreatePurchase,
  });

  console.log("Current products state:", products);
  console.log("Products length:", products?.length);
  console.log("isLoadingProducts:", isLoadingProducts);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<any>("/purchases", {
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: parseNumericInput(item.quantity.toString()),
          unitCost: parseNumericInput(item.unitCost.toString()),
          taxRate: parseNumericInput(item.taxRate.toString()),
        })),
        notes: notes || undefined,
        amountPaid: amountPaid ? parseNumericInput(amountPaid) : 0,
        paymentMethod: amountPaid && parseNumericInput(amountPaid) > 0 ? paymentMethod : undefined,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases-summary"] });
      queryClient.invalidateQueries({ queryKey: ["payables-summary"] });
      toast.success("Compra creada exitosamente");
      router.push(`/dashboard/purchases/${data.id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Error al crear la compra";
      toast.error(errorMessage);
      console.error("Error creating purchase:", error);
    },
  });

  // Validar fondos en tiempo real
  const validateFundsRealtime = (amount: string, method: string) => {
    if (!amount || parseNumericInput(amount) === 0) {
      setFundError("");
      return;
    }

    const paidAmount = parseNumericInput(amount);
    
    // No validar para CHECK (cheques no requieren fondos inmediatos)
    if (method === "CHECK") {
      setFundError("");
      return;
    }

    // Obtener tipo de cuenta según método de pago
    const accountTypeMap: Record<string, string> = {
      CASH: "CASH",
      TRANSFER: "BANK",
      CHECK: "BANK",
    };
    const accountType = accountTypeMap[method] || "BANK";
    
    // Buscar cuenta por defecto del tipo
    const account = financialAccounts?.find(
      (acc: any) => acc.type === accountType && acc.isDefault && acc.isActive
    );
    
    if (!account) {
      setFundError(`No hay cuenta de ${accountType} configurada`);
      return;
    }
    
    const balance = Number(account.balance) || 0;
    if (balance < paidAmount) {
      setFundError(
        `⚠️ Fondos insuficientes. Disponible: $${balance.toFixed(2)}, Ingresado: $${paidAmount.toFixed(2)}`
      );
    } else {
      setFundError("");
    }
  };

  // Manejar cambio de monto pagado
  const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmountPaid(value);
    validateFundsRealtime(value, paymentMethod);
  };

  // Manejar cambio de método de pago
  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const method = e.target.value;
    setPaymentMethod(method);
    validateFundsRealtime(amountPaid, method);
  };

  const handleAddItem = () => {
    if (!selectedProductId || !quantity || !unitCost) {
      toast.error("Completa todos los campos del producto");
      return;
    }

    const newItem: PurchaseItem = {
      productId: selectedProductId,
      quantity: parseNumericInput(quantity),
      unitCost: parseNumericInput(unitCost),
      taxRate: parseNumericInput(taxRate),
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
      toast.error("Selecciona un proveedor");
      return;
    }
    if (items.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    // Validar fondos si hay monto pagado
    const paidAmount = amountPaid ? parseNumericInput(amountPaid) : 0;
    if (paidAmount > 0) {
      const method = paymentMethod || "CASH";
      
      // No validar para CHECK (cheques no requieren fondos inmediatos)
      if (method !== "CHECK") {
        // Obtener tipo de cuenta según método de pago
        const accountTypeMap: Record<string, string> = {
          CASH: "CASH",
          TRANSFER: "BANK",
          CHECK: "BANK",
        };
        const accountType = accountTypeMap[method] || "BANK";
        
        // Buscar cuenta por defecto del tipo
        const account = financialAccounts?.find(
          (acc: any) => acc.type === accountType && acc.isDefault && acc.isActive
        );
        
        if (!account) {
          toast.error(`No hay cuenta de ${accountType} configurada`);
          return;
        }
        
        const balance = Number(account.balance) || 0;
        if (balance < paidAmount) {
          toast.error(
            `Fondos insuficientes. Disponible: $${balance.toFixed(2)}, Requerido: $${paidAmount.toFixed(2)}`
          );
          return;
        }
      }
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
        <Header title="Nueva Compra" link="/dashboard/purchases" linkLabel="Volver a Compras" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Proveedor</CardTitle>
            </CardHeader>
            <CardContent>
              {suppliersError && (
                <div className="w-full p-3 rounded-md border border-destructive bg-destructive/10 text-sm text-destructive mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Error al cargar proveedores</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchSuppliers()}
                    className="w-full"
                  >
                    Reintentar
                  </Button>
                </div>
              )}
              <Label htmlFor="supplier">Selecciona un proveedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers && suppliers.length > 0 ? (
                    suppliers.map((supplier: Supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 mx-auto mb-2" />
                      <p>No hay proveedores registrados</p>
                      <p className="text-xs mt-1">Crea uno en la sección de Proveedores</p>
                    </div>
                  )}
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
              {productsError && (
                <div className="w-full p-3 rounded-md border border-destructive bg-destructive/10 text-sm text-destructive">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Error al cargar productos</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchProducts()}
                    className="w-full"
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="product">Producto *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateProductModal(true)}
                      className="h-fit text-xs"
                    >
                      <PackagePlus className="h-3 w-3 mr-1" />
                      Nuevo
                    </Button>
                  </div>
                  <Select
                    value={selectedProductId}
                    onValueChange={(value: string) => setSelectedProductId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products && products.length > 0 ? (
                        products.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          <PackagePlus className="h-4 w-4 mx-auto mb-2" />
                          <p>No hay productos registrados</p>
                          <p className="text-xs mt-1">Usa el botón "Nuevo" para crear uno</p>
                        </div>
                      )}
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

              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label htmlFor="amountPaid">Monto Pagado</Label>
                  <Input
                    id="amountPaid"
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={handleAmountPaidChange}
                    placeholder="0.00"
                    className={fundError ? "border-red-500" : ""}
                  />
                  {fundError ? (
                    <p className="text-sm text-red-500 mt-1">{fundError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Dejar en blanco o 0 para crear compra pendiente de pago
                    </p>
                  )}
                </div>

                {amountPaid && parseFloat(amountPaid) > 0 && (
                  <div>
                    <Label htmlFor="paymentMethod">Método de Pago</Label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={handlePaymentMethodChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecciona cómo se realizará el pago
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-blue-700">Saldo Pendiente</span>
                    <span className="font-semibold text-blue-900">
                      ${Math.max(0, totals.total - (amountPaid ? parseFloat(amountPaid) : 0)).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600">
                    {amountPaid && parseFloat(amountPaid) > 0
                      ? `Pagado: $${parseFloat(amountPaid).toFixed(2)}`
                      : "Compra completamente pendiente de pago"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={
                createMutation.isPending || 
                items.length === 0 || 
                !supplierId ||
                fundError !== ""
              }
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

        <QuickCreateProductModal
          open={showCreateProductModal}
          onOpenChange={setShowCreateProductModal}
          onSuccess={(productId) => {
            setSelectedProductId(productId);
          }}
        />
      </div>
    </div>
  );
}
