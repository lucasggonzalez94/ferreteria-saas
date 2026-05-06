"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/hooks/useRoles";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { Role, Permission } from "@/types/rbac";
import { Check, X, Lock } from "lucide-react";

export default function RoleDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const { getRole, updateRole } = useRoles();
  const { permissions, listPermissions } = usePermissions();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const canManageRoles = user?.permissions?.includes("roles:manage");

  useEffect(() => {
    if (!canManageRoles) {
      router.push("/dashboard/settings");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const roleData = await getRole(roleId);
        if (roleData) {
          setRole(roleData);
          setFormData({
            name: roleData.name,
            description: roleData.description || "",
          });
          setSelectedPermissionIds(roleData.permissions.map((p) => p.id));
        }
        await listPermissions();
      } catch (error) {
        console.error("Error loading role:", error);
        toast.error("Error al cargar el rol");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roleId, canManageRoles, router, getRole, listPermissions]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre del rol es requerido");
      return;
    }

    setIsSaving(true);
    try {
      await updateRole(roleId, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permissionIds: selectedPermissionIds,
      });
      setEditing(false);
    } catch (error) {
      console.error("Error saving role:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-10 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Rol no encontrado
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!canManageRoles) {
    return null;
  }

  const groupedPermissions = (permissions ?? []).reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <div className="app-page">
      <div className="app-section max-w-4xl">
        <Header
          title={role.name}
          description={role.description || "Sin descripción"}
          link="/dashboard/settings/roles"
          linkLabel="Volver a Roles"
        />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Permisos</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{role.permissionCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">Accesos actualmente asociados a este rol.</p>
          </div>
          <div className="app-panel-muted rounded-[1.4rem] p-4">
            <p className="text-sm font-semibold text-foreground">Usuarios</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{role.userCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">Personas que hoy dependen de esta configuración.</p>
          </div>
          <div className="brand-accent-panel p-4">
            <p className="text-sm font-semibold text-foreground">Tipo</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{role.isSystem ? "Rol del sistema" : "Rol editable"}</p>
            <p className="mt-2 text-sm brand-accent-subtle">Diferencia entre perfiles protegidos y perfiles administrables.</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Información del Rol</CardTitle>
            </div>
            {!role.isSystem && !editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <Input
                    id="name"
                    label="Nombre del Rol"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Input
                    id="description"
                    label="Descripción"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSaving} className="flex-1">
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setFormData({
                        name: role.name,
                        description: role.description || "",
                      });
                    }}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium">{role.name}</p>
                    {role.isSystem && (
                      <Lock className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                  <p className="font-medium mt-1">
                    {role.description || "Sin descripción"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Permisos</p>
                    <p className="font-medium mt-1">{role.permissionCount}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Usuarios</p>
                    <p className="font-medium mt-1">{role.userCount}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Permisos */}
        <Card>
          <CardHeader>
            <CardTitle>Permisos del Rol</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource}>
                    <h4 className="font-medium mb-3 capitalize text-sm">
                      {resource}
                    </h4>
                    <div className="space-y-2 pl-4">
                      {perms.map((perm) => (
                        <div key={perm.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={perm.id}
                            checked={selectedPermissionIds.includes(perm.id)}
                            onChange={() => handleTogglePermission(perm.id)}
                            disabled={isSaving}
                            className="rounded border-gray-300"
                          />
                          <label
                            htmlFor={perm.id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {perm.action}
                            {perm.description && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({perm.description})
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([resource, perms]) => {
                  const resourcePerms = perms.filter((p) =>
                    selectedPermissionIds.includes(p.id)
                  );
                  if (resourcePerms.length === 0) return null;

                  return (
                    <div key={resource}>
                      <h4 className="font-medium mb-3 capitalize text-sm">
                        {resource}
                      </h4>
                      <div className="space-y-2 pl-4">
                        {resourcePerms.map((perm) => (
                          <div key={perm.id} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm">
                              {perm.action}
                              {perm.description && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({perm.description})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
