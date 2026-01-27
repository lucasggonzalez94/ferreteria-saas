"use client";

import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
} from "lucide-react";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem("businessLogo");
    if (savedLogo) setBusinessLogo(savedLogo);

    const handleLogoUpdate = () => {
      const newLogo = localStorage.getItem("businessLogo");
      setBusinessLogo(newLogo);
    };

    window.addEventListener("businessLogoChanged", handleLogoUpdate);
    return () =>
      window.removeEventListener("businessLogoChanged", handleLogoUpdate);
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            {businessLogo && (
              <img
                src={businessLogo}
                alt="Logo negocio"
                className="h-12 w-12 object-contain rounded-md"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">
                Bienvenido, {user?.firstName || user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/settings">
              <Button variant="outline" size="icon" title="Configuración">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" onClick={logout}>
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0</div>
              <p className="text-xs text-muted-foreground">Próximamente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">En catálogo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Productos</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
            <CardDescription>Acciones frecuentes del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/dashboard/pos">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>Punto de Venta</span>
                </Button>
              </Link>

              <Link href="/dashboard/products">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <Package className="h-6 w-6" />
                  <span>Productos</span>
                </Button>
              </Link>

              <Link href="/dashboard/customers">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <Users className="h-6 w-6" />
                  <span>Clientes</span>
                </Button>
              </Link>

              <Link href="/dashboard/inventory">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <TrendingUp className="h-6 w-6" />
                  <span>Inventario</span>
                </Button>
              </Link>

              <Link href="/dashboard/purchases">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>Compras</span>
                </Button>
              </Link>

              <Link href="/dashboard/cash-register">
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <DollarSign className="h-6 w-6" />
                  <span>Caja</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
