"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { parseNumericInput } from "@/lib/numeric-input";

const REFUND_METHODS = [
  "CASH_ARS",
  "CASH_USD",
  "CARD",
  "TRANSFER",
  "QR",
  "ACCOUNT",
] as const;

const METHOD_LABELS: Record<(typeof REFUND_METHODS)[number], string> = {
  CASH_ARS: "Efectivo ARS",
  CASH_USD: "Efectivo USD",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  QR: "QR",
  ACCOUNT: "Cuenta corriente",
};

interface SaleItemView {
  id: string;
  quantity: number;
  subtotal: number;
  product: {
    id: string;
    name: string;
    unit: string;
  };
}

interface SalePaymentView {
  method: string;
  amount: number;
}

interface SaleRefundItemView {
  saleItemId: string;
  quantity: number;
}

interface SaleRefundView {
  items: SaleRefundItemView[];
}

interface SaleView {
  items: SaleItemView[];
  payments: SalePaymentView[];
  refunds?: SaleRefundView[];
}

interface RefundPayload {
  items: Array<{ saleItemId: string; quantity: number }>;
  refundPayments: Array<{ method: string; amount: number; notes?: string }>;
  reason: string;
  notes?: string;
}

interface RefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleView;
  isLoading: boolean;
  onSubmit: (payload: RefundPayload) => void;
}

function buildDefaultPayout(payments: SalePaymentView[], totalRefund: number) {
  const normalized = payments.filter((payment) => Number(payment.amount || 0) > 0);
  if (normalized.length === 0 || totalRefund <= 0) {
    return [] as Array<{ method: string; amount: number; notes?: string }>;
  }

  const totalPaid = normalized.reduce((sum, payment) => sum + Number(payment.amount), 0);
  let remaining = totalRefund;

  return normalized.map((payment, index) => {
    if (index === normalized.length - 1) {
      return {
        method: payment.method,
        amount: Number(Math.max(remaining, 0).toFixed(2)),
      };
    }

    const amount = Number(((Number(payment.amount) / totalPaid) * totalRefund).toFixed(2));
    remaining -= amount;
    return { method: payment.method, amount };
  });
}

