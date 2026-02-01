"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import Header from "@/components/ui/header";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdatePersonal = async () => {
    if (!firstName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setLoadingPersonal(true);
    try {
      const response = await api.put<any>("/auth/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (response.data) {
        // Actualizar el contexto de autenticación con los nuevos datos
        updateUser({
          firstName: response.data.firstName || firstName.trim(),
          lastName: response.data.lastName || lastName.trim(),
        });
        
        toast.success("Información personal actualizada");
        setEditingPersonal(false);
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Error al actualizar información personal");
    } finally {
      setLoadingPersonal(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!currentPassword) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }

    if (!newPassword) {
      toast.error("Ingresa una nueva contraseña");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("La nueva contraseña debe ser diferente a la actual");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <Header
          title="Mi Perfil"
          description="Administra tu información personal y seguridad"
          link="/dashboard/settings"
          linkLabel="Volver a Configuración"
        />

        {/* Información del usuario */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>Detalles de tu cuenta</CardDescription>
            </div>
            {!editingPersonal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPersonal(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editingPersonal ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Nombre</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Tu nombre"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Apellido</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Tu apellido"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium mt-1">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El email no se puede cambiar desde aquí
                  </p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleUpdatePersonal}
                    disabled={loadingPersonal}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {loadingPersonal ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingPersonal(false);
                      setFirstName(user?.firstName || "");
                      setLastName(user?.lastName || "");
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Nombre</label>
                    <p className="font-medium">{user?.firstName || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Apellido</label>
                    <p className="font-medium">{user?.lastName || "N/A"}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cambio de contraseña */}
        <Card>
          <CardHeader>
            <CardTitle>Cambiar Contraseña</CardTitle>
            <CardDescription>
              Actualiza tu contraseña regularmente para mantener tu cuenta segura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Contraseña actual */}
              <div>
                <label className="text-sm font-medium">Contraseña Actual</label>
                <div className="relative mt-1">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña actual"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Nueva contraseña */}
              <div>
                <label className="text-sm font-medium">Nueva Contraseña</label>
                <div className="relative mt-1">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa una nueva contraseña"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 8 caracteres
                </p>
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label className="text-sm font-medium">Confirmar Nueva Contraseña</label>
                <div className="relative mt-1">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Actualizando..." : "Actualizar Contraseña"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex-1"
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Información de seguridad */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="text-blue-600 mt-0.5">ℹ️</div>
              <div>
                <p className="text-sm font-medium text-blue-900">Consejos de Seguridad</p>
                <ul className="text-xs text-blue-800 mt-2 space-y-1">
                  <li>• Usa una contraseña única y fuerte</li>
                  <li>• No compartas tu contraseña con nadie</li>
                  <li>• Cambia tu contraseña regularmente</li>
                  <li>• Usa caracteres especiales, números y mayúsculas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
