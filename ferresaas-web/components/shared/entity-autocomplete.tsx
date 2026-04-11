"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface EntityAutocompleteProps<T> {
  value: T | null;
  onChange: (entity: T | null) => void;
  fetchFn: (search: string) => Promise<T[]>;
  displayFn: (entity: T) => string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  renderItem?: (entity: T) => React.ReactNode;
  minSearchLength?: number;
}

/**
 * Componente de autocompletado genérico para entidades (clientes, proveedores, etc.)
 * 
 * @example
 * <EntityAutocomplete
 *   value={selectedCustomer}
 *   onChange={setSelectedCustomer}
 *   fetchFn={async (search) => {
 *     const res = await api.get(`/customers?q=${search}`);
 *     return res.data;
 *   }}
 *   displayFn={(customer) => 
 *     customer.type === 'COMPANY' 
 *       ? customer.companyName 
 *       : `${customer.firstName} ${customer.lastName}`
 *   }
 *   placeholder="Buscar cliente..."
 * />
 */
export function EntityAutocomplete<T extends { id: string }>({
  value,
  onChange,
  fetchFn,
  displayFn,
  placeholder = "Buscar...",
  className = "",
  disabled = false,
  renderItem,
  minSearchLength = 1,
}: EntityAutocompleteProps<T>) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [entities, setEntities] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch entities cuando cambia el search
  useEffect(() => {
    if (search.length >= minSearchLength && !value) {
      setIsLoading(true);
      fetchFn(search)
        .then((results) => {
          setEntities(results);
          setShowDropdown(true);
        })
        .catch((error) => {
          console.error("Error fetching entities:", error);
          setEntities([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setEntities([]);
      setShowDropdown(false);
    }
  }, [search, value, fetchFn, minSearchLength]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (entity: T) => {
    onChange(entity);
    setSearch("");
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch("");
  };

  const displayValue = value ? displayFn(value) : search;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Input
        value={displayValue}
        onChange={(e) => {
          if (!value) {
            setSearch(e.target.value);
          }
        }}
        onFocus={() => {
          if (!value && search.length >= minSearchLength) {
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
      />

      {value && !disabled && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          type="button"
          aria-label="Limpiar selección"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && entities.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Buscando...
            </div>
          ) : (
            entities.map((entity) => (
              <button
                key={entity.id}
                onClick={() => handleSelect(entity)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-b-0 text-sm transition-colors text-foreground"
                type="button"
              >
                {renderItem ? renderItem(entity) : displayFn(entity)}
              </button>
            ))
          )}
        </div>
      )}

      {showDropdown && !isLoading && entities.length === 0 && search.length >= minSearchLength && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 p-3">
          <p className="text-sm text-muted-foreground text-center">
            No se encontraron resultados
          </p>
        </div>
      )}
    </div>
  );
}
