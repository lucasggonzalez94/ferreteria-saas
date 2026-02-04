"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Building2,
  ArrowLeft,
  ShoppingCart,
  DollarSign,
  Calendar,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";

interface SupplierDetail {
  supplier: {
    id: string;
    name: string;
    cuit?: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentTerms?: string;
    creditLimit?: number;
    currentBalance: number;
    contactName?: string;
    contactPhone?: string;
    isActive: boolean;
    createdAt: string;
  };
  stats: {
    totalPurchases: number;
    totalAmount: number;
    totalPayable: number;
    totalPaid: number;
    pendingPayment: number;
    lastPurchaseDate?: string;
  };
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  const canViewSuppliers = user?.permissions?.includes("purchases:read");

  useEffect(() => {
    if (!canViewSuppliers) {
      router.push("/dashboard");
      return;
    }
  }, [canViewSuppliers, router]);

  const { data: supplierData, isLoading } = useQuery({
    queryKey: ["supplier", params.id],
    queryFn: async () => {
      const response = await api.get<SupplierDetail>(`/suppliers/${params.id}`);
      return response.data;
    },
    enabled: canViewSuppliers && !!params.id,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner text="Cargando proveedor..." />
        </div>
      </div>
    );
  }

  if (!supplierData) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Proveedor no encontrado</p>
              <Link href="/dashboard/suppliers">
                <Button className="mt-4" variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Proveedores
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { supplier, stats } = supplierData;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title={supplier.name}
          description={supplier.isActive ? "Activo" : "Inactivo"}
          link="/dashboard/suppliers"
          linkLabel="Volver a Proveedores"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Compras
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPurchases}</div>
              <p className="text-xs text-muted-foreground">
                ${stats.totalAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Adeudado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalPayable.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Pagado: ${stats.totalPaid.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendiente
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ${stats.pendingPayment.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Por pagar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Última Compra
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {stats.lastPurchaseDate
                  ? new Date(stats.lastPurchaseDate).toLocaleDateString(
                      "es-AR"
                    )
                  : "Sin compras"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Información del Proveedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.cuit && (
                <div>
                  <p className="text-sm text-muted-foreground">CUIT</p>
                  <p className="font-semibold">{supplier.cuit}</p>
                </div>
              )}
              {supplier.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold">{supplier.email}</p>
                </div>
              )}
              {supplier.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-semibold">{supplier.phone}</p>
                </div>
              )}
              {supplier.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-semibold">{supplier.address}</p>
                </div>
              )}
              {supplier.paymentTerms && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Condiciones de Pago
                  </p>
                  <p className="font-semibold">{supplier.paymentTerms}</p>
                </div>
              )}
              {supplier.creditLimit && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Límite de Crédito
                  </p>
                  <p className="font-semibold">
                    ${Number(supplier.creditLimit).toFixed(2)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacto Secundario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.contactName ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="font-semibold">{supplier.contactName}</p>
                  </div>
                  {supplier.contactPhone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="font-semibold">{supplier.contactPhone}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay contacto secundario registrado
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <Link href={`/dashboard/purchases?supplierId=${supplier.id}`}>
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ver Compras
            </Button>
          </Link>
          <Link href={`/dashboard/payables?supplierId=${supplier.id}`}>
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Cuentas por Pagar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
