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

export default function RolesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { roles, loading, meta, listRoles, createRole, deleteRole } = useRoles();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [isCreating, setIsCreating] = useState(false);

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

  const handleDeleteRole = async (role: any) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el rol "${role.name}"?`)) {
      try {
        await deleteRole(role.id);
      } catch (error) {
        console.error("Error deleting role:", error);
      }
    }
  };

  if (!canManageRoles) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          title="Roles y Permisos"
          description="Gestiona los roles y permisos de tu negocio"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

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
            <Button variant="outline">Cargar más</Button>
          </div>
        )}
      </div>
    </div>
  );
}
