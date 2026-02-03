"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { User } from "@/types";
import { toast } from "sonner";

interface UseUsersOptions {
  page?: number;
  limit?: number;
  q?: string;
  status?: "active" | "inactive";
  roleId?: string;
}

interface UserListItem {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: string;
  roleCount: number;
  roles: Array<{ id: string; name: string }>;
}

interface UsersListResponse {
  items: UserListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function useUsers() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Listar usuarios
  const listUsers = useCallback(async (options?: UseUsersOptions) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(options?.page || 1),
        limit: String(options?.limit || 10),
        ...(options?.q && { q: options.q }),
        ...(options?.status && { status: options.status }),
        ...(options?.roleId && { roleId: options.roleId }),
      });

      const response = await api.get<UsersListResponse>(
        `/users?${params.toString()}`
      );

      if (response.success && response.data) {
        setUsers(response.data.items);
        setMeta(response.data.meta);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener usuario por ID
  const getUser = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<any>(
        `/users/${userId}`
      );
      if (response.success && response.data) {
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Error al cargar usuario");
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear/invitar usuario
  const createUser = useCallback(
    async (data: {
      email: string;
      firstName?: string;
      lastName?: string;
      roleIds?: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<User>("/users", data);
        if (response.success && response.data) {
          toast.success("Usuario invitado exitosamente");
          await listUsers();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al invitar usuario");
      } finally {
        setLoading(false);
      }
    },
    [listUsers]
  );

  // Actualizar usuario
  const updateUser = useCallback(
    async (
      userId: string,
      data: {
        firstName?: string;
        lastName?: string;
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.put<User>(`/users/${userId}`, data);
        if (response.success && response.data) {
          toast.success("Usuario actualizado exitosamente");
          await listUsers();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al actualizar usuario");
      } finally {
        setLoading(false);
      }
    },
    [listUsers]
  );

  // Cambiar estado del usuario
  const toggleUserStatus = useCallback(
    async (userId: string, isActive: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.patch<User>(`/users/${userId}/status`, {
          isActive,
        });
        if (response.success && response.data) {
          toast.success(
            isActive ? "Usuario activado" : "Usuario desactivado"
          );
          await listUsers();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al cambiar estado del usuario");
      } finally {
        setLoading(false);
      }
    },
    [listUsers]
  );

  // Disparar reset de contraseña
  const requestPasswordReset = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/users/${userId}/reset-password`, {});
      if (response.success) {
        toast.success("Email de reset enviado al usuario");
        return true;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Error al enviar reset de contraseña");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    users,
    loading,
    error,
    meta,
    listUsers,
    getUser,
    createUser,
    updateUser,
    toggleUserStatus,
    requestPasswordReset,
  };
}
