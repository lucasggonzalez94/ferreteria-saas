"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "./tooltip";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" disabled aria-label="Cargando tema" className="rounded-full">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const isDark = (resolvedTheme || theme) === "dark";
  const toggleLabel = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <Tooltip
      content={toggleLabel}
    >
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label={toggleLabel}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>
    </Tooltip>
  );
}
