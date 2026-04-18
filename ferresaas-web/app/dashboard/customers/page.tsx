"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, User } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from "next/link";
import Header from "@/components/ui/header";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { useConfirmDialog } from "@/lib/hooks/useConfirmDialog";

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deleteDialog = useConfirmDialog<{ id: string; name: string }>();

  usePermissionGuard("customers:read");
  const {
    canRead: canViewCustomers,
    canCreate: canCreateCustomers,
  } = usePermissions({
    canRead: "customers:read",
    canCreate: "customers:create",
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "PERSON" as "PERSON" | "COMPANY",
    firstName: "",
    lastName: "",
    companyName: "",
    cuit: "",
    email: "",
    phone: "",
    address: "",
    initialBalance: "",
  });

  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      const response = await api.get<any[]>(`/customers?q=${search}`);
      return response.data || [];
    },
    enabled: canViewCustomers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/customers", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Cliente creado exitosamente");
      setShowForm(false);
      setFormData({
        type: "PERSON",
        firstName: "",
        lastName: "",
        companyName: "",
        cuit: "",
        email: "",
        phone: "",
        address: "",
        initialBalance: "",
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await api.delete(`/customers/${customerId}`);
    },
    onSuccess: () => {
      toast.success("Cliente eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar cliente");
    },
  });

  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    deleteDialog.open({ id: customerId, name: customerName });
  };

  const confirmDelete = () => {
    if (deleteDialog.data) {
      deleteMutation.mutate(deleteDialog.data.id);
      deleteDialog.close();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, any> = { ...formData };

    if (payload.type === "PERSON") {
      delete payload.companyName;
    } else {
      delete payload.firstName;
      delete payload.lastName;
    }

    // Convertir initialBalance a número si existe
    if (payload.initialBalance && payload.initialBalance !== "") {
      payload.initialBalance = parseFloat(payload.initialBalance);
    } else {
      delete payload.initialBalance;
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === null) {
        delete payload[key];
      }
    });

    createMutation.mutate(payload);
  };

  const customerList = customers || [];
  const companyCount = customerList.filter((customer: any) => customer.type === "COMPANY").length;
  const positiveBalanceCount = customerList.filter((customer: any) => Number(customer.currentBalance) > 0).length;

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Clientes"
          description="Gestión comercial con cuenta corriente, búsqueda rápida y alta de personas o empresas desde una misma vista."
          showButton={canCreateCustomers}
          buttonLabel="Nuevo Cliente"
          buttonIcon={<Plus className="h-4 w-4 mr-2" />}
          buttonAction={() => setShowForm(!showForm)}
        />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Clientes visibles</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{customerList.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Resultados según búsqueda actual.</p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Empresas</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{companyCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">Clientes corporativos dentro del padrón.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Con saldo activo</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{positiveBalanceCount}</p>
            <p className="mt-2 text-sm brand-accent-subtle">Cuentas corrientes que conviene revisar primero.</p>
          </div>
        </div>

        {showForm && (
          <Card className="app-orbit mb-6 overflow-hidden">
            <CardHeader>
              <CardTitle>Nuevo Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as "PERSON" | "COMPANY" })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERSON">Persona</SelectItem>
                        <SelectItem value="COMPANY">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type === "PERSON" ? (
                    <>
                      <div>
                        <Label htmlFor="firstName">Nombre *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Apellido *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2">
                      <Label htmlFor="companyName">Razón Social *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            companyName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="cuit">CUIT/CUIL</Label>
                    <Input
                      id="cuit"
                      value={formData.cuit}
                      onChange={(e) =>
                        setFormData({ ...formData, cuit: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="initialBalance">Saldo Inicial</Label>
                    <Input
                      id="initialBalance"
                      type="number"
                      step="0.01"
                      value={formData.initialBalance}
                      onChange={(e) =>
                        setFormData({ ...formData, initialBalance: e.target.value })
                      }
                      placeholder="0.00"
                    />
                    <p className="mt-2 text-xs brand-accent-subtle">
                      Úsalo para migrar saldos previos sin perder contexto contable.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creando..." : "Crear Cliente"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden">
          <CardContent>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, CUIT, email..."
            />
          </CardContent>
        </Card>

        {/* Customers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando clientes..." />
          </div>
        ) : customerList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerList.map((customer: any) => (
              <Card key={customer.id} className="app-orbit overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.35)]">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="app-icon-badge h-11 w-11 rounded-full border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {customer.type === "COMPANY"
                          ? customer.companyName
                          : `${customer.firstName} ${customer.lastName}`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {customer.type === "COMPANY" ? "Empresa" : "Persona"}
                      </p>
                    </div>
                    <ActionsMenu
                      actions={[
                        {
                          label: "Ver detalle",
                          onClick: () => router.push(`/dashboard/customers/${customer.id}`),
                        },
                        {
                          label: "Editar",
                          onClick: () => router.push(`/dashboard/customers/${customer.id}/edit`),
                        },
                        {
                          label: "Eliminar",
                          onClick: () =>
                            handleDeleteCustomer(
                              customer.id,
                              customer.type === "COMPANY"
                                ? customer.companyName
                                : `${customer.firstName} ${customer.lastName}`
                            ),
                          disabled: deleteMutation.isPending,
                          variant: "danger",
                        },
                      ]}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {customer.cuit && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">CUIT:</span>{" "}
                      {customer.cuit}
                    </p>
                  )}
                  {customer.email && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {customer.email}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Tel:</span>{" "}
                      {customer.phone}
                    </p>
                  )}
                  <div className="pt-3 border-t border-border/60">
                    <p className="text-sm text-muted-foreground">Saldo:</p>
                    <p
                      className={`text-lg font-semibold ${
                        Number(customer.currentBalance) < 0
                          ? "text-red-600"
                          : "brand-accent-text"
                      }`}
                    >
                      ${Number(customer.currentBalance).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search
                  ? "No se encontraron clientes"
                  : "No hay clientes registrados"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && deleteDialog.close()}
        onConfirm={confirmDelete}
        title="Eliminar Cliente"
        description={`¿Estás seguro de que deseas eliminar a ${deleteDialog.data?.name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
