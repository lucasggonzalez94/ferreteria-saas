"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Role, RolesListResponse } from "@/types/rbac";
import { toast } from "sonner";

interface UseRolesOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Listar roles
  const listRoles = useCallback(async (options?: UseRolesOptions) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(options?.page || 1),
        limit: String(options?.limit || 10),
        ...(options?.search && { q: options.search }),
      });

      const response = await api.get<RolesListResponse>(
        `/roles?${params.toString()}`
      );

      if (response.success) {
        const items = Array.isArray(response.data)
          ? response.data
          : response.data?.items ?? [];

        const apiMeta =
          (response as { meta?: RolesListResponse['meta'] }).meta ??
          response.data?.meta;

        const fallbackLimit = items.length || 10;
        const baseMeta = {
          page: apiMeta?.page ?? 1,
          limit: apiMeta?.limit ?? fallbackLimit,
          total: apiMeta?.total ?? items.length,
        };

        const totalPages =
          apiMeta?.totalPages ??
          Math.max(1, Math.ceil(baseMeta.total / (baseMeta.limit || 1)));

        const hasMore =
          apiMeta?.hasMore ?? baseMeta.page < totalPages;

        setRoles(items);
        setMeta({
          ...baseMeta,
          totalPages,
          hasMore,
        });
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Error al cargar roles");
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener rol por ID
  const getRole = useCallback(async (roleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Role>(`/roles/${roleId}`);
      if (response.success && response.data) {
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Error al cargar rol");
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear rol
  const createRole = useCallback(
    async (data: {
      name: string;
      description?: string;
      permissionIds?: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<Role>("/roles", data);
        if (response.success && response.data) {
          toast.success("Rol creado exitosamente");
          await listRoles();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al crear rol");
      } finally {
        setLoading(false);
      }
    },
    [listRoles]
  );

  // Actualizar rol
  const updateRole = useCallback(
    async (
      roleId: string,
      data: {
        name?: string;
        description?: string;
        permissionIds?: string[];
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.put<Role>(`/roles/${roleId}`, data);
        if (response.success && response.data) {
          toast.success("Rol actualizado exitosamente");
          await listRoles();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al actualizar rol");
      } finally {
        setLoading(false);
      }
    },
    [listRoles]
  );

  // Eliminar rol
  const deleteRole = useCallback(
    async (roleId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.delete(`/roles/${roleId}`);
        if (response.success) {
          toast.success("Rol eliminado exitosamente");
          await listRoles();
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Error al eliminar rol");
      } finally {
        setLoading(false);
      }
    },
    [listRoles]
  );

  return {
    roles,
    loading,
    error,
    meta,
    listRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
  };
}
