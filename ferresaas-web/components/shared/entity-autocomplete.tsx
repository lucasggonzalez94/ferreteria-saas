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
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sincronizar search solo cuando cambia el valor externo y el usuario no está escribiendo
  useEffect(() => {
    if (!isUserTyping && value) {
      setSearch(displayFn(value));
    } else if (!isUserTyping && !value && search) {
      setSearch("");
    }
  }, [value, isUserTyping, displayFn]);

  // Fetch entities cuando cambia el search
  useEffect(() => {
    const currentSearch = search.trim();
    if (currentSearch.length >= minSearchLength) {
      setIsLoading(true);
      fetchFn(currentSearch)
        .then((results) => {
          setEntities(results);
          if (isFocused) {
            setShowDropdown(true);
            setHighlightedIndex(results.length > 0 ? 0 : -1);
          }
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
      setHighlightedIndex(-1);
    }
  }, [search, fetchFn, minSearchLength, isFocused]);

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

  useEffect(() => {
    if (!showDropdown || highlightedIndex < 0 || !listRef.current) return;

    const activeItem = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, showDropdown]);

  const handleSelect = (entity: T) => {
    onChange(entity);
    setSearch(displayFn(entity));
    setIsUserTyping(false);
    setIsFocused(false);
    setHighlightedIndex(-1);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch("");
    setHighlightedIndex(-1);
  };

  const displayValue = search;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Input
        value={displayValue}
        onChange={(e) => {
          setIsUserTyping(true);
          const newValue = e.target.value;
          setSearch(newValue);
          if (isFocused && newValue.length >= minSearchLength) {
            setShowDropdown(true);
          }
        }}
        onKeyDown={(e) => {
          if (!showDropdown || entities.length === 0) {
            if (e.key === "Escape") {
              setShowDropdown(false);
            }
            return;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % entities.length);
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev <= 0 ? entities.length - 1 : prev - 1));
            return;
          }

          if (e.key === "Enter") {
            if (highlightedIndex >= 0 && highlightedIndex < entities.length) {
              e.preventDefault();
              handleSelect(entities[highlightedIndex]);
            }
            return;
          }

          if (e.key === "Escape") {
            e.preventDefault();
            setShowDropdown(false);
            setHighlightedIndex(-1);
          }
        }}
        onFocus={() => {
          setIsFocused(true);
          if (search.trim().length >= minSearchLength) {
            setShowDropdown(true);
            setHighlightedIndex(entities.length > 0 ? 0 : -1);
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          setTimeout(() => setIsUserTyping(false), 200);
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

      {showDropdown && (isLoading || entities.length > 0) && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-[120] mt-2 max-h-60 overflow-y-auto rounded-[1.25rem] border border-border/70 bg-popover/95 p-1.5 shadow-[0_22px_52px_-32px_rgba(12,41,69,0.6)] backdrop-blur-xl"
        >
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Buscando...
            </div>
          ) : (
            entities.map((entity, index) => (
              <button
                key={entity.id}
                data-index={index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(entity);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-[hsl(var(--brand-accent-soft))] ${
                  entities[highlightedIndex]?.id === entity.id
                    ? 'bg-[hsl(var(--brand-accent-soft))]'
                    : ''
                }`}
                type="button"
              >
                {renderItem ? renderItem(entity) : displayFn(entity)}
              </button>
            ))
          )}
        </div>
      )}

      {showDropdown && !isLoading && entities.length === 0 && search.length >= minSearchLength && (
        <div className="absolute top-full left-0 right-0 z-[120] mt-2 rounded-[1.25rem] border border-border/70 bg-popover/95 p-3 shadow-[0_22px_52px_-32px_rgba(12,41,69,0.6)] backdrop-blur-xl">
          <p className="text-sm text-muted-foreground text-center">
            No se encontraron resultados
          </p>
        </div>
      )}
    </div>
  );
}
