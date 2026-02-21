"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const response = await api.get<any>(`/customers/${params.id}`);
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/customers/${params.id}`);
    },
    onSuccess: () => {
      toast.success("Cliente eliminado exitosamente");
      router.push("/dashboard/customers");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar cliente");
    },
  });

  const handleDelete = () => {
    setDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted-foreground">Cliente no encontrado</p>
          <Link href="/dashboard/customers">
            <Button className="mt-4">Volver al listado</Button>
          </Link>
        </div>
      </div>
    );
  }

  const customerName =
    customer.type === "COMPANY"
      ? customer.companyName
      : `${customer.firstName} ${customer.lastName}`;

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <Header
          title={customerName}
          description={customer.type === "COMPANY" ? "Empresa" : "Persona"}
          link="/dashboard/customers"
          linkLabel="Volver"
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/customers/${params.id}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>
          }
        />

        {/* Customer Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.type === "COMPANY" ? (
              <div>
                <p className="text-sm text-muted-foreground">Razón Social</p>
                <p className="text-lg font-semibold">{customer.companyName}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="text-lg font-semibold">{customer.firstName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Apellido</p>
                    <p className="text-lg font-semibold">{customer.lastName}</p>
                  </div>
                </div>
              </>
            )}

            {customer.cuit && (
              <div>
                <p className="text-sm text-muted-foreground">CUIT/CUIL</p>
                <p className="text-lg font-semibold">{customer.cuit}</p>
              </div>
            )}

            {customer.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-semibold">{customer.email}</p>
              </div>
            )}

            {customer.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="text-lg font-semibold">{customer.phone}</p>
              </div>
            )}

            {customer.address && (
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p className="text-lg font-semibold">{customer.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Cuenta Corriente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Saldo</p>
              <p
                className={`text-4xl font-bold ${
                  customer.currentBalance > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                ${Number(customer.currentBalance).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {customer.currentBalance > 0
                  ? "Saldo a favor del cliente"
                  : "Saldo a favor de la empresa"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        onConfirm={confirmDelete}
        title="Eliminar Cliente"
        description={`¿Estás seguro de que deseas eliminar a ${
          customer?.type === "COMPANY"
            ? customer?.companyName
            : `${customer?.firstName} ${customer?.lastName}`
        }? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
