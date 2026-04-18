"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";

type ActionItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
};

interface ActionsMenuProps {
  actions: ActionItem[];
}

export function ActionsMenu({ actions }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full border border-transparent bg-background/60 text-muted-foreground shadow-none hover:border-border/70 hover:bg-[hsl(var(--brand-accent-soft))] hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        type="button"
        aria-label="Abrir menú de acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-[0_22px_52px_-32px_rgba(12,41,69,0.6)] backdrop-blur-xl"
        >
          {actions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[hsl(var(--brand-accent-soft))] ${
                action.variant === "danger" ? "text-red-600 dark:text-red-400" : ""
              } ${action.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                action.onClick();
              }}
              disabled={action.disabled}
              role="menuitem"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
