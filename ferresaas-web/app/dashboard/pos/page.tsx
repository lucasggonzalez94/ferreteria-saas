"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, DollarSign, ArrowLeft, X } from "lucide-react";
import type { Product, Sale, Customer } from "@/types";
import Link from "next/link";
import Header from "@/components/ui/header";

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountedPrice?: number;
  discountReason?: string;
  discountApprovedBy?: string;
}

interface Payment {
  method: 'CASH_ARS' | 'CASH_USD' | 'CARD' | 'TRANSFER' | 'QR' | 'ACCOUNT';
  amount: number;
  amountUSD?: number;
  cardBrand?: string;
  financialCost?: number;
  notes?: string;
}

export default function POSPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ARS' | 'CASH_USD' | 'CARD' | 'TRANSFER' | 'QR' | 'ACCOUNT'>('CASH_ARS');
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [financialCost, setFinancialCost] = useState("");
  const [amountUSD, setAmountUSD] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState("");
  const [changeGiven, setChangeGiven] = useState("");
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountProductId, setDiscountProductId] = useState<string | null>(null);
  const [discountFinalPrice, setDiscountFinalPrice] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountApprovalModalOpen, setDiscountApprovalModalOpen] = useState(false);
  const [approverPassword, setApproverPassword] = useState("");
  const [discountApprovalLoading, setDiscountApprovalLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Obtener permisos del usuario
  useEffect(() => {
    const getPermissions = async () => {
      try {
        const response = await api.get<any>("/auth/me");
        setUserPermissions(response.data?.user?.permissions || []);
      } catch (error) {
        console.error("Error fetching permissions:", error);
      }
    };
    getPermissions();
  }, []);

  const canApproveDiscounts = userPermissions.includes('sales:approve_discount');

  // Validar que la caja esté abierta
  const { data: cashRegisterStatus, isLoading: isCashStatusLoading } = useQuery({
    queryKey: ["cash-register", "status"],
    queryFn: async () => {
      const response = await api.get<any>("/cash-register/status");
      return response.data;
    },
    refetchInterval: 30000, // Refetch cada 30s
  });

  useEffect(() => {
    if (!isCashStatusLoading && cashRegisterStatus === null) {
      toast.error("Debes abrir la caja antes de operar");
      router.push("/dashboard/cash-register");
    }
  }, [cashRegisterStatus, isCashStatusLoading, router]);

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

  // Buscar clientes
  const { data: customers } = useQuery({
    queryKey: ["customers", customerSearch],
    queryFn: async () => {
      if (!customerSearch || customerSearch.length < 1) return [];
      const response = await api.get<Customer[]>(
        `/customers?q=${customerSearch}`,
      );
      return response.data || [];
    },
    enabled: customerSearch.length >= 1,
  });

  // Crear venta
  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      // Crear borrador
      const saleResponse = await api.post<Sale>("/sales", data);
      const sale = saleResponse.data;
      if (!sale) {
        throw new Error("La API no devolvió la venta creada");
      }

      // Confirmar inmediatamente con los pagos
      const confirmResponse = await api.post<Sale>(`/sales/${sale.id}/confirm`, {
        payments: payments,
        changeGiven: data.changeGiven,
        invoiceType: "B",
      });

      if (!confirmResponse.data) {
        throw new Error("La API no devolvió la venta confirmada");
      }

      return confirmResponse.data;
    },
    onSuccess: () => {
      toast.success("Venta registrada exitosamente");
      setCart([]);
      setPayments([]);
      setPaymentAmount("");
      setAmountUSD("");
      setCardBrand("");
      setFinancialCost("");
      setPaymentNotes("");
      setSelectedCustomer(null);
      setCustomerSearch("");
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

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: newQuantity,
            subtotal: newQuantity * item.unitPrice,
          };
        }
        return item;
      }),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const applyDiscount = (productId: string, finalPrice: number, reason: string) => {
    // Si el usuario puede aprobar descuentos, aplicar directamente
    if (canApproveDiscounts) {
      setCart(
        cart.map((item) => {
          if (item.product.id === productId) {
            const newSubtotal = item.quantity * finalPrice;
            return {
              ...item,
              discountedPrice: finalPrice,
              discountReason: reason,
              subtotal: newSubtotal,
            };
          }
          return item;
        })
      );
      setDiscountModalOpen(false);
      setDiscountProductId(null);
      setDiscountFinalPrice("");
      setDiscountReason("");
      toast.success("Descuento aplicado");
    } else {
      // Si no tiene permisos, mostrar modal de aprobación rápida
      setDiscountApprovalModalOpen(true);
    }
  };

  const requestDiscountApproval = async () => {
    if (!discountProductId || !discountFinalPrice || !discountReason) {
      toast.error("Completa todos los campos");
      return;
    }

    if (!approverPassword) {
      toast.error("Ingresa la contraseña del aprobador");
      return;
    }

    setDiscountApprovalLoading(true);
    try {
      const item = cart.find(i => i.product.id === discountProductId);
      if (!item) {
        toast.error("Producto no encontrado");
        return;
      }

      // Solicitar aprobación al backend
      await api.post("/discount-approvals", {
        saleId: "temp", // Se generará cuando se cree la venta
        productId: discountProductId,
        originalPrice: item.unitPrice,
        discountedPrice: parseFloat(discountFinalPrice),
        discountReason: discountReason,
      });

      // Si la solicitud fue exitosa, aplicar el descuento con estado pendiente
      setCart(
        cart.map((item) => {
          if (item.product.id === discountProductId) {
            const newSubtotal = item.quantity * parseFloat(discountFinalPrice);
            return {
              ...item,
              discountedPrice: parseFloat(discountFinalPrice),
              discountReason: discountReason,
              subtotal: newSubtotal,
            };
          }
          return item;
        })
      );

      setDiscountModalOpen(false);
      setDiscountApprovalModalOpen(false);
      setDiscountProductId(null);
      setDiscountFinalPrice("");
      setDiscountReason("");
      setApproverPassword("");
      toast.success("Solicitud de aprobación enviada");
    } catch (error: any) {
      toast.error(error.message || "Error al solicitar aprobación");
    } finally {
      setDiscountApprovalLoading(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const tax = subtotal * 0.21;
  const total = subtotal + tax;

  const addPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (paymentMethod === 'ACCOUNT' && !selectedCustomer) {
      toast.error("Debes seleccionar un cliente para venta a cuenta corriente");
      return;
    }

    const newPayment: Payment = {
      method: paymentMethod,
      amount,
    };

    if (paymentMethod === 'CASH_USD') {
      const usd = parseFloat(amountUSD);
      if (!usd || usd <= 0) {
        toast.error("Ingresa el monto en USD");
        return;
      }
      newPayment.amountUSD = usd;
    }

    if (paymentMethod === 'CARD') {
      if (!cardBrand) {
        toast.error("Selecciona la marca de tarjeta");
        return;
      }
      newPayment.cardBrand = cardBrand;
      if (financialCost) {
        newPayment.financialCost = parseFloat(financialCost);
      }
    }

    if (paymentNotes) {
      newPayment.notes = paymentNotes;
    }

    setPayments([...payments, newPayment]);
    setPaymentAmount("");
    setAmountUSD("");
    setCardBrand("");
    setFinancialCost("");
    setPaymentNotes("");
    toast.success("Pago agregado");
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = Math.max(0, total - totalPaid);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    if (payments.length === 0) {
      toast.error("Agrega al menos un método de pago");
      return;
    }

    if (totalPaid < total) {
      toast.error(`Falta $${remainingAmount.toFixed(2)} por pagar`);
      return;
    }

    // Validar vuelto si hay pago en efectivo y hay sobrante
    const hasCashPayment = payments.some(p => p.method === 'CASH_ARS' || p.method === 'CASH_USD');
    if (hasCashPayment && change > 0.01 && !changeGiven) {
      toast.error("Ingresa el vuelto entregado");
      return;
    }

    createSaleMutation.mutate({
      customerId: selectedCustomer?.id,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.product.taxRate),
        discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : undefined,
        discountReason: item.discountReason,
        discountApprovedBy: item.discountApprovedBy,
      })),
      changeGiven: changeGiven ? parseFloat(changeGiven) : undefined,
    });
  };

  const change = totalPaid - total;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Punto de Venta"
        />

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
                            ${Number(product.price).toFixed(2)}
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
                          <div className="text-sm text-muted-foreground">
                            {item.discountedPrice ? (
                              <>
                                <span className="line-through">${Number(item.unitPrice).toFixed(2)}</span>
                                <span className="ml-2 text-green-600 font-medium">
                                  ${Number(item.discountedPrice).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span>${Number(item.unitPrice).toFixed(2)}</span>
                            )}
                            <span className="ml-2">x {item.quantity.toFixed(item.product.isFractional ? 2 : 0)} {item.product.unit}</span>
                          </div>
                          {item.discountReason && (
                            <p className="text-xs text-amber-600 mt-1">Descuento: {item.discountReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, item.quantity - (item.product.isFractional ? 0.1 : 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="text"
                            value={editingQuantityId === item.product.id ? editingQuantityValue : item.quantity.toFixed(item.product.isFractional ? 2 : 0)}
                            onChange={(e) => {
                              setEditingQuantityId(item.product.id);
                              setEditingQuantityValue(e.target.value);
                            }}
                            onBlur={(e) => {
                              const newQty = parseFloat(e.target.value);
                              if (isNaN(newQty) || newQty <= 0) {
                                removeFromCart(item.product.id);
                              } else {
                                updateQuantity(item.product.id, newQty);
                              }
                              setEditingQuantityId(null);
                              setEditingQuantityValue("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newQty = parseFloat(e.currentTarget.value);
                                if (isNaN(newQty) || newQty <= 0) {
                                  removeFromCart(item.product.id);
                                } else {
                                  updateQuantity(item.product.id, newQty);
                                }
                                setEditingQuantityId(null);
                                setEditingQuantityValue("");
                              }
                            }}
                            className="w-16 text-center font-medium text-sm"
                            placeholder="0"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.isFractional ? 0.1 : 1))}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="font-semibold">
                            ${Number(item.subtotal).toFixed(2)}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDiscountProductId(item.product.id);
                              setDiscountFinalPrice(item.discountedPrice ? String(item.discountedPrice) : String(item.unitPrice));
                              setDiscountReason(item.discountReason || "");
                              setDiscountModalOpen(true);
                            }}
                            className="text-xs h-7"
                          >
                            {item.discountedPrice ? "Editar desc." : "Descuento"}
                          </Button>
                        </div>
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
                  <span>${Number(subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (21%):</span>
                  <span>${Number(tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total:</span>
                  <span>${Number(total).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente..."
                    value={selectedCustomer ? (selectedCustomer.type === 'COMPANY' ? selectedCustomer.companyName : `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) : customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="text-sm"
                  />

                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}

                  {showCustomerDropdown && customerSearch && customers && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0 text-sm"
                        >
                          <p className="font-medium">
                            {customer.type === 'COMPANY' ? customer.companyName : `${customer.firstName} ${customer.lastName}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {customer.email || customer.phone || 'Sin contacto'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCustomer && (
                  <div className="space-y-2">
                    <div className="p-2 bg-blue-50 rounded-lg text-xs">
                      <p className="text-blue-700">
                        <span className="font-medium">Saldo:</span> ${Number(selectedCustomer.currentBalance).toFixed(2)}
                      </p>
                    </div>
                    {selectedCustomer.currentBalance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPaymentMethod('ACCOUNT');
                          setPaymentAmount(selectedCustomer.currentBalance.toString());
                        }}
                        className="w-full text-xs"
                      >
                        Cobrar saldo pendiente
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Método de pago */}
                <div>
                  <label className="text-sm font-medium">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="CASH_ARS">Efectivo ARS</option>
                    <option value="CASH_USD">Efectivo USD</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="QR">QR</option>
                    <option value="ACCOUNT" disabled={!selectedCustomer}>
                      {selectedCustomer ? 'Cuenta Corriente' : 'Cuenta Corriente (requiere cliente)'}
                    </option>
                  </select>
                </div>

                {/* Monto */}
                <div>
                  <label className="text-sm font-medium">Monto ARS</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>

                {/* USD específico para CASH_USD */}
                {paymentMethod === 'CASH_USD' && (
                  <div>
                    <label className="text-sm font-medium">Monto USD</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amountUSD}
                      onChange={(e) => setAmountUSD(e.target.value)}
                      placeholder="0.00"
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Tarjeta específico para CARD */}
                {paymentMethod === 'CARD' && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Marca de Tarjeta</label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Selecciona marca...</option>
                        <option value="VISA">Visa</option>
                        <option value="MASTERCARD">Mastercard</option>
                        <option value="AMEX">American Express</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Costo Financiero (opcional)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={financialCost}
                        onChange={(e) => setFinancialCost(e.target.value)}
                        placeholder="0.00"
                        className="text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Notas opcionales */}
                <div>
                  <label className="text-sm font-medium">Notas (opcional)</label>
                  <Input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ej: Referencia de transferencia"
                    className="text-sm"
                  />
                </div>

                {/* Botón agregar pago */}
                <Button
                  onClick={addPayment}
                  variant="outline"
                  className="w-full"
                  disabled={!paymentAmount}
                >
                  + Agregar Pago
                </Button>

                {/* Lista de pagos agregados */}
                {payments.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Pagos agregados:</p>
                    {payments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                        <div>
                          <p className="font-medium">
                            {payment.method === 'CASH_ARS' && 'Efectivo ARS'}
                            {payment.method === 'CASH_USD' && 'Efectivo USD'}
                            {payment.method === 'CARD' && `Tarjeta ${payment.cardBrand}`}
                            {payment.method === 'TRANSFER' && 'Transferencia'}
                            {payment.method === 'QR' && 'QR'}
                            {payment.method === 'ACCOUNT' && 'Cuenta Corriente'}
                          </p>
                          <p className="text-xs text-muted-foreground">${payment.amount.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => removePayment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen de pagos */}
                {payments.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total a pagar:</span>
                      <span className="font-medium">${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total pagado:</span>
                      <span className="font-medium">${totalPaid.toFixed(2)}</span>
                    </div>
                    {remainingAmount > 0 ? (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Falta pagar:</span>
                        <span className="font-medium">${remainingAmount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Vuelto teórico:</span>
                        <span className="font-medium">${change.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Campo de vuelto entregado (solo si hay pago en efectivo y hay sobrante) */}
                    {change > 0.01 && payments.some(p => p.method === 'CASH_ARS' || p.method === 'CASH_USD') && (
                      <div className="pt-2 border-t">
                        <label className="text-sm font-medium">Vuelto entregado</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={changeGiven}
                          onChange={(e) => setChangeGiven(e.target.value)}
                          placeholder={change.toFixed(2)}
                          className="text-sm mt-1"
                        />
                        {changeGiven && Math.abs(parseFloat(changeGiven) - change) > 0.01 && (
                          <p className="text-xs text-amber-600 mt-1">
                            Diferencia: ${(parseFloat(changeGiven) - change).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || payments.length === 0 || totalPaid < total || createSaleMutation.isPending}
                  className="w-full h-12 text-lg"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  {createSaleMutation.isPending ? "Procesando..." : "Cobrar"}
                </Button>

                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCart([]);
                      setPayments([]);
                      setPaymentAmount("");
                      setAmountUSD("");
                      setCardBrand("");
                      setFinancialCost("");
                      setPaymentNotes("");
                    }}
                    className="w-full"
                  >
                    Limpiar Carrito
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de descuentos */}
        {discountModalOpen && discountProductId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Aplicar Descuento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const item = cart.find(i => i.product.id === discountProductId);
                  if (!item) return null;

                  const originalPrice = Number(item.unitPrice);
                  const finalPrice = discountFinalPrice ? parseFloat(discountFinalPrice) : originalPrice;
                  const discountAmount = originalPrice - finalPrice;
                  const discountPercent = ((discountAmount / originalPrice) * 100).toFixed(2);
                  const costPrice = Number(item.product.cost);
                  const isBelowCost = finalPrice < costPrice;

                  return (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Producto: {item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Precio original: ${originalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Precio de costo: ${costPrice.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Precio final</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={discountFinalPrice}
                          onChange={(e) => setDiscountFinalPrice(e.target.value)}
                          placeholder={originalPrice.toFixed(2)}
                          className="mt-1"
                        />
                      </div>

                      {discountFinalPrice && (
                        <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">Descuento:</span> ${discountAmount.toFixed(2)} ({discountPercent}%)
                          </p>
                          {isBelowCost && (
                            <p className="text-xs text-red-600 font-medium">
                              ⚠️ Precio por debajo del costo (${costPrice.toFixed(2)})
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium">Motivo del descuento</label>
                        <select
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                        >
                          <option value="">Selecciona un motivo</option>
                          <option value="Descuento familiar">Descuento familiar</option>
                          <option value="Descuento amigo">Descuento amigo</option>
                          <option value="Promoción">Promoción</option>
                          <option value="Daño menor">Daño menor</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDiscountModalOpen(false);
                            setDiscountProductId(null);
                            setDiscountFinalPrice("");
                            setDiscountReason("");
                          }}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => {
                            if (!discountFinalPrice) {
                              toast.error("Ingresa el precio final");
                              return;
                            }
                            if (!discountReason) {
                              toast.error("Selecciona un motivo");
                              return;
                            }
                            applyDiscount(discountProductId, parseFloat(discountFinalPrice), discountReason);
                            toast.success("Descuento aplicado");
                          }}
                          className="flex-1"
                        >
                          Aplicar Descuento
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de aprobación rápida de descuentos */}
        {discountApprovalModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Solicitar Aprobación de Descuento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">⚠️ Requiere aprobación:</span> Este descuento necesita ser aprobado por un usuario con permisos.
                  </p>
                </div>

                {(() => {
                  const item = cart.find(i => i.product.id === discountProductId);
                  if (!item) return null;

                  const originalPrice = Number(item.unitPrice);
                  const finalPrice = discountFinalPrice ? parseFloat(discountFinalPrice) : originalPrice;
                  const discountAmount = originalPrice - finalPrice;
                  const discountPercent = ((discountAmount / originalPrice) * 100).toFixed(2);

                  return (
                    <>
                      <div className="space-y-2 bg-slate-50 p-3 rounded-lg">
                        <p className="text-sm font-medium">Producto: {item.product.name}</p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Precio original:</span> ${originalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Precio final:</span> ${finalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          Descuento: ${discountAmount.toFixed(2)} ({discountPercent}%)
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Motivo:</span> {discountReason}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Contraseña del aprobador</label>
                        <Input
                          type="password"
                          value={approverPassword}
                          onChange={(e) => setApproverPassword(e.target.value)}
                          placeholder="Ingresa la contraseña"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          El gerente/dueño debe ingresar su contraseña para aprobar este descuento.
                        </p>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDiscountApprovalModalOpen(false);
                            setApproverPassword("");
                          }}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={requestDiscountApproval}
                          disabled={discountApprovalLoading || !approverPassword}
                          className="flex-1"
                        >
                          {discountApprovalLoading ? "Enviando..." : "Solicitar Aprobación"}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
