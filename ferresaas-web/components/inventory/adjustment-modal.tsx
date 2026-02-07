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

interface AdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export default function AdjustmentModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AdjustmentModalProps) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      try {
        const response = await api.get<any>("/products");
        const productList = Array.isArray(response.data) ? response.data : response.data?.data || [];
        return productList;
      } catch (error) {
        console.error("Error cargando productos:", error);
        return [];
      }
    },
    enabled: open,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId || !quantity || !reason.trim()) {
      alert("Por favor completa todos los campos");
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      alert("La cantidad debe ser un número válido diferente de 0");
      return;
    }

    onSubmit({
      productId,
      quantity: qty,
      reason: reason.trim(),
    });

    // Limpiar formulario
    setProductId("");
    setQuantity("");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajuste Manual de Inventario</DialogTitle>
          <DialogDescription>
            Registra un ajuste manual de stock. Puede ser positivo (entrada) o
            negativo (salida).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Producto */}
          <div className="space-y-2">
            <Label htmlFor="product">Producto</Label>
            {productsLoading ? (
              <LoadingSpinner text="Cargando productos..." />
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.internalSku} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Cantidad (positivo: entrada, negativo: salida)
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="Ej: 10 o -5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo del Ajuste</Label>
            <Textarea
              id="reason"
              placeholder="Describe el motivo del ajuste (ej: Inventario físico, Daño, Pérdida, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Registrar Ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
