"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Product } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProductSelectorProps {
  onSelect: (product: Product) => void;
  showStock?: boolean;
  showImage?: boolean;
  filterActive?: boolean;
  placeholder?: string;
  className?: string;
  minSearchLength?: number;
}

/**
 * Componente reutilizable para buscar y seleccionar productos.
 * Usado en POS, compras, inventario, etc.
 * 
 * @example
 * <ProductSelector
 *   onSelect={(product) => addToCart(product)}
 *   showStock={true}
 *   showImage={true}
 *   filterActive={true}
 * />
 */
export function ProductSelector({
  onSelect,
  showStock = true,
  showImage = false,
  filterActive = true,
  placeholder = "Buscar por nombre, SKU o código...",
  className = "",
  minSearchLength = 2,
}: ProductSelectorProps) {
  const [search, setSearch] = useState("");

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

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearch("");
  };

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
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
              onClick={() => handleSelect(product)}
              className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex gap-3 items-center">
                {showImage && product.imageUrl && (
                  <img
                    src={
                      product.imageUrl.startsWith("http")
                        ? product.imageUrl
                        : `${API_BASE}${product.imageUrl}`
                    }
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU: {product.internalSku}
                    {showStock && (
                      <>
                        {" "}
                        | Stock: {product.stockQuantity} {product.unit}
                      </>
                    )}
                  </p>
                  <p className="font-semibold mt-1">
                    ${Number(product.price).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
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
