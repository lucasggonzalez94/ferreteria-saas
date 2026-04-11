"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useBarcodeDetection } from "@/lib/hooks/useBarcodeDetection";
import type { Product } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProductSelectorProps {
  onSelect: (product: Product) => void;
  onBarcodeDetected?: (product: Product) => void;
  onUnknownBarcode?: (barcode: string) => void;
  showStock?: boolean;
  showImage?: boolean;
  filterActive?: boolean;
  placeholder?: string;
  className?: string;
  minSearchLength?: number;
}

/**
 * Componente reutilizable para buscar y seleccionar productos.
 * Soporta detección automática de escaneos de código de barras.
 * Usado en POS, compras, inventario, etc.
 *
 * @example
 * <ProductSelector
 *   onSelect={(product) => console.log('búsqueda manual', product)}
 *   onBarcodeDetected={(product) => addToCart(product)}
 *   showStock={true}
 *   showImage={true}
 *   filterActive={true}
 * />
 */
export function ProductSelector({
  onSelect,
  onBarcodeDetected,
  onUnknownBarcode,
  showStock = true,
  showImage = false,
  filterActive = true,
  placeholder = "Buscar por nombre, SKU o código...",
  className = "",
  minSearchLength = 2,
}: ProductSelectorProps) {
  const [search, setSearch] = useState("");
  const [lastBarcodeDetected, setLastBarcodeDetected] = useState(false);
  const { handleInputChange, reset } = useBarcodeDetection();
  const inputBufferRef = useRef<string>("");
  const inputStartTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-search", search, filterActive],
    queryFn: async () => {
      if (!search || search.length < minSearchLength) return [];
      const response = await api.get<Product[]>("/products", {
        params: {
          q: search,
          active: filterActive ? true : undefined,
        },
      });
      return response.data || [];
    },
    enabled: search.length >= minSearchLength,
  });

  // Listener global de teclado para capturar escaneos sin foco en el input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en otro input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const key = event.key;

      if (key === "Enter") {
        if (inputBufferRef.current.length >= 8) {
          const barcode = inputBufferRef.current;
          setSearch(barcode);
          setLastBarcodeDetected(true);
        }
        inputBufferRef.current = "";
        inputStartTimeRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        return;
      }

      if (key.length === 1) {
        if (inputBufferRef.current.length === 0) {
          inputStartTimeRef.current = now;
        }

        inputBufferRef.current += key;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          const timeSinceStart = now - (inputStartTimeRef.current || now);

          if (inputBufferRef.current.length >= 8 && timeSinceStart < 500) {
            const barcode = inputBufferRef.current;
            setSearch(barcode);
            setLastBarcodeDetected(true);
          }

          inputBufferRef.current = "";
          inputStartTimeRef.current = null;
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Procesar automáticamente cuando se detecta un escaneo
  useEffect(() => {
    if (!lastBarcodeDetected || isLoading) return;

    if (products && products.length === 1 && onBarcodeDetected) {
      const product = products[0];
      onBarcodeDetected(product);
      setSearch("");
      reset();
      setLastBarcodeDetected(false);
      return;
    }

    if (products && products.length === 0 && search && onUnknownBarcode) {
      const barcodeScanned = search;
      onUnknownBarcode(barcodeScanned);
      setSearch("");
      reset();
      setLastBarcodeDetected(false);
    }
  }, [
    lastBarcodeDetected,
    isLoading,
    products,
    search,
    onBarcodeDetected,
    onUnknownBarcode,
    reset,
  ]);

  const handleInputChange_Internal = (value: string) => {
    setSearch(value);
    const { isBarcodeScan } = handleInputChange(value);

    // Si se detectó un escaneo, marcar para procesamiento cuando los resultados lleguen
    if (isBarcodeScan && value.length >= 8) {
      setLastBarcodeDetected(true);
    }
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearch("");
    reset();
  };

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => handleInputChange_Internal(e.target.value)}
          className="pl-10"
          autoFocus
          data-barcode-scanner="true"
        />
      </div>

      {/* Search Results */}
      {products && products.length > 0 && (
        <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className="w-full p-3 border rounded-lg text-left transition-colors bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex gap-3 items-center">
                {showImage && product.imageUrl && (
                  <Image
                    src={
                      product.imageUrl.startsWith("http")
                        ? product.imageUrl
                        : `${API_BASE}${product.imageUrl}`
                    }
                    alt={product.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-slate-700 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU: {product.internalSku}
                    {showStock && (
                      <>
                        {" "}
                        | Stock: {product.stockQuantity} {product.unit}
                      </>
                    )}
                  </p>
                  <p className="font-semibold mt-1 text-foreground">
                    ${Number(product.price).toFixed(2)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoading && search.length >= minSearchLength && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Buscando productos...
        </div>
      )}

      {!isLoading &&
        search.length >= minSearchLength &&
        products?.length === 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            No se encontraron productos
          </div>
        )}
    </div>
  );
}
