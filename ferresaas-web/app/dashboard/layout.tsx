"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  COMMAND_ACTIONS,
  CommandPalette,
} from "@/components/ui/command-palette";
import { BarcodeProvider } from "@/lib/contexts/barcode-context";
import { useGlobalBarcodeListener } from "@/lib/hooks/useGlobalBarcodeListener";
import { BarcodeProductModal } from "@/components/barcode/barcode-product-modal";
import { GlobalUnknownBarcodeModal } from "@/components/barcode/global-unknown-barcode-modal";
import { LogOut, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

function DashboardContent({ children }: { children: React.ReactNode }) {
  useGlobalBarcodeListener();

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Fallback client-side: redirigir a login con returnUrl
      // (El middleware ya maneja esto server-side, pero esto cubre sesión expirada)
      const loginUrl = pathname
        ? `/login?returnUrl=${encodeURIComponent(pathname)}`
        : "/login";
      router.push(loginUrl);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isEditable) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        /^[1-8]$/.test(event.key)
      ) {
        const action = COMMAND_ACTIONS[Number(event.key) - 1];
        if (!action) return;

        if (
          action.requiredPermission &&
          !user?.permissions?.includes(action.requiredPermission)
        ) {
          return;
        }

        event.preventDefault();
        if (pathname !== action.href) {
          router.push(action.href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, router, user?.permissions]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner text="Cargando..." />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <BarcodeProvider>
      <div className="min-h-screen app-shell">
        <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <div className="flex w-full items-center justify-between gap-4">
              <Link
                href="/dashboard"
                aria-label="Ir al inicio"
                className="flex min-w-0 items-center gap-3 px-1 py-2"
              >
                <Image
                  src="/icons/logo-principal-oscuro.png"
                  alt="Ferrahock"
                  width={198}
                  height={66}
                  className="h-10 w-auto dark:hidden"
                  priority
                />
                <Image
                  src="/icons/logo-principal-blanco.png"
                  alt="Ferrahock"
                  width={198}
                  height={66}
                  className="hidden h-10 w-auto dark:block"
                  priority
                />
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Tooltip content="Ir rapido (Ctrl/Cmd + K)">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Abrir navegación rápida"
                    aria-keyshortcuts="Control+K Meta+K"
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="rounded-full px-4"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden md:inline">Buscar modulo</span>
                    <span className="hidden lg:inline text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Ctrl + K
                    </span>
                  </Button>
                </Tooltip>
                <Link href="/dashboard/settings">
                  <Tooltip content="Configuración">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Abrir configuracion"
                      className="rounded-full"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </Link>
                <Link href="/dashboard/settings/profile">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-2 px-4"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {user?.firstName || user?.email}
                    </span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="rounded-full gap-2 px-4"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            </div>
          </div>
        </header>
        <DashboardContent>{children}</DashboardContent>
        <CommandPalette
          permissions={user?.permissions || []}
          isOpen={isCommandPaletteOpen}
          onOpenChange={setIsCommandPaletteOpen}
        />
        <BarcodeProductModal />
        <GlobalUnknownBarcodeModal />
      </div>
    </BarcodeProvider>
  );
}
