"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import { Building2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { Pagination } from "@/components/ui/pagination";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";
import { ActionsMenu } from "@/components/ui/actions-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Supplier {
  id: string;
  name: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTermDays?: number;
  creditLimit?: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    purchases: number;
  };
}

interface SuppliersApiResponse {
  success: boolean;
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
    hasMore: boolean;
  };
}

interface SupplierFormData {
  name: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTermDays?: number | string;
  paymentMethods?: string;
  creditLimit?: number | string;
  contactName?: string;
  contactPhone?: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  usePermissionGuard("purchases:read");
  const {
    canRead: canViewSuppliers,
    canCreate: canCreateSupplier,
    canUpdate: canUpdateSupplier,
    canDelete: canDeleteSupplier,
  } = usePermissions({
    canRead: "purchases:read",
    canCreate: "purchases:create",
    canUpdate: "purchases:update",
    canDelete: "purchases:delete",
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
  });

  const { data: suppliersData, isLoading } = useQuery<SuppliersApiResponse | undefined>({
    queryKey: ["suppliers", search, page, limit],
    queryFn: async () => {
      const response = await api.get<any>("/suppliers", {
        params: {
          search: search || undefined,
          page,
          limit,
        },
      });
      return response as SuppliersApiResponse;
    },
    enabled: canViewSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const response = await api.post("/suppliers", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsOpen(false);
      setFormData({ name: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const response = await api.put(`/suppliers/${editingId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsOpen(false);
      setEditingId(null);
      setFormData({ name: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await api.patch(`/suppliers/${id}/status`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      cuit: supplier.cuit,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      paymentTermDays: supplier.paymentTermDays,
      creditLimit: supplier.creditLimit,
    });
    setIsOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // suppliersData contiene { success, data: [...], meta: {...} }
  const suppliers: Supplier[] = (suppliersData?.data || []).map((supplier: any) => ({
    ...supplier,
    creditLimit: supplier.creditLimit ? Number(supplier.creditLimit) : undefined,
    currentBalance: Number(supplier.currentBalance) || 0,
  }));
  
  const meta = suppliersData?.meta || { page: 1, limit: limit, total: 0, totalPages: 0, hasMore: false };
  
  const startIndex = suppliers.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endIndex = Math.min(meta.page * meta.limit, meta.total);
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive).length;
  const suppliersWithDebt = suppliers.filter((supplier) => supplier.currentBalance > 0).length;

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Proveedores"
          description="Relación comercial, condiciones de pago y deuda activa en una sola vista operativa."
        />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Resultados</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{meta.total || suppliers.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Proveedores encontrados con el filtro actual.</p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Activos</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{activeSuppliers}</p>
            <p className="mt-2 text-sm text-muted-foreground">Contactos listos para operar o comprar.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Con deuda pendiente</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{suppliersWithDebt}</p>
            <p className="mt-2 text-sm brand-accent-subtle">Proveedores con saldo adeudado en este momento.</p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <SearchBar
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, CUIT o email..."
            className="flex-1"
          />
          {canCreateSupplier && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: "" });
                    setIsOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Proveedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Editar Proveedor" : "Nuevo Proveedor"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId
                      ? "Actualiza los datos del proveedor"
                      : "Completa los datos del nuevo proveedor"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Input
                      id="name"
                      label="Nombre *"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Input
                      id="cuit"
                      label="CUIT"
                      value={formData.cuit || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, cuit: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      id="email"
                      label="Email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      id="phone"
                      label="Teléfono"
                      value={formData.phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      id="address"
                      label="Dirección"
                      maxLength={500}
                      value={formData.address || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Select
                      value={String(formData.paymentTermDays ?? "")}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          paymentTermDays: value ? parseInt(value) : undefined,
                        })
                      }
                    >
                      <SelectTrigger label="Plazo de Pago">
                        <SelectValue placeholder="Selecciona un plazo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Contado</SelectItem>
                        <SelectItem value="7">7 días</SelectItem>
                        <SelectItem value="15">15 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="45">45 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      id="creditLimit"
                      label="Límite de Crédito"
                      type="number"
                      value={formData.creditLimit || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          creditLimit: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="w-full"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Guardando..."
                      : "Guardar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar Proveedor</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar este proveedor? Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-4 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Suppliers List */}
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingSpinner text="Cargando proveedores..." />
          </div>
        ) : suppliers.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suppliers.map((supplier: Supplier) => {
                  const balanceAmount = Number(supplier.currentBalance);

                  return (
                    <div
                      key={supplier.id}
                      className="rounded-lg border p-3 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                    >
                      <div className="app-icon-badge h-12 w-12 rounded-full border-2 border-[hsl(var(--brand-accent-border)/0.5)] bg-gradient-to-br from-[hsl(var(--brand-accent-soft))] to-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate text-[15px]">
                            {supplier.name}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${
                              supplier.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-50 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {supplier.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                          {supplier.cuit && (
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">CUIT:</span>
                              <span className="text-xs text-foreground/80">{supplier.cuit}</span>
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <span className="text-foreground/60">Email:</span>
                              <span className="text-xs truncate text-foreground/80">
                                {supplier.email}
                              </span>
                            </span>
                          )}
                          {supplier.phone && (
                            <span className="flex items-center gap-1">
                              <span className="text-foreground/60">Tel:</span>
                              <span className="text-xs text-foreground/80">{supplier.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-5 flex-shrink-0">
                        <div className="text-right min-w-[80px]">
                          <p className="text-xs text-muted-foreground/70 uppercase tracking-wide font-medium">
                            Saldo
                          </p>
                          <p
                            className={`text-base font-bold tabular-nums ${
                              balanceAmount < 0
                                ? 'text-red-600'
                                : balanceAmount > 0
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {balanceAmount < 0 ? '-' : ''}${Math.abs(balanceAmount).toFixed(2)}
                          </p>
                        </div>
                        <ActionsMenu
                          actions={[
                            {
                              label: "Ver detalle",
                              onClick: () => router.push(`/dashboard/suppliers/${supplier.id}`),
                            },
                            ...(canUpdateSupplier
                              ? [
                                  {
                                    label: "Editar",
                                    onClick: () => handleEdit(supplier),
                                  },
                                  {
                                    label: supplier.isActive ? "Inactivar" : "Activar",
                                    onClick: () =>
                                      toggleStatusMutation.mutate({
                                        id: supplier.id,
                                        isActive: !supplier.isActive,
                                      }),
                                    disabled: toggleStatusMutation.isPending,
                                  },
                                ]
                              : []),
                            ...(canDeleteSupplier
                              ? [
                                  {
                                    label: "Eliminar",
                                    onClick: () => handleDeleteClick(supplier.id),
                                    disabled: deleteMutation.isPending,
                                    variant: "danger" as const,
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search ? "No se encontraron proveedores" : "No hay proveedores registrados"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <Pagination
            setPage={setPage}
            currentPage={page}
            totalPages={Math.max(meta.totalPages || 1, 1)}
            hasMore={meta.hasMore}
            startIndex={startIndex}
            endIndex={endIndex}
            total={meta.total}
            limit={limit}
            onLimitChange={setLimit}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
