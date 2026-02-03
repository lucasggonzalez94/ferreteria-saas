# Guía de Frontend - Gestión de Roles y Permisos

**Fecha:** 2 de Febrero, 2026  
**Versión:** 1.0  
**Estado:** Implementación Completada

---

## 1. Resumen de Implementación

Se ha implementado una UI completa para gestión de roles y permisos en el frontend, siguiendo los patrones existentes del proyecto. La implementación incluye:

✅ **Tipos TypeScript** - Tipos RBAC en `types/rbac.ts`  
✅ **Hooks Personalizados** - Hooks para consumir API RBAC  
✅ **Componentes** - Componentes reutilizables para UI de roles  
✅ **Páginas** - Página principal y detalle de roles  
✅ **Integración** - Integración con AuthContext y API client  

---

## 2. Estructura de Archivos Creados

### 2.1 Tipos TypeScript

**Archivo:** `types/rbac.ts`

```typescript
// Tipos principales:
- Role - Información de rol con permisos
- Permission - Permiso individual
- UserRole - Asignación de roles a usuario
- RolesListResponse - Respuesta paginada de roles
- PermissionsListResponse - Respuesta paginada de permisos
- ResourcesResponse - Lista de recursos disponibles
- ActionsResponse - Acciones por recurso
- RoleUsersResponse - Usuarios con un rol específico
```

### 2.2 Hooks Personalizados

**Ubicación:** `lib/hooks/`

#### useRoles.ts
```typescript
// Métodos:
- listRoles(options) - Listar roles con paginación
- getRole(roleId) - Obtener rol por ID
- createRole(data) - Crear nuevo rol
- updateRole(roleId, data) - Actualizar rol
- deleteRole(roleId) - Eliminar rol

// Estado:
- roles: Role[]
- loading: boolean
- error: string | null
- meta: PaginationMeta
```

#### usePermissions.ts
```typescript
// Métodos:
- listPermissions(search, resource) - Listar permisos
- getResources() - Obtener recursos disponibles
- getActionsByResource(resource) - Obtener acciones por recurso

// Estado:
- permissions: Permission[]
- resources: string[]
- loading: boolean
- error: string | null
```

#### useUserRoles.ts
```typescript
// Métodos:
- getUserRoles(userId) - Obtener roles de usuario
- assignRoles(userId, roleIds) - Asignar roles
- addRole(userId, roleId) - Agregar rol
- removeRole(userId, roleId) - Remover rol

// Estado:
- userRoles: UserRole | null
- loading: boolean
- error: string | null
```

### 2.3 Componentes

**Ubicación:** `app/dashboard/settings/roles/components/`

#### RolesList.tsx
```typescript
// Props:
- roles: Role[]
- loading: boolean
- onDelete?: (role: Role) => void

// Características:
- Grid responsivo (1-3 columnas)
- Skeleton loaders
- Badges de permisos y usuarios
- Botones de acción
```

### 2.4 Páginas

#### Página Principal de Roles
**Ubicación:** `app/dashboard/settings/roles/page.tsx`

- Listar roles con búsqueda
- Crear nuevo rol (diálogo)
- Validación de permisos
- Manejo de errores

#### Página de Detalle de Rol
**Ubicación:** `app/dashboard/settings/roles/[id]/page.tsx`

- Ver información del rol
- Editar nombre y descripción
- Gestionar permisos
- Protección de roles del sistema

---

## 3. Flujos de Uso

### 3.1 Listar Roles

```typescript
// En componente
const { roles, loading, listRoles } = useRoles();

useEffect(() => {
  listRoles({ search: "gerente" });
}, []);

// Render
<RolesList roles={roles} loading={loading} />
```

### 3.2 Crear Rol

```typescript
const { createRole } = useRoles();

const handleCreate = async (data) => {
  await createRole({
    name: "Gerente de Ventas",
    description: "Gestiona ventas",
    permissionIds: ["perm1", "perm2"]
  });
};
```

### 3.3 Actualizar Rol

```typescript
const { updateRole } = useRoles();

const handleUpdate = async (roleId, data) => {
  await updateRole(roleId, {
    name: "Nuevo nombre",
    permissionIds: ["perm1", "perm3"]
  });
};
```

### 3.4 Obtener Permisos Disponibles

```typescript
const { permissions, resources, listPermissions, getResources } = usePermissions();

useEffect(() => {
  getResources();
  listPermissions();
}, []);

// Agrupar por recurso
const grouped = permissions.reduce((acc, perm) => {
  if (!acc[perm.resource]) acc[perm.resource] = [];
  acc[perm.resource].push(perm);
  return acc;
}, {});
```

### 3.5 Asignar Roles a Usuario

```typescript
const { assignRoles } = useUserRoles();

const handleAssign = async (userId, roleIds) => {
  await assignRoles(userId, roleIds);
};
```

---

## 4. Validación de Permisos en Frontend

### 4.1 Verificar Permiso

```typescript
const { user } = useAuth();

// Verificar si usuario tiene permiso
const canManageRoles = user?.permissions?.includes("roles:manage");

if (!canManageRoles) {
  return <div>No tienes permisos</div>;
}
```

### 4.2 Proteger Rutas

```typescript
useEffect(() => {
  if (!user?.permissions?.includes("roles:manage")) {
    router.push("/dashboard/settings");
  }
}, [user?.permissions, router]);
```

---

## 5. Manejo de Errores

### Errores Comunes

```typescript
const errorMessages: Record<string, string> = {
  ROLE_EXISTS: "El nombre del rol ya existe",
  SYSTEM_ROLE: "No se pueden modificar roles del sistema",
  ROLE_IN_USE: "No se puede eliminar rol con usuarios asignados",
  INVALID_PERMISSIONS: "Uno o más permisos no son válidos",
  FORBIDDEN: "No tienes permisos para esta acción",
};
```

