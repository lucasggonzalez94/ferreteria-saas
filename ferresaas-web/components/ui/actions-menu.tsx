"use client";

import { useEffect, useRef, useState } from "react";
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
        className="h-6 w-6 rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        type="button"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-md border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md z-10">
          {actions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 ${
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
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
