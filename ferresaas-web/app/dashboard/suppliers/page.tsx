"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Header from "@/components/ui/header";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchBar } from "@/components/ui/search-bar";
import { Pagination } from "@/components/ui/pagination";
import { usePermissionGuard, usePermissions } from "@/lib/hooks/usePermissionGuard";

interface Supplier {
  id: string;
  name: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
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
  paymentTerms?: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
  });

  const { data: suppliersData, isLoading, error } = useQuery<SuppliersApiResponse | undefined>({
    queryKey: ["suppliers", search, page],
    queryFn: async () => {
      const response = await api.get<any>("/suppliers", {
        params: {
          search: search || undefined,
          page,
          limit: 10,
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
      paymentTerms: supplier.paymentTerms,
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
  
  const meta = suppliersData?.meta || { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header title="Proveedores" />

        {/* Search and Actions */}
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
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cuit">CUIT</Label>
                    <Input
                      id="cuit"
                      value={formData.cuit || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, cuit: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Dirección</Label>
                    <Textarea
                      id="address"
                      value={formData.address || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentTerms">Condiciones de Pago</Label>
                    <Input
                      id="paymentTerms"
                      placeholder="Ej: 30 días, Contado"
                      value={formData.paymentTerms || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentTerms: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentTermDays">Plazo de Pago (días)</Label>
                    <Input
                      id="paymentTermDays"
                      type="number"
                      min="0"
                      placeholder="Ej: 30 (0 = contado)"
                      value={formData.paymentTermDays || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentTermDays: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditLimit">Límite de Crédito</Label>
                    <Input
                      id="creditLimit"
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
          <Card>
            <CardContent className="py-12 text-center">
              <LoadingSpinner text="Cargando proveedores..." />
            </CardContent>
          </Card>
        ) : suppliers.length > 0 ? (
          <>
            <div className="space-y-4">
              {suppliers.map((supplier: Supplier) => (
                <Card key={supplier.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-4 flex-1">
                        <Building2 className="h-5 w-5 mt-1 text-muted-foreground" />
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {supplier.name}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground mt-1 space-y-1">
                            {supplier.cuit && <p>CUIT: {supplier.cuit}</p>}
                            {supplier.email && <p>Email: {supplier.email}</p>}
                            {supplier.phone && <p>Tel: {supplier.phone}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {supplier.currentBalance > 0 && (
                          <div className="flex items-center gap-2 mb-2 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-semibold">
                              ${supplier.currentBalance.toFixed(2)} adeudado
                            </span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Link href={`/dashboard/suppliers/${supplier.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {canUpdateSupplier && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(supplier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteSupplier && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(supplier.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Compras</p>
                        <p className="font-semibold">
                          {supplier._count?.purchases || 0}
                        </p>
                      </div>
                      {supplier.paymentTermDays !== undefined && supplier.paymentTermDays !== null && (
                        <div>
                          <p className="text-muted-foreground">
                            Plazo Pago
                          </p>
                          <p className="font-semibold">
                            {supplier.paymentTermDays === 0 ? "Contado" : `${supplier.paymentTermDays} días`}
                          </p>
                        </div>
                      )}
                      {supplier.paymentTerms && (
                        <div>
                          <p className="text-muted-foreground">
                            Condiciones
                          </p>
                          <p className="font-semibold">
                            {supplier.paymentTerms}
                          </p>
                        </div>
                      )}
                      {supplier.creditLimit && (
                        <div>
                          <p className="text-muted-foreground">
                            Límite Crédito
                          </p>
                          <p className="font-semibold">
                            ${Number(supplier.creditLimit).toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Estado</p>
                        <p className="font-semibold">
                          {supplier.isActive ? "Activo" : "Inactivo"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={meta.totalPages || 0}
              hasMore={meta.hasMore}
              onPageChange={setPage}
              className="mt-6"
            />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay proveedores registrados
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
