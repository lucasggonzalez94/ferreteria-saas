"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Minus, Trash2, DollarSign } from "lucide-react";
import type { Product, Sale, Customer } from "@/types";
import Header from "@/components/ui/header";
import { parseNumericInput } from "@/lib/numeric-input";
import { usePermissionGuard } from "@/lib/hooks/usePermissionGuard";
import { ProductSelector } from "@/components/shared/product-selector";
import { EntityAutocomplete } from "@/components/shared/entity-autocomplete";
import { useExchangeRateWithFallback } from "@/lib/hooks/useExchangeRateWithFallback";
import { ManualExchangeRateModal } from "@/components/exchange-rate/manual-exchange-rate-modal";
import { StaleRateBanner } from "@/components/exchange-rate/stale-rate-banner";
import { useCartPersistence } from "@/lib/hooks/useCartPersistence";
import { UnknownBarcodeModal } from "@/components/pos/unknown-barcode-modal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  method: "CASH_ARS" | "CASH_USD" | "CARD" | "TRANSFER" | "QR" | "ACCOUNT";
  amount: number;
  amountUSD?: number;
  cardBrand?: string;
  financialCost?: number;
  notes?: string;
}

export default function POSPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { loadCart, saveCart, clearCart } = useCartPersistence();

  usePermissionGuard("sales:create");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH_ARS" | "CASH_USD" | "CARD" | "TRANSFER" | "QR" | "ACCOUNT"
  >("CASH_ARS");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [financialCost, setFinancialCost] = useState("");
  const [amountUSD, setAmountUSD] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(
    null,
  );
  const [editingQuantityValue, setEditingQuantityValue] = useState("");
  const [changeGiven, setChangeGiven] = useState("");
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountProductId, setDiscountProductId] = useState<string | null>(
    null,
  );
  const [discountFinalPrice, setDiscountFinalPrice] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountApprovalModalOpen, setDiscountApprovalModalOpen] =
    useState(false);
  const [approverPassword, setApproverPassword] = useState("");
  const [discountApprovalLoading, setDiscountApprovalLoading] = useState(false);
  const [unknownBarcodeModalOpen, setUnknownBarcodeModalOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const queryClient = useQueryClient();

  const canApproveDiscounts =
    user?.permissions?.includes("sales:approve_discount") ?? false;

  // Hook para tipo de cambio con fallback
  const {
    rate: exchangeRate,
    isLoading: isLoadingRate,
    showManualModal,
    lastKnownRate,
    handleUseLastKnown,
    handleManualRate,
    handleCancel,
    isStale,
    isFallback,
    refetch: refetchExchangeRate,
    openManualModal,
  } = useExchangeRateWithFallback();

  const handleUnknownBarcode = (barcode: string) => {
    setUnknownBarcode(barcode);
    setUnknownBarcodeModalOpen(true);
  };

  const handleProductFromBarcode = (product: Product) => {
    setUnknownBarcodeModalOpen(false);
    setUnknownBarcode("");
    queryClient.invalidateQueries({ queryKey: ["products-search"] });
    addToCart(product);
    toast.success(`${product.name} agregado al carrito`);
  };

  // Validar que la caja esté abierta
  const { data: cashRegisterStatus, isLoading: isCashStatusLoading } = useQuery(
    {
      queryKey: ["cash-register", "status"],
      queryFn: async () => {
        const response = await api.get<any>("/cash-register/status");
        return response.data;
      },
      refetchInterval: 30000, // Refetch cada 30s
    },
  );

  useEffect(() => {
    if (!isCashStatusLoading && cashRegisterStatus === null) {
      toast.error("Debes abrir la caja antes de operar");
      router.push("/dashboard/cash-register");
    }
  }, [cashRegisterStatus, isCashStatusLoading, router]);

  // Cargar carrito desde sessionStorage al montar el componente
  useEffect(() => {
    const savedCart = loadCart();
    if (savedCart.length > 0) {
      setCart(savedCart);
      toast.success(
        `${savedCart.length} producto(s) recuperado(s) del carrito`,
      );
    }
  }, [loadCart]);

  // Guardar carrito en sessionStorage cuando cambie
  useEffect(() => {
    if (cart.length > 0) {
      saveCart(cart);
    }
  }, [cart, saveCart]);

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
      const confirmResponse = await api.post<Sale>(
        `/sales/${sale.id}/confirm`,
        {
          payments: payments,
          changeGiven: data.changeGiven,
          invoiceType: "B",
        },
      );

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
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar venta");
    },
  });

  const addToCart = (product: Product) => {
    // Validar stock disponible
    if (product.stockQuantity <= 0) {
      toast.error(`${product.name} no tiene stock disponible`);
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);

    if (existing) {
      // Validar que no exceda el stock disponible
      const newQuantity = existing.quantity + 1;
      if (newQuantity > product.stockQuantity) {
        toast.error(
          `Solo hay ${product.stockQuantity} ${product.unit} disponibles de ${product.name}`,
        );
        return;
      }

      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * item.unitPrice,
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
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Validar stock disponible
    const item = cart.find((i) => i.product.id === productId);
    if (item && newQuantity > item.product.stockQuantity) {
      toast.error(
        `Solo hay ${item.product.stockQuantity} ${item.product.unit} disponibles`,
      );
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

  const applyDiscount = (
    productId: string,
    finalPrice: number,
    reason: string,
  ) => {
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
        }),
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
      const item = cart.find((i) => i.product.id === discountProductId);
      if (!item) {
        toast.error("Producto no encontrado");
        return;
      }

      // Solicitar aprobación al backend
      await api.post("/discount-approvals", {
        saleId: "temp", // Se generará cuando se cree la venta
        productId: discountProductId,
        originalPrice: item.unitPrice,
        discountedPrice: parseNumericInput(discountFinalPrice),
        discountReason: discountReason,
      });

      // Si la solicitud fue exitosa, aplicar el descuento con estado pendiente
      setCart(
        cart.map((item) => {
          if (item.product.id === discountProductId) {
            const newSubtotal =
              item.quantity * parseNumericInput(discountFinalPrice);
            return {
              ...item,
              discountedPrice: parseNumericInput(discountFinalPrice),
              discountReason: discountReason,
              subtotal: newSubtotal,
            };
          }
          return item;
        }),
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
  const total = subtotal;

  const addPayment = () => {
    const amount = parseNumericInput(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (paymentMethod === "ACCOUNT" && !selectedCustomer) {
      toast.error("Debes seleccionar un cliente para venta a cuenta corriente");
      return;
    }

    const newPayment: Payment = {
      method: paymentMethod,
      amount,
    };

    if (paymentMethod === "CASH_USD") {
      const usd = parseNumericInput(amountUSD);
      if (!usd || usd <= 0) {
        toast.error("Ingresa el monto en USD");
        return;
      }
      newPayment.amountUSD = usd;
    }

    if (paymentMethod === "CARD") {
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
  const change = totalPaid - total;

  const handleCheckout = useCallback(() => {
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
    const hasCashPayment = payments.some(
      (p) => p.method === "CASH_ARS" || p.method === "CASH_USD",
    );
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
        taxRate: 0,
        discountedPrice: item.discountedPrice
          ? Number(item.discountedPrice)
          : undefined,
        discountReason: item.discountReason,
        discountApprovedBy: item.discountApprovedBy,
      })),
      changeGiven: changeGiven ? parseFloat(changeGiven) : undefined,
    });
  }, [
    cart,
    payments,
    totalPaid,
    total,
    remainingAmount,
    change,
    changeGiven,
    createSaleMutation,
    selectedCustomer?.id,
  ]);

  const clearSaleDraft = useCallback(() => {
    setCart([]);
    setPayments([]);
    setPaymentAmount("");
    setAmountUSD("");
    setCardBrand("");
    setFinancialCost("");
    setPaymentNotes("");
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        const productInput = document.querySelector<HTMLInputElement>(
          '[data-barcode-scanner="true"]',
        );
        productInput?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleCheckout();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Backspace") {
        if (cart.length === 0) return;
        event.preventDefault();
        clearSaleDraft();
        toast.success("Carrito limpiado");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, clearSaleDraft, handleCheckout]);

  return (
    <div className="app-page">
      {/* Modal de fallback para tipo de cambio */}
      <ManualExchangeRateModal
        isOpen={showManualModal}
        dollarType={exchangeRate?.dollarType || "blue"}
        onCancel={handleCancel}
        onUseLastKnown={handleUseLastKnown}
        onManualInput={handleManualRate}
        lastKnownRate={lastKnownRate}
      />

      <div className="app-section">
        <Header
          title="Punto de Venta"
          description="Cobro rápido, búsqueda asistida por scanner y resumen de pagos con mejor jerarquía visual."
        />

        {/* Banner de advertencia si la cotización está desactualizada */}
        {(isStale || isFallback) && exchangeRate && (
          <div className="mb-4">
            <StaleRateBanner
              rate={exchangeRate}
              onRetry={() => refetchExchangeRate()}
              onUpdateManually={openManualModal}
              isRetrying={isLoadingRate}
            />
          </div>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Carrito activo</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{cart.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Productos preparados para cobrar en esta venta.
            </p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Total actual</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">${total.toFixed(2)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Importe listo para confirmar con medios de pago.
            </p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Estado de cobro</p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {payments.length === 0
                ? "Esperando pagos"
                : remainingAmount > 0
                  ? `Faltan $${remainingAmount.toFixed(2)}`
                  : "Listo para cobrar"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {payments.length} medio(s) cargado(s) en la venta actual.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Product Search */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="mb-3">
                  <span className="app-kicker">
                    <span className="app-brand-dot" aria-hidden="true" />
                    Scanner listo
                  </span>
                </div>
                <CardTitle>Buscar Producto</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Atajos: F2 buscar, Ctrl/Cmd + Enter cobrar, Ctrl/Cmd + Backspace limpiar carrito.
                </p>
              </CardHeader>
              <CardContent>
                <ProductSelector
                  onSelect={addToCart}
                  onBarcodeDetected={(product) => {
                    if (product.stockQuantity <= 0) {
                      toast.error(`${product.name} no tiene stock disponible`);
                      return;
                    }
                    addToCart(product);
                    toast.success(`${product.name} agregado al carrito`);
                  }}
                  onUnknownBarcode={handleUnknownBarcode}
                  showStock={true}
                  showImage={true}
                  filterActive={true}
                />
              </CardContent>
            </Card>

            {/* Cart */}
            <Card className="overflow-hidden">
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
                        className="flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <div className="text-sm text-muted-foreground">
                            {item.discountedPrice ? (
                              <>
                                <span className="line-through">
                                  ${Number(item.unitPrice).toFixed(2)}
                                </span>
                                <span className="ml-2 text-green-600 font-medium">
                                  ${Number(item.discountedPrice).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span>${Number(item.unitPrice).toFixed(2)}</span>
                            )}
                            <span className="ml-2">
                              x{" "}
                              {item.quantity.toFixed(
                                item.product.isFractional ? 2 : 0,
                              )}{" "}
                              {item.product.unit}
                            </span>
                          </div>
                          {item.discountReason && (
                            <p className="text-xs text-amber-600 mt-1">
                              Descuento: {item.discountReason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Disminuir cantidad de ${item.product.name}`}
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity -
                                  (item.product.isFractional ? 0.1 : 1),
                              )
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="text"
                            value={
                              editingQuantityId === item.product.id
                                ? editingQuantityValue
                                : item.quantity.toFixed(
                                    item.product.isFractional ? 2 : 0,
                                  )
                            }
                            onChange={(e) => {
                              setEditingQuantityId(item.product.id);
                              setEditingQuantityValue(e.target.value);
                            }}
                            onBlur={(e) => {
                              const newQty = parseNumericInput(e.target.value);
                              if (isNaN(newQty) || newQty <= 0) {
                                removeFromCart(item.product.id);
                              } else if (newQty > item.product.stockQuantity) {
                                toast.error(
                                  `Solo hay ${item.product.stockQuantity} ${item.product.unit} disponibles`,
                                );
                              } else {
                                updateQuantity(item.product.id, newQty);
                              }
                              setEditingQuantityId(null);
                              setEditingQuantityValue("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newQty = parseNumericInput(
                                  e.currentTarget.value,
                                );
                                if (isNaN(newQty) || newQty <= 0) {
                                  removeFromCart(item.product.id);
                                } else if (
                                  newQty > item.product.stockQuantity
                                ) {
                                  toast.error(
                                    `Solo hay ${item.product.stockQuantity} ${item.product.unit} disponibles`,
                                  );
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
                            aria-label={`Aumentar cantidad de ${item.product.name}`}
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity +
                                  (item.product.isFractional ? 0.1 : 1),
                              )
                            }
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
                              setDiscountFinalPrice(
                                item.discountedPrice
                                  ? String(item.discountedPrice)
                                  : String(item.unitPrice),
                              );
                              setDiscountReason(item.discountReason || "");
                              setDiscountModalOpen(true);
                            }}
                            className="h-8 text-xs"
                          >
                            {item.discountedPrice
                              ? "Editar desc."
                              : "Descuento"}
                          </Button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar ${item.product.name} del carrito`}
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
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
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="app-panel-muted rounded-[1.25rem] p-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${Number(total).toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Incluye IVA y descuentos aplicados.</p>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Items cargados</span>
                  <span className="font-medium text-foreground">{cart.length}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pagos agregados</span>
                  <span className="font-medium text-foreground">{payments.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <EntityAutocomplete<Customer>
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  fetchFn={async (search) => {
                    const response = await api.get<Customer[]>(
                      `/customers?q=${search}`,
                    );
                    return response.data || [];
                  }}
                  displayFn={(customer) =>
                    customer.type === "COMPANY"
                      ? customer.companyName || ""
                      : `${customer.firstName} ${customer.lastName}`
                  }
                  placeholder="Buscar cliente..."
                  renderItem={(customer) => (
                    <div>
                      <p className="font-medium">
                        {customer.type === "COMPANY"
                          ? customer.companyName
                          : `${customer.firstName} ${customer.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.email || customer.phone || "Sin contacto"}
                      </p>
                    </div>
                  )}
                />

                {selectedCustomer && (
                  <div className="space-y-2">
                    <div className="rounded-[1.15rem] border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] p-3 text-xs text-foreground/80">
                      <p>
                        <span className="font-semibold text-foreground">Saldo:</span> $
                        {Number(selectedCustomer.currentBalance).toFixed(2)}
                      </p>
                    </div>
                    {selectedCustomer.currentBalance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPaymentMethod("ACCOUNT");
                          setPaymentAmount(
                            selectedCustomer.currentBalance.toString(),
                          );
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

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Método de pago */}
                <div>
                  <label className="text-sm font-medium">Método de Pago</label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH_ARS">Efectivo ARS</SelectItem>
                      <SelectItem value="CASH_USD">Efectivo USD</SelectItem>
                      <SelectItem value="CARD">Tarjeta</SelectItem>
                      <SelectItem value="TRANSFER">Transferencia</SelectItem>
                      <SelectItem value="QR">QR</SelectItem>
                      <SelectItem value="ACCOUNT" disabled={!selectedCustomer}>
                        {selectedCustomer
                          ? "Cuenta Corriente"
                          : "Cuenta Corriente (requiere cliente)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Monto */}
                <div>
                  <label className="text-sm font-medium">Monto ARS</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0,00"
                    className="text-sm"
                  />
                </div>

                {/* USD específico para CASH_USD */}
                {paymentMethod === "CASH_USD" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Monto USD *</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amountUSD}
                        onChange={(e) => {
                          const usd = e.target.value;
                          setAmountUSD(usd);
                          // Calcular ARS automáticamente
                          if (usd && exchangeRate) {
                            const usdNum = parseNumericInput(usd);
                            const arsAmount = usdNum * exchangeRate.rate;
                            setPaymentAmount(arsAmount.toFixed(2));
                          } else {
                            setPaymentAmount("");
                          }
                        }}
                        placeholder="0,00"
                        className="text-sm"
                      />
                    </div>

                    {/* Calculadora automática */}
                    {amountUSD && exchangeRate && (
                      <div className="rounded-[1.2rem] border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
                          Conversión automática
                        </p>
                        <div className="space-y-1 text-xs text-foreground/80">
                          <div className="flex justify-between">
                            <span>Monto USD:</span>
                            <span className="font-medium">
                              ${parseNumericInput(amountUSD).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tipo de cambio:</span>
                            <span className="font-medium">
                              1 USD = ${exchangeRate.rate.toFixed(2)} ARS
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between border-t border-[hsl(var(--brand-accent-border))] pt-2">
                            <span>Equivalente ARS:</span>
                            <span className="font-semibold text-foreground">
                              ${paymentAmount}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span>Fuente:</span>
                            <span>
                              {exchangeRate.source === "argentinadatos"
                                ? "ArgentinaDatos"
                                : exchangeRate.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {isLoadingRate && (
                      <p className="text-xs text-muted-foreground">
                        Cargando tipo de cambio...
                      </p>
                    )}
                  </div>
                )}

                {/* Tarjeta específico para CARD */}
                {paymentMethod === "CARD" && (
                  <>
                    <div>
                      <label className="text-sm font-medium">
                        Marca de Tarjeta
                      </label>
                      <Select value={cardBrand} onValueChange={setCardBrand}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona marca" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VISA">Visa</SelectItem>
                          <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                          <SelectItem value="AMEX">American Express</SelectItem>
                          <SelectItem value="OTRO">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Costo Financiero (opcional)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={financialCost}
                        onChange={(e) => setFinancialCost(e.target.value)}
                        placeholder="0,00"
                        className="text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Notas opcionales */}
                <div>
                  <label className="text-sm font-medium">
                    Notas (opcional)
                  </label>
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
                      <p className="text-xs font-medium text-muted-foreground">
                        Pagos agregados:
                    </p>
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-[1rem] border border-border/60 bg-background/70 p-3 text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {payment.method === "CASH_ARS" && "Efectivo ARS"}
                            {payment.method === "CASH_USD" && "Efectivo USD"}
                            {payment.method === "CARD" &&
                              `Tarjeta ${payment.cardBrand}`}
                            {payment.method === "TRANSFER" && "Transferencia"}
                            {payment.method === "QR" && "QR"}
                            {payment.method === "ACCOUNT" && "Cuenta Corriente"}
                          </p>
                          {payment.method === "CASH_USD" &&
                          payment.amountUSD ? (
                            <div className="text-xs text-muted-foreground">
                              <p>
                                ${payment.amountUSD.toFixed(2)} USD → $
                                {payment.amount.toFixed(2)} ARS
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              ${payment.amount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removePayment(index)}
                          className="ml-2 rounded-sm text-red-600 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          type="button"
                          aria-label="Eliminar pago"
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
                      <span className="font-medium">
                        ${totalPaid.toFixed(2)}
                      </span>
                    </div>
                    {remainingAmount > 0 ? (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Falta pagar:</span>
                        <span className="font-medium">
                          ${remainingAmount.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Vuelto teórico:</span>
                        <span className="font-medium">
                          ${change.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Campo de vuelto entregado (solo si hay pago en efectivo y hay sobrante) */}
                    {change > 0.01 &&
                      payments.some(
                        (p) =>
                          p.method === "CASH_ARS" || p.method === "CASH_USD",
                      ) && (
                        <div className="pt-2 border-t">
                          <label className="text-sm font-medium">
                            Vuelto entregado
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={changeGiven}
                            onChange={(e) => setChangeGiven(e.target.value)}
                            placeholder={change.toFixed(2)}
                            className="text-sm mt-1"
                          />
                          {changeGiven &&
                            Math.abs(parseNumericInput(changeGiven) - change) >
                              0.01 && (
                              <p className="text-xs text-amber-600 mt-1">
                                Diferencia: $
                                {(
                                  parseNumericInput(changeGiven) - change
                                ).toFixed(2)}
                              </p>
                            )}
                        </div>
                      )}
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  disabled={
                    cart.length === 0 ||
                    payments.length === 0 ||
                    totalPaid < total ||
                    createSaleMutation.isPending
                  }
                  className="h-12 w-full bg-[hsl(var(--accent))] text-lg text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)]"
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  {createSaleMutation.isPending ? "Procesando..." : "Cobrar"}
                </Button>

                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={clearSaleDraft}
                    aria-keyshortcuts="Control+Backspace Meta+Backspace"
                    className="w-full"
                  >
                    Limpiar Carrito
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <UnknownBarcodeModal
          isOpen={unknownBarcodeModalOpen}
          barcode={unknownBarcode}
          onClose={() => {
            setUnknownBarcodeModalOpen(false);
            setUnknownBarcode("");
          }}
          onProductCreated={handleProductFromBarcode}
          onProductAssigned={handleProductFromBarcode}
        />

        {/* Modal de descuentos */}
        {discountModalOpen && discountProductId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Aplicar Descuento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const item = cart.find(
                    (i) => i.product.id === discountProductId,
                  );
                  if (!item) return null;

                  const originalPrice = Number(item.unitPrice);
                  const finalPrice = discountFinalPrice
                    ? parseNumericInput(discountFinalPrice)
                    : originalPrice;
                  const discountAmount = originalPrice - finalPrice;
                  const discountPercent = (
                    (discountAmount / originalPrice) *
                    100
                  ).toFixed(2);
                  const costPrice = Number(item.product.cost);
                  const isBelowCost = finalPrice < costPrice;

                  return (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Producto: {item.product.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Precio original: ${originalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Precio de costo: ${costPrice.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Precio final
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={discountFinalPrice}
                          onChange={(e) =>
                            setDiscountFinalPrice(e.target.value)
                          }
                          placeholder={originalPrice.toFixed(2)}
                          className="mt-1"
                        />
                      </div>

                      {discountFinalPrice && (
                        <div className="space-y-1 rounded-[1.15rem] border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] p-3">
                          <p className="text-sm">
                            <span className="font-medium">Descuento:</span> $
                            {discountAmount.toFixed(2)} ({discountPercent}%)
                          </p>
                          {isBelowCost && (
                            <p className="text-xs text-red-600 font-medium">
                              ⚠️ Precio por debajo del costo ($
                              {costPrice.toFixed(2)})
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-medium">
                          Motivo del descuento
                        </label>
                        <Select
                          value={discountReason}
                          onValueChange={setDiscountReason}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecciona un motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">
                              Selecciona un motivo
                            </SelectItem>
                            <SelectItem value="Promoción">Promoción</SelectItem>
                            <SelectItem value="Daño menor">
                              Daño menor
                            </SelectItem>
                            <SelectItem value="Otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
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
                            applyDiscount(
                              discountProductId,
                              parseNumericInput(discountFinalPrice),
                              discountReason,
                            );
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
                    <span className="font-medium">⚠️ Requiere aprobación:</span>{" "}
                    Este descuento necesita ser aprobado por un usuario con
                    permisos.
                  </p>
                </div>

                {(() => {
                  const item = cart.find(
                    (i) => i.product.id === discountProductId,
                  );
                  if (!item) return null;

                  const originalPrice = Number(item.unitPrice);
                  const finalPrice = discountFinalPrice
                    ? parseNumericInput(discountFinalPrice)
                    : originalPrice;
                  const discountAmount = originalPrice - finalPrice;
                  const discountPercent = (
                    (discountAmount / originalPrice) *
                    100
                  ).toFixed(2);

                  return (
                    <>
                      <div className="space-y-2 rounded-[1.15rem] border border-border/60 bg-background/70 p-3">
                        <p className="text-sm font-medium">
                          Producto: {item.product.name}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Precio original:
                          </span>{" "}
                          ${originalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Precio final:
                          </span>{" "}
                          ${finalPrice.toFixed(2)}
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          Descuento: ${discountAmount.toFixed(2)} (
                          {discountPercent}%)
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Motivo:</span>{" "}
                          {discountReason}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Contraseña del aprobador
                        </label>
                        <Input
                          type="password"
                          value={approverPassword}
                          onChange={(e) => setApproverPassword(e.target.value)}
                          placeholder="Ingresa la contraseña"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          El gerente/dueño debe ingresar su contraseña para
                          aprobar este descuento.
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
                          disabled={
                            discountApprovalLoading || !approverPassword
                          }
                          className="flex-1"
                        >
                          {discountApprovalLoading
                            ? "Enviando..."
                            : "Solicitar Aprobación"}
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
