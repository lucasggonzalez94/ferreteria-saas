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
  CheckCircle,
  BarChart3,
  Lock,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Wallet,
  PieChart,
  RefreshCw,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import { useApprovalCounts } from "@/lib/hooks/useApprovalCounts";
import { useConnectionStatus } from "@/lib/hooks/useConnectionStatus";
import { NotificationBadge } from "@/components/ui/notification-badge";
import { Tooltip } from "@/components/ui/tooltip";

export default function DashboardPage() {
  const { user, business, isLoading } = useAuth();

  // Redirect to login if not authenticated (after loading completes)
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/login";
    }
  }, [isLoading, user]);

  const isOnline = useConnectionStatus();
  const [quickActions, setQuickActions] = useState<
    Array<{
      id: string;
      label: string;
      href: string;
      icon: JSX.Element;
      allowed: boolean;
    }>
  >([]);
  const [isEditingQuickActions, setIsEditingQuickActions] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const businessLogo = business?.logoUrl || null;

  // Validaciones de permisos
  const canViewSales = user?.permissions?.includes("sales:read");
  const canViewProducts = user?.permissions?.includes("products:read");
  const canViewCustomers = user?.permissions?.includes("customers:read");
  const canViewInventory = user?.permissions?.includes("inventory:read");
  const canAccessPOS = user?.permissions?.includes("sales:create");
  const canAccessCashRegister =
    user?.permissions?.includes("cash_register:read");
  const canAccessPurchases = user?.permissions?.includes("purchases:read");
  const canAccessSuppliers = user?.permissions?.includes("purchases:read");
  const canAccessPayables = user?.permissions?.includes("purchases:read");
  const canAccessChecks = user?.permissions?.includes("checks:read");
  const canAccessFinances = user?.permissions?.includes(
    "financial_accounts:read",
  );
  const canAccessReports = user?.permissions?.includes("reports:read");
  const canApproveDiscounts = user?.permissions?.includes(
    "sales:approve_discount",
  );
  const canApprovePrices = user?.permissions?.includes("pricing:approve");

  // Obtener conteos de aprobaciones pendientes
  const {
    data: approvalCounts,
    refetch: refetchApprovalCounts,
    isRefetching,
  } = useApprovalCounts();

  // const pendingApprovals =
  //   (approvalCounts?.discounts || 0) + (approvalCounts?.prices || 0);
  const welcomeName = user?.firstName || user?.email?.split("@")[0] || "equipo";
  const actionCaptions: Record<string, string> = {
    cash: "Apertura, movimientos y cierre de turno.",
    pos: "Cobro rápido con scanner y atajos.",
    products: "Catálogo, precios y control de stock.",
    customers: "Historial de compras y cuentas corrientes.",
    inventory: "Alertas, ajustes y reposición.",
    suppliers: "Gestión de proveedores y abastecimiento.",
    finances: "Cuentas bancarias, caja y movimientos.",
    purchases: "Seguimiento de compras activas.",
    payables: "Vencimientos y pagos por realizar.",
    prices: "Aprobación de cambios de precio.",
    discounts: "Descuentos pendientes de autorización.",
    reports: "Indicadores clave para decidir.",
    invoices: "Consulta comprobantes, CAE y descarga PDF.",
    checks: "Cartera de cheques, estados y vencimientos.",
  };

  // Obtener datos del dashboard solo si tiene permisos
  const { data: dashboardData, refetch: refetchDashboardData } = useQuery({
    queryKey: [
      "dashboard",
      canViewSales,
      canViewProducts,
      canViewCustomers,
      canViewInventory,
    ],
    queryFn: async () => {
      try {
        const requests = [];

        if (canViewSales) requests.push(api.get<any>("/sales?limit=100"));
        if (canViewProducts)
          requests.push(api.get<any>("/products?limit=1000"));
        if (canViewCustomers)
          requests.push(api.get<any>("/customers?limit=1000"));

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
    localStorage.setItem(
      "dashboardQuickActions",
      JSON.stringify(actions.map((a) => a.id)),
    );
  };

  const handleDragStart = (id: string) => {
    if (!isEditingQuickActions) return;
    setDraggingId(id);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    overId: string,
  ) => {
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

  const moveQuickAction = (id: string, direction: "up" | "down") => {
    if (!isEditingQuickActions) return;
    setQuickActions((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  useEffect(() => {
    const baseActions = [
      {
        id: "cash",
        label: "Caja",
        href: "/dashboard/cash-register",
        icon: <DollarSign className="h-6 w-6" />,
        allowed: !!canAccessCashRegister,
      },
      {
        id: "pos",
        label: "Punto de Venta",
        href: "/dashboard/pos",
        icon: <ShoppingCart className="h-6 w-6" />,
        allowed: !!canAccessPOS,
      },
      {
        id: "sales",
        label: "Ventas",
        href: "/dashboard/sales",
        icon: <ShoppingCart className="h-6 w-6" />,
        allowed: !!canViewSales,
      },
      {
        id: "products",
        label: "Productos",
        href: "/dashboard/products",
        icon: <Package className="h-6 w-6" />,
        allowed: !!canViewProducts,
      },
      {
        id: "customers",
        label: "Clientes",
        href: "/dashboard/customers",
        icon: <Users className="h-6 w-6" />,
        allowed: !!canViewCustomers,
      },
      {
        id: "invoices",
        label: "Comprobantes",
        href: "/dashboard/invoices",
        icon: <FileText className="h-6 w-6" />,
        allowed: !!canViewSales,
      },
      {
        id: "inventory",
        label: "Inventario",
        href: "/dashboard/inventory",
        icon: <TrendingUp className="h-6 w-6" />,
        allowed: !!canViewInventory,
      },
      {
        id: "suppliers",
        label: "Proveedores",
        href: "/dashboard/suppliers",
        icon: <Package className="h-6 w-6" />,
        allowed: !!canAccessSuppliers,
      },
      {
        id: "finances",
        label: "Finanzas",
        href: "/dashboard/financial-accounts",
        icon: <Wallet className="h-6 w-6" />,
        allowed: !!canAccessFinances,
      },
      {
        id: "purchases",
        label: "Compras",
        href: "/dashboard/purchases",
        icon: <ShoppingCart className="h-6 w-6" />,
        allowed: !!canAccessPurchases,
      },
      {
        id: "payables",
        label: "Cuentas por Pagar",
        href: "/dashboard/payables",
        icon: <DollarSign className="h-6 w-6" />,
        allowed: !!canAccessPayables,
      },
      {
        id: "checks",
        label: "Cheques",
        href: "/dashboard/checks",
        icon: <FileText className="h-6 w-6" />,
        allowed: !!canAccessChecks,
      },
      {
        id: "prices",
        label: "Aprobación de Precios",
        href: "/dashboard/price-suggestions",
        icon: <PieChart className="h-6 w-6" />,
        allowed: !!canApprovePrices,
      },
      {
        id: "discounts",
        label: "Aprobación de Descuentos",
        href: "/dashboard/discount-approvals",
        icon: <CheckCircle className="h-6 w-6" />,
        allowed: !!canApproveDiscounts,
      },
      {
        id: "reports",
        label: "Reportes",
        href: "/dashboard/reports",
        icon: <BarChart3 className="h-6 w-6" />,
        allowed: !!canAccessReports,
      },
    ];

    const storedOrderRaw = localStorage.getItem("dashboardQuickActions");
    if (storedOrderRaw) {
      try {
        const parsed: string[] = JSON.parse(storedOrderRaw);
        const byId = Object.fromEntries(baseActions.map((a) => [a.id, a]));
        const restored = parsed
          .map((id) => byId[id])
          .filter((item): item is (typeof baseActions)[number] =>
            Boolean(item && item.allowed),
          );
        const missing = baseActions.filter(
          (item) => item.allowed && !parsed.includes(item.id),
        );
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
    canViewSales,
    canViewInventory,
    canAccessPurchases,
    canAccessSuppliers,
    canAccessPayables,
    canAccessChecks,
    canAccessFinances,
    canApprovePrices,
    canApproveDiscounts,
    canAccessReports,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        refetchApprovalCounts();
        refetchDashboardData();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refetchApprovalCounts, refetchDashboardData]);

  const stats = [
    canViewSales
      ? {
          key: "sales",
          title: "Ventas hoy",
          value: `$${Number(dashboardData?.totalSalesToday || 0).toFixed(2)}`,
          description: "Confirmadas durante la jornada",
          icon: <DollarSign className="h-5 w-5" />,
        }
      : null,
    canViewProducts
      ? {
          key: "products",
          title: "Productos",
          value: String(dashboardData?.totalProducts || 0),
          description: "Ítems disponibles en catálogo",
          icon: <Package className="h-5 w-5" />,
        }
      : null,
    canViewCustomers
      ? {
          key: "customers",
          title: "Clientes",
          value: String(dashboardData?.totalCustomers || 0),
          description: "Registros con seguimiento activo",
          icon: <Users className="h-5 w-5" />,
        }
      : null,
    canViewProducts && canViewInventory
      ? {
          key: "low-stock",
          title: "Stock bajo",
          value: String(dashboardData?.lowStockProducts || 0),
          description: "Productos que requieren atención",
          icon: <AlertTriangle className="h-5 w-5" />,
        }
      : null,
  ].filter(
    (
      stat,
    ): stat is {
      key: string;
      title: string;
      value: string;
      description: string;
      icon: JSX.Element;
    } => Boolean(stat),
  );

  // Show loading state while checking authentication
  if (isLoading || !user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-section space-y-6">
        <section className="app-panel app-orbit overflow-hidden p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              {businessLogo ? (
                <div className="app-panel-muted flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.4rem] p-2">
                  <Image
                    src={businessLogo}
                    alt="Logo negocio"
                    width={56}
                    height={56}
                    unoptimized
                    className="h-12 w-12 object-contain"
                  />
                </div>
              ) : (
                <div className="app-icon-badge h-16 w-16 rounded-[1.4rem] border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                  <BarChart3 className="h-7 w-7" />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                    Buen turno, {welcomeName}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Revisa el estado del negocio y entra a los modulos clave sin
                    dar vueltas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="app-panel-muted hidden items-center gap-2 rounded-full px-4 py-2 sm:flex">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"}`}
                />
                <span className="text-sm font-medium text-foreground">
                  {isOnline ? "Sistema en línea" : "Sin conexión"}
                </span>
              </div>
              <Tooltip content="Refrescar datos">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Refrescar datos del dashboard"
                  aria-keyshortcuts="R"
                  onClick={() => {
                    refetchApprovalCounts();
                    refetchDashboardData();
                  }}
                  disabled={isRefetching}
                >
                  <RefreshCw
                    className={`h-5 w-5 ${isRefetching ? "animate-spin" : ""}`}
                  />
                </Button>
              </Tooltip>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.key} className="app-orbit overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em]">
                    {stat.title}
                  </CardDescription>
                  <CardTitle className="mt-3 text-3xl">{stat.value}</CardTitle>
                </div>
                <div className="app-icon-badge h-12 w-12 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                  {stat.icon}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:items-center sm:flex-row sm:justify-between gap-3">
            <div>
              <CardTitle>Accesos rápidos</CardTitle>
              <CardDescription>
                Entradas directas a los modulos que mas usas en el dia.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditingQuickActions && (
                <span className="text-xs text-muted-foreground">
                  Arrastra para ordenar
                </span>
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
                {isEditingQuickActions ? "Guardar orden" : "Ordenar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {quickActions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const showBadge =
                    (action.id === "discounts" &&
                      approvalCounts &&
                      approvalCounts.discounts > 0) ||
                    (action.id === "prices" &&
                      approvalCounts &&
                      approvalCounts.prices > 0);

                  const badgeCount =
                    action.id === "discounts"
                      ? approvalCounts?.discounts || 0
                      : action.id === "prices"
                        ? approvalCounts?.prices || 0
                        : 0;

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
                        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 text-muted-foreground">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/90 hover:bg-[hsl(var(--brand-accent-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={(e) => {
                              e.preventDefault();
                              moveQuickAction(action.id, "up");
                            }}
                            aria-label={`Mover ${action.label} hacia arriba`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/90 hover:bg-[hsl(var(--brand-accent-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={(e) => {
                              e.preventDefault();
                              moveQuickAction(action.id, "down");
                            }}
                            aria-label={`Mover ${action.label} hacia abajo`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <GripVertical
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                      {showBadge && !isEditingQuickActions && (
                        <NotificationBadge count={badgeCount} />
                      )}
                      <Link
                        href={action.href}
                        onClick={(e) =>
                          isEditingQuickActions && e.preventDefault()
                        }
                      >
                        <Button
                          variant="outline"
                          className={`h-auto min-h-[142px] w-full flex-col items-start rounded-[1.45rem] border-border/70 bg-background/70 p-5 text-left hover:border-[hsl(var(--accent)/0.35)] hover:bg-[hsl(var(--brand-accent-soft))] ${isEditingQuickActions ? "cursor-grab border-dashed active:cursor-grabbing" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="app-icon-badge h-12 w-12 rounded-2xl border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                              {action.icon}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {action.label}
                            </span>
                          </div>
                          <span className="mt-1 text-xs leading-5 text-muted-foreground">
                            {actionCaptions[action.id] ||
                              "Acceso directo al módulo."}
                          </span>
                          <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Abrir
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Lock className="h-5 w-5 mr-2" />
                <p>No tenes modulos habilitados para tu usuario.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
