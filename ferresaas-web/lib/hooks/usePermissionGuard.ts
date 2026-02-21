"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Hook para proteger rutas basado en permisos del usuario.
 * Redirige automáticamente si el usuario no tiene el permiso requerido.
 * 
 * @param requiredPermission - Permiso requerido en formato "resource:action"
 * @param redirectTo - Ruta a la que redirigir si no tiene permiso (default: "/dashboard")
 * @returns boolean - true si el usuario tiene el permiso, false en caso contrario
 * 
 * @example
 * const canView = usePermissionGuard("products:read");
 * if (!canView) return null; // Opcional: mostrar loading mientras redirige
 */
export function usePermissionGuard(
  requiredPermission: string,
  redirectTo: string = "/dashboard"
): boolean {
  const { user } = useAuth();
  const router = useRouter();

  const hasPermission = user?.permissions?.includes(requiredPermission) ?? false;

  useEffect(() => {
    if (!hasPermission) {
      router.push(redirectTo);
    }
  }, [hasPermission, redirectTo, router]);

  return hasPermission;
}

/**
 * Hook para verificar múltiples permisos sin redirección automática.
 * Útil cuando necesitas verificar varios permisos en la misma página.
 * 
 * @param permissions - Array de permisos a verificar
 * @returns objeto con cada permiso como key y boolean como value
 * 
 * @example
 * const { canCreate, canUpdate, canDelete } = usePermissions({
 *   canCreate: "products:create",
 *   canUpdate: "products:update",
 *   canDelete: "products:delete",
 * });
 */
export function usePermissions<T extends Record<string, string>>(
  permissions: T
): Record<keyof T, boolean> {
  const { user } = useAuth();

  const result = {} as Record<keyof T, boolean>;

  for (const [key, permission] of Object.entries(permissions)) {
    result[key as keyof T] = user?.permissions?.includes(permission) ?? false;
  }

  return result;
}
