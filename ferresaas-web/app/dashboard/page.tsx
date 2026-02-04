"use client";

import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
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
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
  CheckCircle,
  BarChart3,
  Lock,
} from "lucide-react";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);

  // Validaciones de permisos
  const canViewSales = user?.permissions?.includes("sales:read");
  const canViewProducts = user?.permissions?.includes("products:read");
  const canViewCustomers = user?.permissions?.includes("customers:read");
  const canViewInventory = user?.permissions?.includes("inventory:read");
  const canAccessPOS = user?.permissions?.includes("sales:create");
  const canAccessCashRegister = user?.permissions?.includes("cash_register:read");
  const canAccessPurchases = user?.permissions?.includes("purchases:read");
  const canAccessSuppliers = user?.permissions?.includes("purchases:read");
  const canAccessPayables = user?.permissions?.includes("purchases:read");
  const canAccessReports = user?.permissions?.includes("reports:read");
  const canApproveDiscounts = user?.permissions?.includes("sales:manage");

  // Obtener datos del dashboard solo si tiene permisos
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard", canViewSales, canViewProducts, canViewCustomers, canViewInventory],
    queryFn: async () => {
      try {
        const requests = [];
        
        if (canViewSales) requests.push(api.get<any>("/sales?limit=100"));
        if (canViewProducts) requests.push(api.get<any>("/products?limit=1000"));
        if (canViewCustomers) requests.push(api.get<any>("/customers?limit=1000"));

        if (requests.length === 0) {
          return {
            totalSalesToday: 0,
            totalProducts: 0,
            totalCustomers: 0,
            lowStockProducts: 0,
          };
        }

        const responses = await Promise.all(requests);
        
        let sales = [];
        let products = [];
        let customers = [];
        let responseIndex = 0;

        if (canViewSales) {
          const salesRes = responses[responseIndex++];
          sales = Array.isArray(salesRes.data) ? salesRes.data : [];
        }

        if (canViewProducts) {
          const productsRes = responses[responseIndex++];
          products = Array.isArray(productsRes.data) ? productsRes.data : [];
        }

        if (canViewCustomers) {
          const customersRes = responses[responseIndex++];
          customers = Array.isArray(customersRes.data) ? customersRes.data : [];
        }

        // Calcular ventas de hoy
        let totalSalesToday = 0;
        if (canViewSales) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const salesToday = sales.filter((sale: any) => {
            const saleDate = new Date(sale.createdAt);
            saleDate.setHours(0, 0, 0, 0);
            return (
              saleDate.getTime() === today.getTime() &&
              sale.status === "CONFIRMED"
            );
          });
          totalSalesToday = salesToday.reduce(
            (sum: number, sale: any) => sum + Number(sale.total),
            0,
          );
        }

        // Contar productos con stock bajo
        let lowStockProducts = 0;
        if (canViewProducts && canViewInventory) {
          lowStockProducts = products.filter(
            (p: any) => p.stockQuantity < p.minStock,
          ).length;
        }

        return {
          totalSalesToday,
          totalProducts: products.length,
          totalCustomers: customers.length,
          lowStockProducts,
        };
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        return {
          totalSalesToday: 0,
          totalProducts: 0,
          totalCustomers: 0,
          lowStockProducts: 0,
        };
      }
    },
  });

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
          {canViewSales && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${Number(dashboardData?.totalSalesToday || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Confirmadas</p>
              </CardContent>
            </Card>
          )}

          {canViewProducts && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.totalProducts || 0}
                </div>
                <p className="text-xs text-muted-foreground">En catálogo</p>
              </CardContent>
            </Card>
          )}

          {canViewCustomers && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.totalCustomers || 0}
                </div>
                <p className="text-xs text-muted-foreground">Registrados</p>
              </CardContent>
            </Card>
          )}

          {canViewProducts && canViewInventory && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.lowStockProducts || 0}
                </div>
                <p className="text-xs text-muted-foreground">Productos</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
            <CardDescription>Acciones frecuentes del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {canAccessCashRegister && (
                <Link href="/dashboard/cash-register">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <DollarSign className="h-6 w-6" />
                    <span>Caja</span>
                  </Button>
                </Link>
              )}

              {canAccessPOS && (
                <Link href="/dashboard/pos">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <ShoppingCart className="h-6 w-6" />
                    <span>Punto de Venta</span>
                  </Button>
                </Link>
              )}

              {canViewProducts && (
                <Link href="/dashboard/products">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <Package className="h-6 w-6" />
                    <span>Productos</span>
                  </Button>
                </Link>
              )}

              {canViewCustomers && (
                <Link href="/dashboard/customers">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <Users className="h-6 w-6" />
                    <span>Clientes</span>
                  </Button>
                </Link>
              )}

              {canViewInventory && (
                <Link href="/dashboard/inventory">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <TrendingUp className="h-6 w-6" />
                    <span>Inventario</span>
                  </Button>
                </Link>
              )}

              {canAccessSuppliers && (
                <Link href="/dashboard/suppliers">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <Package className="h-6 w-6" />
                    <span>Proveedores</span>
                  </Button>
                </Link>
              )}

              {canAccessPurchases && (
                <Link href="/dashboard/purchases">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <ShoppingCart className="h-6 w-6" />
                    <span>Compras</span>
                  </Button>
                </Link>
              )}

              {canAccessPayables && (
                <Link href="/dashboard/payables">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <DollarSign className="h-6 w-6" />
                    <span>Cuentas por Pagar</span>
                  </Button>
                </Link>
              )}

              {canApproveDiscounts && (
                <Link href="/dashboard/discount-approvals">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <CheckCircle className="h-6 w-6" />
                    <span>Aprobación de Descuentos</span>
                  </Button>
                </Link>
              )}

              {canAccessReports && (
                <Link href="/dashboard/reports">
                  <Button
                    variant="outline"
                    className="w-full h-20 flex flex-col gap-2"
                  >
                    <BarChart3 className="h-6 w-6" />
                    <span>Reportes</span>
                  </Button>
                </Link>
              )}
            </div>

            {!canAccessCashRegister &&
              !canAccessPOS &&
              !canViewProducts &&
              !canViewCustomers &&
              !canViewInventory &&
              !canAccessPurchases &&
              !canApproveDiscounts &&
              !canAccessReports && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Lock className="h-5 w-5 mr-2" />
                  <p>No tienes acceso a ninguna funcionalidad del sistema</p>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
