"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { parseNumericInput } from "@/lib/numeric-input";

interface ReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export default function ReturnModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: ReturnModalProps) {
  const [saleId, setSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [reason, setReason] = useState("");

  // Obtener ventas confirmadas
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["sales", "confirmed"],
    queryFn: async () => {
      try {
        const response = await api.get<any>("/sales", {
          params: { status: "CONFIRMED", limit: 100 },
        });
        const salesList = Array.isArray(response.data) ? response.data : response.data?.data || [];
        return salesList;
      } catch (error) {
        console.error("Error cargando ventas:", error);
        return [];
      }
    },
    enabled: open,
  });

  // Obtener detalles de la venta seleccionada
  useEffect(() => {
    if (saleId && sales) {
      const sale = sales.find((s: any) => s.id === saleId);
      setSelectedSale(sale);
      setReturnItems([]);
    }
  }, [saleId, sales]);

  const handleAddItem = (productId: string) => {
    const existingItem = returnItems.find((item) => item.productId === productId);
    if (existingItem) {
      setReturnItems(
        returnItems.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setReturnItems([...returnItems, { productId, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (productId: string) => {
    setReturnItems(returnItems.filter((item) => item.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
    } else {
      setReturnItems(
        returnItems.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!saleId || returnItems.length === 0) {
      alert("Por favor selecciona una venta y al menos un producto a devolver");
      return;
    }

    onSubmit({
      saleId,
      items: returnItems,
      reason: reason.trim() || undefined,
    });

    // Limpiar formulario
    setSaleId("");
    setSelectedSale(null);
    setReturnItems([]);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Procesar Devolución de Cliente</DialogTitle>
          <DialogDescription>
            Selecciona una venta y los productos a devolver. Se actualizará el
            stock y la cuenta corriente del cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Venta */}
          <div className="space-y-2">
            <Label htmlFor="sale">Venta a Devolver</Label>
            {salesLoading ? (
              <LoadingSpinner text="Cargando ventas..." />
            ) : !sales || sales.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No hay ventas confirmadas disponibles para devolver.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Solo se pueden devolver productos de ventas confirmadas.
                </p>
              </div>
            ) : (
              <Select value={saleId} onValueChange={setSaleId}>
                <SelectTrigger id="sale">
                  <SelectValue placeholder="Selecciona una venta" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((sale: any) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      Venta #{sale.id.slice(0, 8)} - {sale.customer?.firstName}{" "}
                      {sale.customer?.lastName || sale.customer?.companyName || "Sin cliente"} - $
                      {sale.total.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Items de la venta */}
          {selectedSale && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos en la Venta</Label>
                <span className="text-xs text-muted-foreground">
                  {returnItems.length} de {selectedSale.items?.length || 0} seleccionados
                </span>
              </div>
              <div className="border rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto bg-white">
                {selectedSale.items?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Esta venta no tiene productos
                  </p>
                ) : (
                  selectedSale.items?.map((item: any) => {
                    const returnItem = returnItems.find(
                      (ri) => ri.productId === item.productId
                    );
                    const saleQty = item.quantity.toNumber();

                    return (
                      <div
                        key={item.productId}
                        className={`p-3 rounded-lg border transition-colors ${
                          returnItem
                            ? "bg-[hsl(var(--brand-accent-soft))] border-[hsl(var(--brand-accent-border))]"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Vendido: {saleQty.toFixed(2)} {item.product.unit}
                            </p>
                            {returnItem && (
                              <p className="mt-1 text-xs brand-accent-subtle">
                                A devolver: {returnItem.quantity.toFixed(2)} {item.product.unit}
                              </p>
                            )}
                          </div>

                          {returnItem ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex flex-col gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max={saleQty}
                                  step="0.01"
                                  value={returnItem.quantity}
                                  onChange={(e) =>
                                    handleUpdateQuantity(
                                      item.productId,
                                      parseNumericInput(e.target.value) || 0
                                    )
                                  }
                                  className="w-24 h-8 text-xs"
                                  placeholder="0"
                                />
                                <span className="text-xs text-muted-foreground text-center">
                                  máx: {saleQty.toFixed(2)}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.productId)}
                                className="h-8 w-8 p-0"
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddItem(item.productId)}
                              className="flex-shrink-0"
                            >
                              Devolver
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Selecciona los productos a devolver e ingresa la cantidad. Puedes devolver cantidades parciales.
              </p>
            </div>
          )}

          {/* Resumen de devolución */}
          {returnItems.length > 0 && (
            <div className="brand-accent-panel p-3">
              <p className="text-sm font-medium text-foreground">
                Productos a devolver: {returnItems.length}
              </p>
              <ul className="mt-1 space-y-1 text-sm brand-accent-subtle">
                {returnItems.map((item) => {
                  const saleItem = selectedSale?.items.find(
                    (si: any) => si.productId === item.productId
                  );
                  return (
                    <li key={item.productId}>
                      • {saleItem?.product.name}: {item.quantity.toFixed(2)}{" "}
                      {saleItem?.product.unit}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de la Devolución (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Describe el motivo de la devolución"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || returnItems.length === 0}>
              {isLoading ? "Procesando..." : "Procesar Devolución"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
