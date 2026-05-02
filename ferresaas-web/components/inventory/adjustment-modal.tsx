"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { parseNumericInput } from "@/lib/numeric-input";
import { X, BarcodeIcon } from "lucide-react";
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner";

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
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const findProductByBarcode = useCallback((barcode: string) => {
    return products?.find((product: any) => product.barcode === barcode);
  }, [products]);

  const { clearBuffer: clearBarcodeBuffer } = useBarcodeScanner({
    minLength: 8,
    maxTimeBetweenChars: 300,
    onBarcodeDetected: (barcode) => {
      const product = findProductByBarcode(barcode);
      if (product) {
        setSelectedProduct(product);
        setProductId(product.id);
        setProductSearch("");
        setProductDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    },
    enabled: open,
    excludeInputs: false,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProductSearch(e.target.value);
    setProductDropdownOpen(true);
  };

  const filteredProducts = products?.filter((product: any) => {
    if (!productSearch) return true;
    const searchLower = productSearch.toLowerCase();
    return (
      product.name?.toLowerCase().includes(searchLower) ||
      product.internalSku?.toLowerCase().includes(searchLower) ||
      product.barcode?.toLowerCase().includes(searchLower)
    );
  }) || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
    };
    if (productDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [productDropdownOpen]);

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setProductId(product.id);
    setProductSearch("");
    setProductDropdownOpen(false);
    searchInputRef.current?.blur();
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductId("");
    setProductSearch("");
    searchInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId || !quantity || !reason.trim()) {
      alert("Por favor completa todos los campos");
      return;
    }

    const qty = parseNumericInput(quantity);
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
    setSelectedProduct(null);
    setProductSearch("");
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
              <div ref={dropdownRef} className="relative">
                {selectedProduct ? (
                  <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                    <span className="truncate">
                      {selectedProduct.internalSku} - {selectedProduct.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearProduct}
                      className="h-6 p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      ref={searchInputRef}
                      id="product"
                      placeholder="Buscar por nombre, SKU o escanear código..."
                      value={productSearch}
                      onChange={handleSearchChange}
                      onFocus={() => setProductDropdownOpen(true)}
                      className="pr-10"
                    />
                    <BarcodeIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {productDropdownOpen && filteredProducts.length > 0 && !selectedProduct && (
                  <div className="absolute z-50 w-full mt-1 py-1 border rounded-md bg-background shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredProducts.slice(0, 20).map((product: any) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <span className="font-medium">{product.internalSku}</span>
                        <span className="mx-2">-</span>
                        <span>{product.name}</span>
                      </button>
                    ))}
                    {filteredProducts.length > 20 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Mostrando 20 de {filteredProducts.length} productos
                      </p>
                    )}
                  </div>
                )}
              </div>
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