export function RefundModal({
  open,
  onOpenChange,
  sale,
  isLoading,
  onSubmit,
}: RefundModalProps) {
  const refundedQtyBySaleItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const refund of sale.refunds || []) {
      for (const item of refund.items || []) {
        const current = map.get(item.saleItemId) || 0;
        map.set(item.saleItemId, current + Number(item.quantity || 0));
      }
    }
    return map;
  }, [sale.refunds]);

  const initialItemState = useMemo(
    () => sale.items.map((item) => ({ saleItemId: item.id, quantity: 0 })),
    [sale.items]
  );

  const [items, setItems] = useState(initialItemState);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundPayments, setRefundPayments] = useState<Array<{ method: string; amount: number; notes?: string }>>([]);
  const [paymentCustomized, setPaymentCustomized] = useState(false);

  const selectedItems = useMemo(() => items.filter((item) => item.quantity > 0), [items]);

  const refundTotal = useMemo(() => {
    return Number(
      selectedItems
        .reduce((sum, selected) => {
          const saleItem = sale.items.find((item) => item.id === selected.saleItemId);
          if (!saleItem) return sum;
          const soldQty = Number(saleItem.quantity);
          const unitPrice = soldQty > 0 ? Number(saleItem.subtotal) / soldQty : 0;
          return sum + unitPrice * selected.quantity;
        }, 0)
        .toFixed(2)
    );
  }, [selectedItems, sale.items]);

  useEffect(() => {
    if (!open) return;
    if (paymentCustomized) return;
    setRefundPayments(buildDefaultPayout(sale.payments, refundTotal));
  }, [open, paymentCustomized, refundTotal, sale.payments]);

  useEffect(() => {
    if (!open) return;
    setItems(initialItemState);
    setReason("");
    setNotes("");
    setRefundPayments([]);
    setPaymentCustomized(false);
  }, [open, initialItemState]);

  const updateItemQuantity = (saleItemId: string, value: string) => {
    const quantity = parseNumericInput(value) || 0;
    const saleItem = sale.items.find((item) => item.id === saleItemId);
    if (!saleItem) return;
    const soldQty = Number(saleItem.quantity);
    const refundedQty = refundedQtyBySaleItem.get(saleItemId) || 0;
    const maxRefundableQty = Math.max(soldQty - refundedQty, 0);

    const normalizedQty = Math.min(Math.max(quantity, 0), maxRefundableQty);

    setItems((current) =>
      current.map((item) =>
        item.saleItemId === saleItemId
          ? {
              ...item,
              quantity: Number(normalizedQty.toFixed(3)),
            }
          : item
      )
    );
  };

  const paymentTotal = Number(
    refundPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2)
  );

  const isPaymentBalanced = Math.abs(paymentTotal - refundTotal) <= 0.01;

  const handleSubmit = () => {
    if (selectedItems.length === 0) return;
    if (reason.trim().length < 3) return;
    if (!isPaymentBalanced || refundPayments.length === 0) return;

    onSubmit({
      items: selectedItems,
      refundPayments: refundPayments
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => ({
          method: payment.method,
          amount: Number(Number(payment.amount).toFixed(2)),
          notes: payment.notes?.trim() || undefined,
        })),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolucion monetaria</DialogTitle>
          <DialogDescription>
            Selecciona los items a devolver y confirma como se reintegrara el dinero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Items de la venta</Label>
            <div className="space-y-2 rounded-md border p-3">
              {sale.items.map((item) => {
                const selected = items.find((row) => row.saleItemId === item.id);
                const soldQty = Number(item.quantity);
                const refundedQty = refundedQtyBySaleItem.get(item.id) || 0;
                const maxRefundableQty = Math.max(soldQty - refundedQty, 0);
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Vendido: {soldQty.toFixed(3)} {item.product.unit} | Disponible: {maxRefundableQty.toFixed(3)} {item.product.unit}
                      </p>
                    </div>
                    <div className="col-span-3 text-right text-sm text-muted-foreground">
                      ${Number(item.subtotal).toFixed(2)}
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        max={maxRefundableQty}
                        step="0.001"
                        value={selected?.quantity ?? 0}
                        onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Metodos de reintegro</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRefundPayments(buildDefaultPayout(sale.payments, refundTotal));
                    setPaymentCustomized(false);
                  }}
                >
                  Restaurar sugerido
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRefundPayments((current) => [...current, { method: "CASH_ARS", amount: 0 }]);
                    setPaymentCustomized(true);
                  }}
                >
                  Agregar metodo
                </Button>
              </div>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              {refundPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay metodos de reintegro configurados.</p>
              ) : (
                refundPayments.map((payment, index) => (
                  <div key={`${payment.method}-${index}`} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select
                        value={payment.method}
                        onValueChange={(method) => {
                          setRefundPayments((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    method,
                                  }
                                : row
                            )
                          );
                          setPaymentCustomized(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Metodo" />
                        </SelectTrigger>
                        <SelectContent>
                          {REFUND_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {METHOD_LABELS[method]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount}
                        onChange={(event) => {
                          const amount = parseNumericInput(event.target.value) || 0;
                          setRefundPayments((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    amount,
                                  }
                                : row
                            )
                          );
                          setPaymentCustomized(true);
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRefundPayments((current) => current.filter((_, rowIndex) => rowIndex !== index));
                          setPaymentCustomized(true);
                        }}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <div className="pt-2 text-sm">
                <p className="font-medium">Total a devolver: ${refundTotal.toFixed(2)}</p>
                <p className={isPaymentBalanced ? "text-green-600" : "text-red-600"}>
                  Total distribuido: ${paymentTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Motivo</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej: Producto defectuoso"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-notes">Notas (opcional)</Label>
            <Textarea
              id="refund-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isLoading ||
              selectedItems.length === 0 ||
              reason.trim().length < 3 ||
              !isPaymentBalanced ||
              refundPayments.length === 0
            }
          >
            {isLoading ? "Procesando..." : "Confirmar devolucion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
