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
      <Button variant="outline" size="icon" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Tooltip
      content={
        (resolvedTheme || theme) === "dark"
          ? "Cambiar a modo claro"
          : "Cambiar a modo oscuro"
      }
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() =>
          setTheme((resolvedTheme || theme) === "dark" ? "light" : "dark")
        }
      >
        {(resolvedTheme || theme) === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>
    </Tooltip>
  );
}
