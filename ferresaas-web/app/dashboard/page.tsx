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
import Image from "next/image";
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
  GripVertical,
  Edit,
  Save,
  X,
  Wallet,
  PieChart,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useApprovalCounts } from "@/lib/hooks/useApprovalCounts";
import { useConnectionStatus } from "@/lib/hooks/useConnectionStatus";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { Tooltip } from "@/components/ui/tooltip";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const isOnline = useConnectionStatus();
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [quickActions, setQuickActions] = useState<Array<{
    id: string;
    label: string;
    href: string;
    icon: JSX.Element;
    allowed: boolean;
  }>>([]);
  const [isEditingQuickActions, setIsEditingQuickActions] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleLogoUpdate = () => {
    const logo = localStorage.getItem("businessLogo");
    if (logo) setBusinessLogo(logo);
  };

  useEffect(() => {
    handleLogoUpdate();
    window.addEventListener("businessLogoChanged", handleLogoUpdate);
    return () => {
      window.removeEventListener("businessLogoChanged", handleLogoUpdate);
    };
  }, []);

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
  const canAccessFinances = user?.permissions?.includes("financial_accounts:read");
  const canAccessReports = user?.permissions?.includes("reports:read");
  const canApproveDiscounts = user?.permissions?.includes("sales:approve_discount");
  const canApprovePrices = user?.permissions?.includes("pricing:approve");

  // Obtener conteos de aprobaciones pendientes
  const { data: approvalCounts, refetch: refetchApprovalCounts, isRefetching } = useApprovalCounts();

  // Obtener datos del dashboard solo si tiene permisos
  const { data: dashboardData, refetch: refetchDashboardData } = useQuery({
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

  const persistQuickActions = (actions: typeof quickActions) => {
    setQuickActions(actions);
    localStorage.setItem("dashboardQuickActions", JSON.stringify(actions.map((a) => a.id)));
  };

  const handleDragStart = (id: string) => {
    if (!isEditingQuickActions) return;
    setDraggingId(id);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, overId: string) => {
    event.preventDefault();
    if (!isEditingQuickActions || draggingId === overId || !draggingId) return;
    const current = [...quickActions];
    const fromIndex = current.findIndex((a) => a.id === draggingId);
    const toIndex = current.findIndex((a) => a.id === overId);
    if (fromIndex === -1 || toIndex === -1) return;
    current.splice(toIndex, 0, current.splice(fromIndex, 1)[0]);
    setQuickActions(current);
  };

  const handleDragEnd = () => {
    if (!isEditingQuickActions) return;
    persistQuickActions(quickActions);
    setDraggingId(null);
  };

  useEffect(() => {
    const baseActions = [
      { id: "cash", label: "Caja", href: "/dashboard/cash-register", icon: <DollarSign className="h-6 w-6" />, allowed: !!canAccessCashRegister },
      { id: "pos", label: "Punto de Venta", href: "/dashboard/pos", icon: <ShoppingCart className="h-6 w-6" />, allowed: !!canAccessPOS },
      { id: "products", label: "Productos", href: "/dashboard/products", icon: <Package className="h-6 w-6" />, allowed: !!canViewProducts },
      { id: "customers", label: "Clientes", href: "/dashboard/customers", icon: <Users className="h-6 w-6" />, allowed: !!canViewCustomers },
      { id: "inventory", label: "Inventario", href: "/dashboard/inventory", icon: <TrendingUp className="h-6 w-6" />, allowed: !!canViewInventory },
      { id: "suppliers", label: "Proveedores", href: "/dashboard/suppliers", icon: <Package className="h-6 w-6" />, allowed: !!canAccessSuppliers },
      { id: "finances", label: "Finanzas", href: "/dashboard/financial-accounts", icon: <Wallet className="h-6 w-6" />, allowed: !!canAccessFinances },
      { id: "purchases", label: "Compras", href: "/dashboard/purchases", icon: <ShoppingCart className="h-6 w-6" />, allowed: !!canAccessPurchases },
      { id: "payables", label: "Cuentas por Pagar", href: "/dashboard/payables", icon: <DollarSign className="h-6 w-6" />, allowed: !!canAccessPayables },
      { id: "prices", label: "Aprobación de Precios", href: "/dashboard/price-suggestions", icon: <PieChart className="h-6 w-6" />, allowed: !!canApprovePrices },
      { id: "discounts", label: "Aprobación de Descuentos", href: "/dashboard/discount-approvals", icon: <CheckCircle className="h-6 w-6" />, allowed: !!canApproveDiscounts },
      { id: "reports", label: "Reportes", href: "/dashboard/reports", icon: <BarChart3 className="h-6 w-6" />, allowed: !!canAccessReports },
    ];

    const storedOrderRaw = localStorage.getItem("dashboardQuickActions");
    if (storedOrderRaw) {
      try {
        const parsed: string[] = JSON.parse(storedOrderRaw);
        const byId = Object.fromEntries(baseActions.map((a) => [a.id, a]));
        const restored = parsed
          .map((id) => byId[id])
          .filter((item): item is typeof baseActions[number] => Boolean(item && item.allowed));
        const missing = baseActions.filter((item) => item.allowed && !parsed.includes(item.id));
        setQuickActions([...restored, ...missing]);
        return;
      } catch (error) {
        console.error("Error parsing dashboardQuickActions", error);
      }
    }

    setQuickActions(baseActions.filter((item) => item.allowed));
  }, [
    canAccessCashRegister,
    canAccessPOS,
    canViewProducts,
    canViewCustomers,
    canViewInventory,
    canAccessPurchases,
    canAccessSuppliers,
    canAccessPayables,
    canAccessFinances,
    canApprovePrices,
    canApproveDiscounts,
    canAccessReports,
  ]);

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            {businessLogo && (
              <Image
                src={businessLogo}
                alt="Logo negocio"
                width={48}
                height={48}
                unoptimized
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
            <Tooltip content="Refrescar datos">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refetchApprovalCounts();
                  refetchDashboardData();
                }}
                disabled={isRefetching}
              >
                <RefreshCw className={`h-5 w-5 ${isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </Tooltip>
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Accesos Rápidos</CardTitle>
              <CardDescription>Acciones frecuentes del sistema</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditingQuickActions && (
                <span className="text-xs text-muted-foreground">Arrastra para reordenar</span>
              )}
              <Button
                variant={isEditingQuickActions ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  if (isEditingQuickActions) {
                    persistQuickActions(quickActions);
                    setDraggingId(null);
                  }
                  setIsEditingQuickActions((prev) => !prev);
                }}
              >
                {isEditingQuickActions ? "Guardar" : "Editar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {quickActions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const showBadge = 
                    (action.id === "discounts" && approvalCounts && approvalCounts.discounts > 0) ||
                    (action.id === "prices" && approvalCounts && approvalCounts.prices > 0);
                  
                  const badgeCount = 
                    action.id === "discounts" ? approvalCounts?.discounts || 0 :
                    action.id === "prices" ? approvalCounts?.prices || 0 : 0;

                  return (
                    <div
                      key={action.id}
                      draggable={isEditingQuickActions}
                      onDragStart={() => handleDragStart(action.id)}
                      onDragOver={(e) => handleDragOver(e, action.id)}
                      onDragEnd={handleDragEnd}
                      className={`relative ${isEditingQuickActions ? "cursor-grab" : "cursor-pointer"}`}
                    >
                      {isEditingQuickActions && (
                        <div className="absolute top-2 right-2 text-muted-foreground z-10">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}
                      {showBadge && !isEditingQuickActions && (
                        <NotificationBadge count={badgeCount} />
                      )}
                      <Link href={action.href} onClick={(e) => isEditingQuickActions && e.preventDefault()}>
                        <Button
                          variant="outline"
                          className={`w-full h-20 flex flex-col gap-2 ${isEditingQuickActions ? "border-dashed cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          {action.icon}
                          <span>{action.label}</span>
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
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
