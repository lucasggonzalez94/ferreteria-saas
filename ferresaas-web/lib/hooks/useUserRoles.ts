"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { UserRole } from "@/types/rbac";
import { toast } from "sonner";

export function useUserRoles() {
  const [userRoles, setUserRoles] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener roles de usuario
  const getUserRoles = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<UserRole>(`/users/${userId}/roles`);
      if (response.success && response.data) {
        setUserRoles(response.data);
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Error al cargar roles del usuario");
    } finally {
      setLoading(false);
    }
  }, []);

  // Asignar roles a usuario
  const assignRoles = useCallback(async (userId: string, roleIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch<UserRole>(`/users/${userId}/roles`, {
        roleIds,
      });
      if (response.success && response.data) {
        setUserRoles(response.data);
        toast.success("Roles asignados exitosamente");
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Error al asignar roles");
    } finally {
      setLoading(false);
    }
  }, []);

  // Agregar rol a usuario
  const addRole = useCallback(async (userId: string, roleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<UserRole>(`/users/${userId}/roles`, {
        roleId,
      });
      if (response.success && response.data) {
        setUserRoles(response.data);
        toast.success("Rol agregado exitosamente");
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Error al agregar rol");
    } finally {
      setLoading(false);
    }
  }, []);

  // Remover rol de usuario
  const removeRole = useCallback(async (userId: string, roleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.delete<UserRole>(
        `/users/${userId}/roles/${roleId}`
      );
      if (response.success && response.data) {
        setUserRoles(response.data);
        toast.success("Rol removido exitosamente");
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Error al remover rol");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    userRoles,
    loading,
    error,
    getUserRoles,
    assignRoles,
    addRole,
    removeRole,
  };
}
