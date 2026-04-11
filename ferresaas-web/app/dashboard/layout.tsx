"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useConnectionStatus } from "@/lib/hooks/useConnectionStatus";
import { BarcodeProvider } from "@/lib/contexts/barcode-context";
import { useGlobalBarcodeListener } from "@/lib/hooks/useGlobalBarcodeListener";
import { BarcodeProductModal } from "@/components/barcode/barcode-product-modal";
import { GlobalUnknownBarcodeModal } from "@/components/barcode/global-unknown-barcode-modal";
import { LogOut, Settings, User, Wifi, WifiOff } from "lucide-react";
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Fallback client-side: redirigir a login con returnUrl
      // (El middleware ya maneja esto server-side, pero esto cubre sesión expirada)
      const loginUrl = pathname ? `/login?returnUrl=${encodeURIComponent(pathname)}` : '/login';
      router.push(loginUrl);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

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
        <BarcodeProductModal />
        <GlobalUnknownBarcodeModal />
      </div>
    </BarcodeProvider>
  );
}
