"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Permission,
  PermissionsListResponse,
  ResourcesResponse,
  ActionsResponse,
} from "@/types/rbac";
import { toast } from "sonner";

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listar permisos
  const listPermissions = useCallback(
    async (search?: string, resource?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: "100",
          ...(search && { q: search }),
          ...(resource && { resource }),
        });

        const response = await api.get<PermissionsListResponse>(
          `/permissions?${params.toString()}`
        );

        if (response.success) {
          const items = Array.isArray(response.data)
            ? response.data
            : response.data?.items ?? [];
          setPermissions(items);
        }
      } catch (err: any) {
        setError(err.message);
        toast.error("Error al cargar permisos");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Obtener recursos disponibles
  const getResources = useCallback(async () => {
    try {
      const response = await api.get<ResourcesResponse>(
        "/permissions/resources"
      );
      if (response.success && response.data) {
        setResources(response.data.resources);
        return response.data.resources;
      }
    } catch (err: any) {
      toast.error("Error al cargar recursos");
    }
  }, []);

  // Obtener acciones por recurso
  const getActionsByResource = useCallback(async (resource: string) => {
    try {
      const response = await api.get<ActionsResponse>(
        `/permissions/resources/${resource}/actions`
      );
      if (response.success && response.data) {
        return response.data.actions;
      }
    } catch (err: any) {
      toast.error("Error al cargar acciones");
    }
  }, []);

  return {
    permissions,
    resources,
    loading,
    error,
    listPermissions,
    getResources,
    getActionsByResource,
  };
}
