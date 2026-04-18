"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const RECENT_ACTIONS_STORAGE_KEY = "command-palette-recent-actions";
const MAX_RECENT_ACTIONS = 5;

type CommandAction = {
  id: string;
  label: string;
  href: string;
  category: "General" | "Ventas" | "Inventario" | "Analitica" | "Sistema";
  keywords: string[];
  shortcut?: string;
  requiredPermission?: string;
};

interface CommandPaletteProps {
  permissions: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const COMMAND_ACTIONS: CommandAction[] = [
  {
    id: "dashboard",
    label: "Ir a Dashboard",
    href: "/dashboard",
    category: "General",
    keywords: ["inicio", "home", "resumen"],
    shortcut: "Alt + 1",
  },
  {
    id: "pos",
    label: "Ir a Punto de Venta",
    href: "/dashboard/pos",
    category: "Ventas",
    keywords: ["ventas", "cobrar", "caja"],
    shortcut: "Alt + 2",
    requiredPermission: "sales:create",
  },
  {
    id: "products",
    label: "Ir a Productos",
    href: "/dashboard/products",
    category: "Inventario",
    keywords: ["catalogo", "inventario", "stock"],
    shortcut: "Alt + 3",
    requiredPermission: "products:read",
  },
  {
    id: "customers",
    label: "Ir a Clientes",
    href: "/dashboard/customers",
    category: "Ventas",
    keywords: ["cliente", "cuentas"],
    shortcut: "Alt + 4",
    requiredPermission: "customers:read",
  },
  {
    id: "cash-register",
    label: "Ir a Caja",
    href: "/dashboard/cash-register",
    category: "Ventas",
    keywords: ["apertura", "cierre", "arqueo"],
    shortcut: "Alt + 5",
    requiredPermission: "cash_register:read",
  },
  {
    id: "purchases",
    label: "Ir a Compras",
    href: "/dashboard/purchases",
    category: "Inventario",
    keywords: ["proveedores", "orden"],
    shortcut: "Alt + 6",
    requiredPermission: "purchases:read",
  },
  {
    id: "reports",
    label: "Ir a Reportes",
    href: "/dashboard/reports",
    category: "Analitica",
    keywords: ["estadisticas", "analitica"],
    shortcut: "Alt + 7",
    requiredPermission: "reports:read",
  },
  {
    id: "settings",
    label: "Ir a Configuración",
    href: "/dashboard/settings",
    category: "Sistema",
    keywords: ["ajustes", "preferencias"],
    shortcut: "Alt + 8",
  },
];

export function CommandPalette({ permissions, isOpen, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentActionIds, setRecentActionIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const router = useRouter();
  const pathname = usePathname();
  const normalizedQuery = query.trim().toLowerCase();

  const availableActions = useMemo(
    () =>
      COMMAND_ACTIONS.filter(
        (action) => !action.requiredPermission || permissions.includes(action.requiredPermission),
      ),
    [permissions],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_ACTIONS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;

      const validIds = parsed.filter((item): item is string => typeof item === "string");
      setRecentActionIds(validIds.slice(0, MAX_RECENT_ACTIONS));
    } catch {
      // no-op
    }
  }, []);

