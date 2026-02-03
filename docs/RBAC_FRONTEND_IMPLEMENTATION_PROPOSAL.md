# Propuesta de Implementación - UI de Gestión de Roles y Permisos

**Fecha:** 2 de Febrero, 2026  
**Versión:** 1.0  
**Estado:** Propuesta Detallada

---

## Resumen Ejecutivo

Se propone implementar una UI completa para gestión de roles y permisos en el frontend, siguiendo los patrones existentes del proyecto. La implementación incluye:

- ✅ Página principal de listado de roles
- ✅ Página de detalle y edición de rol
- ✅ Diálogo para crear nuevo rol
- ✅ Selector de permisos con búsqueda
- ✅ Gestión de asignación de roles a usuarios
- ✅ Validación de permisos en frontend
- ✅ Manejo de errores y estados de carga

**Tiempo estimado:** 3-4 horas  
**Complejidad:** Media  
**Riesgo de ruptura:** Bajo (patrones existentes)

---

## 1. Estructura de Carpetas Propuesta

```
ferresaas-web/
├── app/
│   └── dashboard/
│       └── settings/
│           ├── roles/                    # NUEVA CARPETA
│           │   ├── page.tsx             # Listar roles
│           │   ├── [id]/
│           │   │   └── page.tsx         # Detalle de rol
│           │   └── components/
│           │       ├── RolesList.tsx
│           │       ├── RoleForm.tsx
│           │       ├── PermissionSelector.tsx
│           │       ├── RoleDialog.tsx
│           │       └── UserRolesManager.tsx
│           └── users/
│               └── [id]/
│                   └── components/
│                       └── UserRolesManager.tsx  # Asignar roles a usuario
├── lib/
│   └── hooks/                           # NUEVA CARPETA
│       ├── useRoles.ts                 # Hook para CRUD de roles
│       ├── usePermissions.ts           # Hook para obtener permisos
│       └── useUserRoles.ts             # Hook para asignar roles a usuarios
├── components/
│   └── rbac/                            # NUEVA CARPETA
│       ├── PermissionBadge.tsx         # Badge de permiso
│       ├── RoleCard.tsx                # Card de rol
│       └── PermissionGrid.tsx          # Grid de permisos
└── types/
    └── rbac.ts                          # NUEVO ARCHIVO - Tipos RBAC
```

---

## 2. Tipos TypeScript Propuestos

**Archivo:** `types/rbac.ts`

```typescript
// Tipos para Roles
export interface Role {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

// Tipos para Permisos
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  fullName: string;
  roleCount?: number;
  createdAt?: string;
}

// Tipos para Asignación de Roles
export interface UserRole {
  userId: string;
  roles: Role[];
}

// Tipos para Respuestas de API
export interface RolesListResponse {
  items: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PermissionsListResponse {
  items: Permission[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ResourcesResponse {
  resources: string[];
}

export interface ActionsResponse {
  resource: string;
  actions: string[];
}
```

---

## 3. Hooks Personalizados Propuestos

### 3.1 useRoles.ts

```typescript
// lib/hooks/useRoles.ts

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Role, RolesListResponse } from '@/types/rbac';
import { toast } from 'sonner';

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

      if (response.success && response.data) {
        setRoles(response.data.items);
        setMeta(response.data.meta);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Error al cargar roles');
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
      toast.error('Error al cargar rol');
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
        const response = await api.post<Role>('/roles', data);
        if (response.success && response.data) {
          toast.success('Rol creado exitosamente');
          await listRoles();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || 'Error al crear rol');
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
          toast.success('Rol actualizado exitosamente');
          await listRoles();
          return response.data;
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || 'Error al actualizar rol');
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
          toast.success('Rol eliminado exitosamente');
          await listRoles();
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || 'Error al eliminar rol');
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
```

### 3.2 usePermissions.ts

```typescript
// lib/hooks/usePermissions.ts

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Permission, PermissionsListResponse, ResourcesResponse, ActionsResponse } from '@/types/rbac';
import { toast } from 'sonner';

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listar permisos
  const listPermissions = useCallback(async (search?: string, resource?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(search && { q: search }),
        ...(resource && { resource }),
      });

      const response = await api.get<PermissionsListResponse>(
        `/permissions?${params.toString()}`
      );

      if (response.success && response.data) {
        setPermissions(response.data.items);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener recursos disponibles
  const getResources = useCallback(async () => {
    try {
      const response = await api.get<ResourcesResponse>('/permissions/resources');
      if (response.success && response.data) {
        setResources(response.data.resources);
        return response.data.resources;
      }
    } catch (err: any) {
      toast.error('Error al cargar recursos');
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
      toast.error('Error al cargar acciones');
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
```

