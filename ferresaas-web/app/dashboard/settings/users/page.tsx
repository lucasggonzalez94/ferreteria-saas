"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUsers, UserListItem } from "@/lib/hooks/useUsers";
import { useRoles } from "@/lib/hooks/useRoles";
import { useUserRoles } from "@/lib/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Mail, User as UserIcon, Edit2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { users, loading, meta, listUsers, createUser } = useUsers();
  const { roles, listRoles } = useRoles();
  const { assignRoles } = useUserRoles();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<UserListItem | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    roleIds: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateUsers = user?.permissions?.includes("users:create");
  const canManageUsers = user?.permissions?.includes("users:manage");

  const getListOptions = (overrides?: { page?: number; limit?: number }) => ({
    page: overrides?.page ?? meta.page,
    limit: overrides?.limit ?? meta.limit,
    q: searchQuery || undefined,
    status: statusFilter !== "all" ? (statusFilter as "active" | "inactive") : undefined,
  });

  useEffect(() => {
    if (!user?.permissions?.includes("users:read")) {
      router.push("/dashboard/settings");
      return;
    }

    listUsers();
    listRoles();
  }, [user?.permissions, router, listUsers, listRoles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    listUsers({
      q: searchQuery || undefined,
      status: statusFilter !== "all" ? (statusFilter as "active" | "inactive") : undefined,
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast.error("El email es requerido");
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser({
        email: formData.email.trim(),
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        roleIds: formData.roleIds.length > 0 ? formData.roleIds : undefined,
      });

      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        roleIds: [],
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const handleOpenRolesModal = (userToEdit: UserListItem) => {
    setSelectedUserForRoles(userToEdit);
    setSelectedRoleIds(userToEdit.roles?.map((r) => r.id) || []);
    setIsRolesModalOpen(true);
  };

  const handleToggleRoleInModal = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSaveRoles = async () => {
    if (!selectedUserForRoles) return;

    setIsSubmitting(true);
    try {
      await assignRoles(selectedUserForRoles.id, selectedRoleIds);
      toast.success("Roles actualizados exitosamente");
      setIsRolesModalOpen(false);
      setSelectedUserForRoles(null);
      setSelectedRoleIds([]);
      await listUsers();
    } catch (error) {
      console.error("Error saving roles:", error);
      toast.error("Error al guardar roles");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-10 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Header
          title="Usuarios"
          description="Gestiona el personal y sus accesos"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        {/* Búsqueda y Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Buscar Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      label="Búsqueda (email o nombre)"
                      placeholder="Buscar usuario..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as "all" | "active" | "inactive")
                    }
                  >
                    <SelectTrigger label="Estado">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    listUsers();
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Botón de Crear Usuario */}
        {canCreateUsers && (
          <div className="mb-6">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Invitar Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
                  <DialogDescription>
                    Completa los datos del usuario y asigna roles iniciales
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <Input
                      id="email"
                      label="Email *"
                      type="email"
                      placeholder="usuario@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Input
                      id="firstName"
                      label="Nombre"
                      placeholder="Juan"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Input
                      id="lastName"
                      label="Apellido"
                      placeholder="Pérez"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">Roles Iniciales</p>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {roles.map((role) => (
                        <div key={role.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`role-${role.id}`}
                            checked={formData.roleIds.includes(role.id)}
                            onChange={() => handleToggleRole(role.id)}
                            disabled={isSubmitting}
                            className="rounded border-gray-300"
                          />
                          <label
                            htmlFor={`role-${role.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {role.name}
                            {role.description && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({role.description})
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      {isSubmitting ? "Invitando..." : "Invitar Usuario"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Tabla de Usuarios */}
        <Card>
          <CardHeader>
            <CardTitle>
              Usuarios ({meta.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay usuarios para mostrar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Nombre</th>
                      <th className="text-left py-3 px-4 font-medium">Roles</th>
                      <th className="text-left py-3 px-4 font-medium">Estado</th>
                      <th className="text-left py-3 px-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b data-[state=selected]:bg-muted hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {u.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {u.firstName && u.lastName
                            ? `${u.firstName} ${u.lastName}`
                            : u.firstName || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles && u.roles.length > 0 ? (
                              u.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-block rounded-full border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] px-2.5 py-1 text-xs font-medium text-foreground"
                                >
                                  {role.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin roles</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              u.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {u.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {canManageUsers && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRolesModal(u)}
                                className="gap-1"
                              >
                                <Edit2 className="h-3 w-3" />
                                Roles
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/settings/users/${u.id}`)}
                            >
                              Ver
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            {meta.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  setPage={() => {}}
                  currentPage={meta.page}
                  totalPages={meta.totalPages}
                  startIndex={(meta.page - 1) * meta.limit + 1}
                  endIndex={Math.min(meta.page * meta.limit, meta.total)}
                  total={meta.total}
                  limit={meta.limit}
                  hasMore={meta.hasMore}
                  onPageChange={(page) => listUsers(getListOptions({ page }))}
                  onLimitChange={(limit) => listUsers(getListOptions({ page: 1, limit }))}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Edición Rápida de Roles */}
        <Dialog open={isRolesModalOpen} onOpenChange={setIsRolesModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Editar Roles - {selectedUserForRoles?.firstName || selectedUserForRoles?.email}
              </DialogTitle>
              <DialogDescription>
                Selecciona los roles que deseas asignar a este usuario
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {roles.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay roles disponibles</p>
              ) : (
                roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`modal-role-${role.id}`}
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => handleToggleRoleInModal(role.id)}
                      disabled={isSubmitting}
                      className="rounded border-gray-300"
                    />
                    <label
                      htmlFor={`modal-role-${role.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {role.name}
                      {role.description && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({role.description})
                        </span>
                      )}
                    </label>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveRoles}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Guardando..." : "Guardar Roles"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRolesModalOpen(false);
                  setSelectedUserForRoles(null);
                  setSelectedRoleIds([]);
                }}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
