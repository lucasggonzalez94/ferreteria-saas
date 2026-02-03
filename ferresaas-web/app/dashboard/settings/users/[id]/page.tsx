"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUsers } from "@/lib/hooks/useUsers";
import { useUserRoles } from "@/lib/hooks/useUserRoles";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/ui/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { Lock, Mail, User as UserIcon } from "lucide-react";

export default function UserDetailPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const { getUser, updateUser, toggleUserStatus, requestPasswordReset } = useUsers();
  const { getUserRoles, assignRoles } = useUserRoles();
  const { roles, listRoles } = useRoles();

  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "" });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const canManageUsers = currentUser?.permissions?.includes("users:manage");
  const canUpdateUsers = currentUser?.permissions?.includes("users:update");

  useEffect(() => {
    if (!canManageUsers && !canUpdateUsers) {
      router.push("/dashboard/settings");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const userData = await getUser(userId);
        if (userData) {
          setUser(userData);
          setFormData({
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
          });
          setSelectedRoleIds(userData.roles?.map((r: any) => r.id) || []);
        }
        const rolesData = await getUserRoles(userId);
        if (rolesData) {
          setUserRoles(rolesData);
        }
        await listRoles();
      } catch (error) {
        console.error("Error loading user:", error);
        toast.error("Error al cargar el usuario");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId, canManageUsers, canUpdateUsers, router, getUser, getUserRoles, listRoles]);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      await updateUser(userId, {
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
      });
      setEditing(false);
      const updated = await getUser(userId);
      if (updated) {
        setUser(updated);
      }
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSaveRoles = async () => {
    setIsSaving(true);
    try {
      await assignRoles(userId, selectedRoleIds);
      const rolesData = await getUserRoles(userId);
      if (rolesData) {
        setUserRoles(rolesData);
      }
    } catch (error) {
      console.error("Error saving roles:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsSaving(true);
    try {
      const newStatus = !user.isActive;
      await toggleUserStatus(userId, newStatus);
      const updated = await getUser(userId);
      if (updated) {
        setUser(updated);
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setIsSaving(true);
    try {
      await requestPasswordReset(userId);
    } catch (error) {
      console.error("Error requesting password reset:", error);
    } finally {
      setIsSaving(false);
    }
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

  if (!user) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Usuario no encontrado
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!canManageUsers && !canUpdateUsers) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Header
          title={user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
          description={user.email}
          link="/dashboard/settings/users"
          linkLabel="Volver a Usuarios"
        />

        {/* Información del Usuario */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Información del Usuario</CardTitle>
            </div>
            {canUpdateUsers && !editing && (
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
              <form onSubmit={handleSaveInfo} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="mt-1 bg-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    disabled={isSaving}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    disabled={isSaving}
                    className="mt-1"
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
                        firstName: user.firstName || "",
                        lastName: user.lastName || "",
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
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nombre</Label>
                  <p className="font-medium mt-1">
                    {user.firstName || "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Apellido</Label>
                  <p className="font-medium mt-1">
                    {user.lastName || "-"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <Label className="text-muted-foreground">Estado</Label>
                    <p className="font-medium mt-1">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Roles</Label>
                    <p className="font-medium mt-1">{user.roleCount || 0}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Acciones */}
        {canUpdateUsers && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleToggleStatus}
                disabled={isSaving}
              >
                {user.isActive ? "Desactivar Usuario" : "Activar Usuario"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleResetPassword}
                disabled={isSaving}
              >
                Enviar Reset de Contraseña
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Roles del Usuario */}
        {canManageUsers && (
          <Card>
            <CardHeader>
              <CardTitle>Roles Asignados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {roles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No hay roles disponibles
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {roles.map((role) => (
                        <div key={role.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`role-${role.id}`}
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={() => handleToggleRole(role.id)}
                            disabled={isSaving}
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
                          {role.isSystem && (
                            <Lock className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSaveRoles}
                        disabled={isSaving}
                        className="flex-1"
                      >
                        {isSaving ? "Guardando..." : "Guardar Roles"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