### Manejo en Hooks

```typescript
try {
  const response = await api.post("/roles", data);
  if (response.success) {
    toast.success("Rol creado exitosamente");
  }
} catch (err: any) {
  const message = errorMessages[err.code] || err.message;
  toast.error(message);
}
```

---

## 6. Estados de Carga

### Skeleton Loaders

```typescript
// En RolesList.tsx
if (loading) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
```

### Estados de Botones

```typescript
<Button disabled={isLoading}>
  {isLoading ? "Guardando..." : "Guardar"}
</Button>
```

---

## 7. Responsividad

### Grid Responsivo

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Contenido */}
</div>
```

**Breakpoints:**
- Mobile: 1 columna
- Tablet (md): 2 columnas
- Desktop (lg): 3 columnas

---

## 8. Integración con API Client

### Método PATCH Agregado

Se agregó el método `patch` al cliente API en `lib/api.ts`:

```typescript
async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return this.request<T>(endpoint, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

**Uso:**
```typescript
const response = await api.patch("/users/123/roles", { roleIds: [...] });
```

---

## 9. Tipos de Usuario Actualizados

**Archivo:** `types/index.ts`

```typescript
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessId: string;
  roles?: string[];           // ✅ NUEVO
  permissions?: string[];     // ✅ NUEVO
}
```

---

## 10. Checklist de Implementación

### Tipos y Hooks
- [x] Crear `types/rbac.ts`
- [x] Crear `lib/hooks/useRoles.ts`
- [x] Crear `lib/hooks/usePermissions.ts`
- [x] Crear `lib/hooks/useUserRoles.ts`
- [x] Actualizar `types/index.ts` (User)

### Componentes
- [x] Crear `RolesList.tsx`
- [x] Crear componentes de formulario

### Páginas
- [x] Crear `app/dashboard/settings/roles/page.tsx`
- [x] Crear `app/dashboard/settings/roles/[id]/page.tsx`

### Integración
- [x] Agregar método `patch` a API client
- [x] Validación de permisos en frontend
- [x] Manejo de errores

---

## 11. Próximos Pasos (Opcionales)

### Corto Plazo
1. Crear componente `UserRolesManager` para asignar roles a usuarios
2. Integrar en página de usuarios
3. Crear componente `PermissionSelector` reutilizable
4. Testing manual de flujos

### Mediano Plazo
1. Crear página de auditoría de cambios RBAC
2. Crear reportes de permisos por usuario
3. Crear plantillas de roles predefinidas
4. Implementar búsqueda avanzada de roles

### Largo Plazo
1. Crear UI para gestión de permisos globales
2. Implementar delegación de permisos
3. Crear políticas de acceso basadas en atributos (ABAC)
4. Implementar sincronización de permisos en tiempo real

---

## 12. Consideraciones de Seguridad

### Validación en Frontend

```typescript
// Siempre validar permisos antes de mostrar UI
const canManageRoles = user?.permissions?.includes("roles:manage");
if (!canManageRoles) {
  return <AccessDenied />;
}
```

### Confianza en Backend

```typescript
// El backend valida permisos en cada request
// El frontend solo controla la UI
// Si el usuario intenta hacer request sin permisos, el backend lo rechaza
```

### Manejo de Tokens

```typescript
// El cliente API maneja automáticamente:
// - Refresh de tokens
// - CSRF tokens
// - Cookies HttpOnly
// No hay que hacer nada especial en componentes
```

---

## 13. Patrones de Código

### Patrón de Hook

```typescript
const { data, loading, error, action } = useCustomHook();

useEffect(() => {
  action();
}, []);

if (loading) return <Skeleton />;
if (error) return <Error />;
return <Component data={data} />;
```

### Patrón de Formulario

```typescript
const [formData, setFormData] = useState({ field: "" });
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  try {
    await api.post("/endpoint", formData);
    toast.success("Éxito");
  } catch (err) {
    toast.error(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Patrón de Componente

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCustomHook } from "@/lib/hooks/useCustom";

export default function ComponentName() {
  const { user } = useAuth();
  const { data, loading, action } = useCustomHook();

  useEffect(() => {
    action();
  }, []);

  return (
    <div>
      {/* Contenido */}
    </div>
  );
}
```

---

## 14. Componentes UI Disponibles

**Ubicación:** `components/ui/`

- `button.tsx` - Botones con variantes
- `card.tsx` - Cards con header, title, description, content
- `input.tsx` - Inputs de texto
- `label.tsx` - Labels para formularios
- `dialog.tsx` - Diálogos modales
- `select.tsx` - Selects
- `header.tsx` - Header personalizado

---

## 15. Iconos Disponibles

**Librería:** Lucide React

```typescript
import { Plus, Search, Edit2, Trash2, Lock, Check, X } from "lucide-react";
```

---

## 16. Conclusión

La implementación de la UI de gestión de roles y permisos está **completa y lista para usar**:

✅ **Tipos TypeScript** - Totalmente tipado  
✅ **Hooks** - Lógica reutilizable  
✅ **Componentes** - Componentes limpios y simples  
✅ **Páginas** - Páginas funcionales  
✅ **Integración** - Integrada con API y AuthContext  
✅ **Seguridad** - Validación de permisos en frontend  
✅ **Errores** - Manejo robusto de errores  

**Próximo paso:** Crear componente `UserRolesManager` para asignar roles a usuarios en página de usuarios.

---

**Versión:** 1.0  
**Última actualización:** 2 de Febrero, 2026
