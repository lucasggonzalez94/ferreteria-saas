"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, DollarSign } from "lucide-react";
import type { Product } from "@/types";

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const queryClient = useQueryClient();

  // Buscar productos
  const { data: products } = useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const response = await api.get<Product[]>(
        `/products?q=${search}&active=true`,
      );
      return response.data || [];
    },
    enabled: search.length >= 2,
  });

  // Crear venta
  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      // Crear borrador
      const saleResponse = await api.post("/sales", data);
      const sale = saleResponse.data;

      // Confirmar inmediatamente
      const confirmResponse = await api.post(`/sales/${sale.id}/confirm`, {
        payments: [
          {
            method: "CASH_ARS",
            amount: total,
          },
        ],
        invoiceType: "B",
      });

      return confirmResponse.data;
    },
    onSuccess: () => {
      toast.success("Venta registrada exitosamente");
      setCart([]);
      setPaymentAmount("");
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar venta");
    },
  });

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);

    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitPrice: product.price,
          subtotal: product.price,
        },
      ]);
    }

    setSearch("");
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;
            return {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.unitPrice,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = subtotal * 0.21;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    const payment = parseFloat(paymentAmount);
    if (!payment || payment < total) {
      toast.error("El monto de pago es insuficiente");
      return;
    }

    createSaleMutation.mutate({
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.product.taxRate,
      })),
    });
  };

  const change = paymentAmount ? parseFloat(paymentAmount) - total : 0;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Punto de Venta</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Product Search */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Buscar Producto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, SKU o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                {/* Search Results */}
                {products && products.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {product.internalSku} | Stock:{" "}
                              {product.stockQuantity} {product.unit}
                            </p>
                          </div>
                          <p className="font-semibold">
                            ${product.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cart */}
            <Card>
              <CardHeader>
                <CardTitle>Carrito ({cart.length} productos)</CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    El carrito está vacío
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ${item.unitPrice.toFixed(2)} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="font-semibold w-24 text-right">
                          ${item.subtotal.toFixed(2)}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Checkout */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (21%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Monto Recibido</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg"
                  />
                </div>

                {change > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">Vuelto:</p>
                    <p className="text-2xl font-bold text-green-800">
                      ${change.toFixed(2)}
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || createSaleMutation.isPending}
                  className="w-full h-12 text-lg"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  {createSaleMutation.isPending ? "Procesando..." : "Cobrar"}
                </Button>

                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setCart([])}
                    className="w-full"
                  >
                    Limpiar Carrito
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