  const visibleActions = useMemo(() => {
    return availableActions.filter((action) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [action.label, action.href, ...action.keywords].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [availableActions, normalizedQuery]);

  const recentActions = useMemo(() => {
    if (normalizedQuery) return [];

    return recentActionIds
      .map((id) => visibleActions.find((action) => action.id === id))
      .filter((action): action is CommandAction => Boolean(action));
  }, [normalizedQuery, recentActionIds, visibleActions]);

  const groupedActions = useMemo(() => {
    const groups = new Map<string, CommandAction[]>();

    if (recentActions.length > 0) {
      groups.set("Recientes", recentActions);
    }

    visibleActions.forEach((action) => {
      if (recentActions.some((recent) => recent.id === action.id)) {
        return;
      }
      const existing = groups.get(action.category) || [];
      existing.push(action);
      groups.set(action.category, existing);
    });
    return Array.from(groups.entries());
  }, [recentActions, visibleActions]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (visibleActions.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((prev) => Math.min(prev, visibleActions.length - 1));
  }, [visibleActions]);

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const executeAction = (
    action: CommandAction,
    options?: {
      openInNewTab?: boolean;
    },
  ) => {
    const updatedRecentIds = [action.id, ...recentActionIds.filter((id) => id !== action.id)].slice(
      0,
      MAX_RECENT_ACTIONS,
    );
    setRecentActionIds(updatedRecentIds);
    try {
      window.localStorage.setItem(
        RECENT_ACTIONS_STORAGE_KEY,
        JSON.stringify(updatedRecentIds),
      );
    } catch {
      // no-op
    }

    onOpenChange(false);
    if (options?.openInNewTab) {
      window.open(action.href, "_blank", "noopener,noreferrer");
      return;
    }

    if (pathname !== action.href) {
      router.push(action.href);
    }
  };

  const getHighlightedText = (text: string) => {
    if (!normalizedQuery) {
      return text;
    }

    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === normalizedQuery;
      if (!isMatch) {
        return <span key={`${text}-${index}`}>{part}</span>;
      }

      return (
        <mark key={`${text}-${index}`} className="rounded bg-yellow-200/70 px-0.5 text-foreground">
          {part}
        </mark>
      );
    });
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    action: CommandAction,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % visibleActions.length;
      setActiveIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = (index - 1 + visibleActions.length) % visibleActions.length;
      setActiveIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      itemRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const lastIndex = visibleActions.length - 1;
      setActiveIndex(lastIndex);
      itemRefs.current[lastIndex]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      executeAction(action, { openInNewTab: true });
      return;
    }

    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  const handleOptionClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: CommandAction,
  ) => {
    executeAction(action, {
      openInNewTab: event.ctrlKey || event.metaKey,
    });
  };

  const handleOptionAuxClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: CommandAction,
  ) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    executeAction(action, { openInNewTab: true });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleActions.length === 0 && event.key !== "Escape") {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % visibleActions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + visibleActions.length) % visibleActions.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(visibleActions.length - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      executeAction(visibleActions[activeIndex], {
        openInNewTab: event.ctrlKey || event.metaKey,
      });
      return;
    }

    if (event.key === "Tab" && visibleActions.length > 0) {
      event.preventDefault();
      itemRefs.current[activeIndex]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.altKey && /^[1-8]$/.test(event.key)) {
      const targetShortcut = `Alt + ${event.key}`;
      const shortcutAction = availableActions.find((action) => action.shortcut === targetShortcut);
      if (shortcutAction) {
        event.preventDefault();
        executeAction(shortcutAction);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Navegación rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Escribe un módulo o acción..."
            aria-label="Buscar acción"
            aria-controls="command-palette-list"
            aria-activedescendant={visibleActions[activeIndex] ? `command-option-${visibleActions[activeIndex].id}` : undefined}
          />

          <p className="text-xs text-muted-foreground">
            Atajos: Ctrl/Cmd + K abrir, Alt + 1..8 ejecutar acción, Ctrl/Cmd + Enter abrir en nueva pestaña.
          </p>

          <div
            id="command-palette-list"
            role="listbox"
            className="max-h-80 overflow-y-auto rounded-[1.25rem] border border-border/70 bg-background/55 p-1 backdrop-blur-md"
          >
            {visibleActions.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No se encontraron acciones.</p>
            ) : (
              <div className="p-1">
                {groupedActions.map(([category, actions]) => (
                  <div key={category} className="pb-2 last:pb-0">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </p>
                    {actions.map((action) => {
                      const index = visibleActions.findIndex((item) => item.id === action.id);
                      return (
                        <button
                          key={action.id}
                          type="button"
                          id={`command-option-${action.id}`}
                          ref={(element) => {
                            itemRefs.current[index] = element;
                          }}
                          role="option"
                          aria-selected={activeIndex === index}
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            activeIndex === index
                              ? "bg-[hsl(var(--brand-accent-soft))] text-foreground"
                              : "hover:bg-[hsl(var(--brand-accent-soft))] hover:text-foreground"
                           }`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onKeyDown={(event) => handleOptionKeyDown(event, index, action)}
                          onClick={(event) => handleOptionClick(event, action)}
                          onAuxClick={(event) => handleOptionAuxClick(event, action)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{getHighlightedText(action.label)}</span>
                            {action.shortcut && (
                              <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {action.shortcut}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{getHighlightedText(action.href)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
