"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CommandAction = {
  id: string;
  label: string;
  href: string;
  keywords: string[];
  requiredPermission?: string;
};

interface CommandPaletteProps {
  permissions: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMAND_ACTIONS: CommandAction[] = [
  {
    id: "dashboard",
    label: "Ir a Dashboard",
    href: "/dashboard",
    keywords: ["inicio", "home", "resumen"],
  },
  {
    id: "pos",
    label: "Ir a Punto de Venta",
    href: "/dashboard/pos",
    keywords: ["ventas", "cobrar", "caja"],
    requiredPermission: "sales:create",
  },
  {
    id: "products",
    label: "Ir a Productos",
    href: "/dashboard/products",
    keywords: ["catalogo", "inventario", "stock"],
    requiredPermission: "products:read",
  },
  {
    id: "customers",
    label: "Ir a Clientes",
    href: "/dashboard/customers",
    keywords: ["cliente", "cuentas"],
    requiredPermission: "customers:read",
  },
  {
    id: "cash-register",
    label: "Ir a Caja",
    href: "/dashboard/cash-register",
    keywords: ["apertura", "cierre", "arqueo"],
    requiredPermission: "cash_register:read",
  },
  {
    id: "purchases",
    label: "Ir a Compras",
    href: "/dashboard/purchases",
    keywords: ["proveedores", "orden"],
    requiredPermission: "purchases:read",
  },
  {
    id: "reports",
    label: "Ir a Reportes",
    href: "/dashboard/reports",
    keywords: ["estadisticas", "analitica"],
    requiredPermission: "reports:read",
  },
  {
    id: "settings",
    label: "Ir a Configuración",
    href: "/dashboard/settings",
    keywords: ["ajustes", "preferencias"],
  },
];

export function CommandPalette({ permissions, isOpen, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const visibleActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return COMMAND_ACTIONS.filter((action) => {
      if (action.requiredPermission && !permissions.includes(action.requiredPermission)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [action.label, action.href, ...action.keywords].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [permissions, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const executeAction = (href: string) => {
    onOpenChange(false);
    if (pathname !== href) {
      router.push(href);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Navegar rápido</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribe un módulo o acción..."
            aria-label="Buscar acción"
          />

          <p className="text-xs text-muted-foreground">Atajo: Ctrl/Cmd + K</p>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {visibleActions.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No se encontraron acciones.</p>
            ) : (
              <div className="p-1">
                {visibleActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => executeAction(action.href)}
                  >
                    <span className="font-medium">{action.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{action.href}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