### 3.3 useUserRoles.ts

```typescript
// lib/hooks/useUserRoles.ts

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { UserRole } from '@/types/rbac';
import { toast } from 'sonner';

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
      toast.error('Error al cargar roles del usuario');
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
        toast.success('Roles asignados exitosamente');
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al asignar roles');
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
        toast.success('Rol agregado exitosamente');
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al agregar rol');
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
        toast.success('Rol removido exitosamente');
        return response.data;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al remover rol');
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
```

---

## 4. Componentes Propuestos

### 4.1 RolesList.tsx

```typescript
// app/dashboard/settings/roles/components/RolesList.tsx

"use client";

import { Role } from "@/types/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit2, Trash2, Lock } from "lucide-react";
import Link from "next/link";

interface RolesListProps {
  roles: Role[];
  loading: boolean;
  onEdit?: (role: Role) => void;
  onDelete?: (role: Role) => void;
}

export function RolesList({ roles, loading, onEdit, onDelete }: RolesListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No hay roles disponibles
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role) => (
        <Card key={role.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <Lock className="h-4 w-4 text-amber-500" title="Rol del sistema" />
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {role.description || "Sin descripción"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{role.permissions.length} permisos</Badge>
              <Badge variant="outline">{role.userCount} usuarios</Badge>
            </div>

            <div className="flex gap-2">
              <Link href={`/dashboard/settings/roles/${role.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Ver
                </Button>
              </Link>
              {!role.isSystem && onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(role)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 4.2 PermissionSelector.tsx

```typescript
// app/dashboard/settings/roles/components/PermissionSelector.tsx

"use client";

import { useState, useEffect } from "react";
import { Permission } from "@/types/rbac";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";

interface PermissionSelectorProps {
  selectedPermissionIds: string[];
  onChange: (permissionIds: string[]) => void;
}

export function PermissionSelector({
  selectedPermissionIds,
  onChange,
}: PermissionSelectorProps) {
  const { permissions, resources, listPermissions, getResources } = usePermissions();
  const [search, setSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  useEffect(() => {
    getResources();
    listPermissions();
  }, []);

  useEffect(() => {
    listPermissions(search, selectedResource || undefined);
  }, [search, selectedResource]);

  const handleToggle = (permissionId: string) => {
    const newIds = selectedPermissionIds.includes(permissionId)
      ? selectedPermissionIds.filter((id) => id !== permissionId)
      : [...selectedPermissionIds, permissionId];
    onChange(newIds);
  };

  const groupedPermissions = permissions.reduce(
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
    <Card>
      <CardHeader>
        <CardTitle>Seleccionar Permisos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar permisos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {resources.length > 0 && (
          <Tabs value={selectedResource || "all"} onValueChange={setSelectedResource}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              {resources.slice(0, 3).map((resource) => (
                <TabsTrigger key={resource} value={resource} className="text-xs">
                  {resource}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {Object.entries(groupedPermissions).map(([resource, perms]) => (
                <div key={resource}>
                  <h4 className="font-medium mb-2 capitalize">{resource}</h4>
                  <div className="space-y-2 pl-4">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-2">
                        <Checkbox
                          id={perm.id}
                          checked={selectedPermissionIds.includes(perm.id)}
                          onCheckedChange={() => handleToggle(perm.id)}
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
            </TabsContent>

            {resources.slice(0, 3).map((resource) => (
              <TabsContent key={resource} value={resource} className="space-y-2 mt-4">
                {groupedPermissions[resource]?.map((perm) => (
                  <div key={perm.id} className="flex items-center gap-2">
                    <Checkbox
                      id={perm.id}
                      checked={selectedPermissionIds.includes(perm.id)}
                      onCheckedChange={() => handleToggle(perm.id)}
                    />
                    <label htmlFor={perm.id} className="text-sm cursor-pointer flex-1">
                      {perm.action}
                      {perm.description && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({perm.description})
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedPermissionIds.length} permisos seleccionados
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 5. Páginas Propuestas

### 5.1 Página Principal de Roles

**Archivo:** `app/dashboard/settings/roles/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/ui/header";
import { RolesList } from "./components/RolesList";
import { RoleDialog } from "./components/RoleDialog";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RolesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { roles, loading, meta, listRoles, deleteRole } = useRoles();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canManageRoles = user?.permissions?.includes("roles:manage");

  useEffect(() => {
    if (!canManageRoles) {
      router.push("/dashboard/settings");
      return;
    }
    listRoles({ search });
  }, [search, canManageRoles, router]);

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
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Rol
          </Button>
        </div>

        <RolesList roles={roles} loading={loading} onDelete={deleteRole} />

        {meta.hasMore && (
          <div className="mt-6 text-center">
            <Button variant="outline">Cargar más</Button>
          </div>
        )}

        <RoleDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            setShowCreateDialog(false);
            listRoles({ search });
          }}
        />
      </div>
    </div>
  );
}
```

---

## 6. Integración con Página de Usuarios

**Ubicación:** `app/dashboard/settings/users/[id]/page.tsx`

Se agregará un componente `UserRolesManager` que permitirá:
- Ver roles actuales del usuario
- Asignar nuevos roles
- Remover roles

```typescript
<UserRolesManager userId={userId} />
```

---

## 7. Validación de Permisos en Frontend

### Hook Personalizado

```typescript
// lib/hooks/usePermission.ts

