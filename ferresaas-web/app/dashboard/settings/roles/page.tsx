"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/ui/header";
import { RolesList } from "./components/RolesList";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDialog } from "@/lib/hooks/useConfirmDialog";

export default function RolesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { roles, loading, meta, listRoles, createRole, deleteRole } = useRoles();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [isCreating, setIsCreating] = useState(false);
  const deleteDialog = useConfirmDialog<{ id: string; name: string }>();

  const canManageRoles = user?.permissions?.includes("roles:manage");

  useEffect(() => {
    if (!canManageRoles) {
      router.push("/dashboard/settings");
      return;
    }
    listRoles({ search });
  }, [search, canManageRoles, router, listRoles]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre del rol es requerido");
      return;
    }

    setIsCreating(true);
    try {
      await createRole({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      setFormData({ name: "", description: "" });
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Error creating role:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRole = (role: any) => {
    deleteDialog.open({ id: role.id, name: role.name });
  };

  const confirmDeleteRole = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteRole(deleteDialog.data.id);
    } catch (error) {
      console.error("Error deleting role:", error);
    } finally {
      deleteDialog.close();
    }
  };

  if (!canManageRoles) {
    return null;
  }

  return (
    <div className="app-page">
      <div className="app-section">
        <Header
          title="Roles y Permisos"
          description="Define perfiles internos, permisos por recurso y estructura operativa del negocio."
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Roles cargados</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{roles.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Perfiles disponibles en la instancia actual.</p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Búsqueda activa</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{search ? 1 : 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">Filtro aplicado sobre el listado de roles.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Sugerencia</p>
            <p className="mt-3 text-lg font-semibold text-foreground">Mantén pocos roles bien definidos</p>
            <p className="mt-2 text-sm brand-accent-subtle">Menos solapamiento implica menos errores operativos y menos complejidad.</p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Rol
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Rol</DialogTitle>
                <DialogDescription>
                  Define un nuevo rol para tu negocio
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Rol</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Gerente de Ventas"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={isCreating}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Input
                    id="description"
                    placeholder="Ej: Gestiona ventas y clientes"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    disabled={isCreating}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1"
                  >
                    {isCreating ? "Creando..." : "Crear Rol"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <RolesList roles={roles} loading={loading} onDelete={handleDeleteRole} />

        {meta?.hasMore && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => listRoles({ search, page: meta.page + 1 })}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Cargar más"}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && deleteDialog.close()}
        onConfirm={confirmDeleteRole}
        title="Eliminar Rol"
        description={`¿Estás seguro de que deseas eliminar el rol "${deleteDialog.data?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
