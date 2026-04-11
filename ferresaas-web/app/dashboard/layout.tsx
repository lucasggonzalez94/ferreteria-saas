"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { COMMAND_ACTIONS, CommandPalette } from "@/components/ui/command-palette";
import { useConnectionStatus } from "@/lib/hooks/useConnectionStatus";
import { BarcodeProvider } from "@/lib/contexts/barcode-context";
import { useGlobalBarcodeListener } from "@/lib/hooks/useGlobalBarcodeListener";
import { BarcodeProductModal } from "@/components/barcode/barcode-product-modal";
import { GlobalUnknownBarcodeModal } from "@/components/barcode/global-unknown-barcode-modal";
import { LogOut, Search, Settings, User, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

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
  const isOnline = useConnectionStatus();
  const router = useRouter();
  const pathname = usePathname();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Fallback client-side: redirigir a login con returnUrl
      // (El middleware ya maneja esto server-side, pero esto cubre sesión expirada)
      const loginUrl = pathname ? `/login?returnUrl=${encodeURIComponent(pathname)}` : '/login';
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

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && /^[1-8]$/.test(event.key)) {
        const action = COMMAND_ACTIONS[Number(event.key) - 1];
        if (!action) return;

        if (action.requiredPermission && !user?.permissions?.includes(action.requiredPermission)) {
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-slate-950 shadow-sm">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">FerreSaaS</h2>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content={isOnline ? "Conectado" : "Sin conexión (offline)"}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={isOnline ? "Conectado a internet" : "Sin conexión a internet"}
                  disabled
                  className={isOnline ? "text-green-600" : "text-red-600"}
                >
                  {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                </Button>
              </Tooltip>
              <ThemeToggle />
              <Tooltip content="Navegar rápido (Ctrl/Cmd + K)">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Abrir navegación rápida"
                  aria-keyshortcuts="Control+K Meta+K"
                  onClick={() => setIsCommandPaletteOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Link href="/dashboard/settings">
                <Tooltip content="Configuración">
                  <Button variant="outline" size="icon" aria-label="Ir a Configuración">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </Link>
              <Link href="/dashboard/settings/profile">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.firstName || user?.email}</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
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