import { useAuth } from "@/lib/auth-context";

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

// Uso
const canManageRoles = usePermission("roles:manage");
const canReadRoles = usePermission("roles:read");
```

---

## 8. Manejo de Errores Esperados

```typescript
// Errores a manejar:
const errorMessages: Record<string, string> = {
  ROLE_EXISTS: "El nombre del rol ya existe en este negocio",
  SYSTEM_ROLE: "No se pueden modificar roles del sistema",
  ROLE_IN_USE: "No se puede eliminar un rol que tiene usuarios asignados",
  INVALID_PERMISSIONS: "Uno o más permisos no son válidos",
  FORBIDDEN: "No tienes permisos para realizar esta acción",
};
```

---

## 9. Estados de Carga

Implementar Skeleton loaders para:
- Lista de roles
- Detalle de rol
- Selector de permisos
- Lista de usuarios

---

## 10. Responsividad

- Mobile: 1 columna
- Tablet: 2 columnas
- Desktop: 3 columnas

---

## 11. Checklist de Implementación

### Fase 1: Tipos y Hooks
- [ ] Crear `types/rbac.ts`
- [ ] Crear `lib/hooks/useRoles.ts`
- [ ] Crear `lib/hooks/usePermissions.ts`
- [ ] Crear `lib/hooks/useUserRoles.ts`
- [ ] Crear `lib/hooks/usePermission.ts`

### Fase 2: Componentes
- [ ] Crear `RolesList.tsx`
- [ ] Crear `RoleForm.tsx`
- [ ] Crear `PermissionSelector.tsx`
- [ ] Crear `RoleDialog.tsx`
- [ ] Crear `UserRolesManager.tsx`
- [ ] Crear componentes UI auxiliares

### Fase 3: Páginas
- [ ] Crear `app/dashboard/settings/roles/page.tsx`
- [ ] Crear `app/dashboard/settings/roles/[id]/page.tsx`
- [ ] Integrar con página de usuarios

### Fase 4: Testing
- [ ] Validar permisos en frontend
- [ ] Validar manejo de errores
- [ ] Validar responsividad
- [ ] Validar estados de carga

---

## 12. Consideraciones de Seguridad

1. **Validación de Permisos:** Verificar `roles:manage` antes de mostrar UI
2. **Manejo de Errores:** No exponer detalles técnicos al usuario
3. **Tokens:** Confiar en el cliente API para manejar tokens
4. **CSRF:** El cliente API incluye CSRF token automáticamente

---

## 13. Conclusión

La implementación de la UI de gestión de roles y permisos es **factible y de bajo riesgo** siguiendo los patrones existentes del proyecto.

**Ventajas:**
- ✅ Reutiliza componentes shadcn/ui
- ✅ Sigue patrones existentes
- ✅ No requiere cambios en backend
- ✅ Integración limpia con AuthContext
- ✅ Manejo de errores consistente

**Próximo paso:** Implementar siguiendo esta propuesta

---

**Versión:** 1.0  
**Última actualización:** 2 de Febrero, 2026
