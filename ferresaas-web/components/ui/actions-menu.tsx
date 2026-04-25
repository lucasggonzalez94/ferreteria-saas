"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  if (actions.length === 0) {
    return null;
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border border-transparent bg-background/60 text-muted-foreground shadow-none hover:border-border/70 hover:bg-[hsl(var(--brand-accent-soft))] hover:text-foreground"
            type="button"
            aria-label="Abrir menú de acciones"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-2xl border-border/70 bg-popover/95 p-1.5 shadow-[0_22px_52px_-32px_rgba(12,41,69,0.6)] backdrop-blur-xl"
        >
          {actions.map((action, idx) => (
            <DropdownMenuItem
              key={`${action.label}-${idx}`}
              disabled={action.disabled}
              className={`rounded-xl px-3 py-2.5 ${
                action.variant === "danger"
                  ? "text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
