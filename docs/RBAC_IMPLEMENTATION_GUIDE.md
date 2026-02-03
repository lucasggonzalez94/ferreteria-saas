# Guía de Implementación RBAC - Sistema de Ferretería SaaS

**Fecha:** 2 de Febrero, 2026  
**Versión:** 1.0  
**Estado:** Implementación Completada

---

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura RBAC](#arquitectura-rbac)
3. [Componentes Implementados](#componentes-implementados)
4. [Flujos Operativos](#flujos-operativos)
5. [Guía de Uso](#guía-de-uso)
6. [Casos de Uso](#casos-de-uso)
7. [Troubleshooting](#troubleshooting)

---

## Introducción

El sistema RBAC (Role-Based Access Control) permite a los administradores de cada negocio:

- **Crear roles personalizados** con nombres y descripciones
- **Asignar permisos granulares** a cada rol (productos:crear, ventas:leer, etc.)
- **Gestionar usuarios** asignando múltiples roles
- **Auditar cambios** en roles, permisos y asignaciones
- **Mantener aislamiento multi-tenant** (cada negocio gestiona sus propios roles)

### Características Clave

✅ **Multi-tenant:** Cada negocio tiene sus propios roles  
✅ **Granular:** Permisos a nivel de recurso + acción  
✅ **Auditado:** Todos los cambios se registran  
✅ **Flexible:** Crear roles personalizados sin código  
✅ **Seguro:** Roles del sistema protegidos contra modificación  

---

## Arquitectura RBAC

### Modelos de Base de Datos

```
┌─────────────┐
│   Business  │ (Tenant)
└─────────────┘
      │
      ├─→ Role (businessId, name, isSystem)
      │     │
      │     └─→ RolePermission
      │           │
      │           └─→ Permission (global, resource:action)
      │
      └─→ User
            │
            └─→ UserRole
                  │
                  └─→ Role
```

### Flujo de Autenticación

```
1. Usuario inicia sesión
   ↓
2. Middleware authenticate carga:
   - user.roles[] (nombres de roles)
   - user.permissions[] (formato "resource:action")
   ↓
3. Middleware requirePermissions valida
   ↓
4. Endpoint ejecuta lógica de negocio
   ↓
5. AuditService registra cambios
```

### Niveles de Validación

```
Nivel 1: Autenticación
  └─ ¿Token válido?
     └─ ¿Usuario existe y está activo?

Nivel 2: Autorización
  └─ ¿Usuario tiene permiso requerido?
     └─ ¿Recurso pertenece al negocio del usuario?

Nivel 3: Auditoría
  └─ ¿Se registró el cambio?
```

---

## Componentes Implementados

### 1. Servicios

#### RoleService (`src/services/role.service.ts`)

```typescript
// Métodos disponibles:
- list(businessId, filters) → PaginatedResponse
- getById(businessId, roleId) → Role
- create(businessId, userId, data) → Role
- update(businessId, userId, roleId, data) → Role
- delete(businessId, userId, roleId) → Role
- getPermissions(businessId, roleId) → Permission[]
- updatePermissions(businessId, userId, roleId, permissionIds) → Permission[]
```

**Validaciones:**
- Nombre único por (businessId, name)
- Roles del sistema (`isSystem=true`) no editables/borrables
- No eliminar si tiene usuarios asignados
- Auditar TODAS las operaciones

#### PermissionService (`src/services/permission.service.ts`)

```typescript
// Métodos disponibles:
- list(filters) → PaginatedResponse (global, no filtrado por businessId)
- getById(permissionId) → Permission
- getByResourceAction(resource, action) → Permission
- create(userId, data) → Permission (solo superusuarios)
- updateDescription(userId, permissionId, description) → Permission
- getResources() → string[]
- getActionsByResource(resource) → string[]
- getPermissionsByRole(roleId) → Permission[]
```

**Validaciones:**
- resource + action único (global)
- No eliminar si está asignado a roles
- Auditar con businessId='system' (permisos globales)

#### UserRoleService (`src/services/user-role.service.ts`)

```typescript
// Métodos disponibles:
- getUserRoles(businessId, userId) → UserRoles
- assignRoles(businessId, userId, roleIds, requestingUserId) → UserRoles
- addRole(businessId, userId, roleId, requestingUserId) → UserRoles
- removeRole(businessId, userId, roleId, requestingUserId) → UserRoles
- getUsersByRole(businessId, roleId) → RoleUsers
```

**Validaciones:**
- Usuario existe y pertenece al negocio
- Rol existe y pertenece al negocio
- Asignación no duplicada
- Auditar cambios (antes/después)

### 2. Rutas

#### Roles (`/v1/roles`)

```
GET    /roles              - Listar roles (paginado, filtrable)
POST   /roles              - Crear rol
GET    /roles/:id          - Obtener rol con permisos
PUT    /roles/:id          - Actualizar rol
DELETE /roles/:id          - Eliminar rol
GET    /roles/:id/permissions - Obtener permisos del rol
PATCH  /roles/:id/permissions - Actualizar permisos del rol
```

**Permisos requeridos:**
- GET: `roles:read`
- POST: `roles:create`
- PUT: `roles:update`
- DELETE: `roles:delete`
- PATCH: `roles:update`

#### Permisos (`/v1/permissions`)

```
GET    /permissions                      - Listar permisos (catálogo global)
GET    /permissions/:id                  - Obtener permiso
GET    /permissions/resources            - Listar recursos disponibles
GET    /permissions/resources/:resource/actions - Listar acciones por recurso
POST   /permissions                      - Crear permiso (solo superusuarios)
PATCH  /permissions/:id                  - Actualizar descripción
```

**Permisos requeridos:**
- GET: `roles:read`
- POST/PATCH: `permissions:manage`

#### Asignación de Roles a Usuarios (`/v1/users/:userId/roles`)

```
GET    /users/:userId/roles              - Obtener roles del usuario
PATCH  /users/:userId/roles              - Asignar roles (reemplaza existentes)
POST   /users/:userId/roles              - Agregar un rol
DELETE /users/:userId/roles/:roleId      - Remover un rol
GET    /roles/:roleId/users              - Obtener usuarios con un rol
```

**Permisos requeridos:**
- GET: `users:read`
- PATCH/POST/DELETE: `users:update` O `roles:manage`

### 3. Schemas de Validación

- `roles.schemas.ts` - Validación de entrada para roles
- `permissions.schemas.ts` - Validación de entrada para permisos
- `user-roles.schemas.ts` - Validación de entrada para asignaciones

---

## Flujos Operativos

### Flujo 1: Crear un Rol Personalizado

```
1. Admin hace POST /v1/roles
   {
     "name": "Gerente de Ventas",
     "description": "Gestiona ventas y clientes",
     "permissionIds": ["sales:create", "sales:read", "customers:read", "customers:create"]
   }

2. RoleService.create():
   ✓ Valida que nombre no exista en el negocio
   ✓ Valida que permisos existan
   ✓ Crea rol con isSystem=false
   ✓ Asigna permisos
   ✓ Audita creación

3. Respuesta:
   {
     "id": "cuid123",
     "businessId": "business456",
     "name": "Gerente de Ventas",
     "description": "Gestiona ventas y clientes",
     "isSystem": false,
     "permissions": [
       { "id": "perm1", "resource": "sales", "action": "create", ... },
       ...
     ],
     "userCount": 0,
     "createdAt": "2026-02-02T..."
   }
```

### Flujo 2: Asignar Rol a Usuario

```
1. Admin hace PATCH /v1/users/user123/roles
   {
     "roleIds": ["role_owner", "role_gerente_ventas"]
   }

2. UserRoleService.assignRoles():
   ✓ Valida usuario existe y pertenece al negocio
   ✓ Valida roles existen y pertenecen al negocio
   ✓ Elimina roles existentes
   ✓ Asigna nuevos roles
   ✓ Audita cambio (antes/después)

3. Usuario debe hacer logout/login para recalcular permisos
   (O esperar a que middleware recargue en próximo request)

4. Respuesta:
   {
     "userId": "user123",
     "roles": [
       { "id": "role_owner", "name": "OWNER", "permissionCount": 50, ... },
       { "id": "role_gerente_ventas", "name": "Gerente de Ventas", "permissionCount": 4, ... }
     ]
   }
```

### Flujo 3: Actualizar Permisos de un Rol

```
1. Admin hace PATCH /v1/roles/role123/permissions
   {
     "permissionIds": ["sales:create", "sales:read", "sales:refund"]
   }

2. RoleService.updatePermissions():
   ✓ Valida rol no es del sistema
   ✓ Valida permisos existen
   ✓ Elimina permisos existentes
   ✓ Asigna nuevos permisos
   ✓ Audita cambio

3. Usuarios con este rol recibirán nuevos permisos en próximo request
   (Middleware recarga permisos en cada autenticación)

4. Respuesta:
   {
     "roleId": "role123",
     "permissions": [
       { "id": "perm1", "resource": "sales", "action": "create", ... },
       ...
     ]
   }
```

---

## Guía de Uso

### Crear Usuario Inicial para Nuevo Negocio

#### Opción 1: Usando Seed (Recomendado)

```bash
# 1. Ejecutar seed que crea:
#    - Permisos base
#    - Negocio
#    - Roles OWNER/ADMIN/CASHIER
#    - Usuario OWNER
npm run prisma:seed

# 2. Usuario inicial:
#    Email: admin@ferreteria-demo.com
#    Password: Admin123456
#    Rol: OWNER (todos los permisos)
```

#### Opción 2: Usando API

```bash
# 1. Crear usuario con rol OWNER
POST /v1/auth/register
{
  "businessId": "business123",
  "email": "admin@miferreteria.com",
  "password": "SecurePassword123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "roleIds": ["role_owner_id"]  # ID del rol OWNER del negocio
}

# 2. Login
POST /v1/auth/login
{
  "email": "admin@miferreteria.com",
  "password": "SecurePassword123"
}

# 3. Usar token para crear más usuarios/roles
```

### Crear Rol Personalizado

```bash
# 1. Obtener permisos disponibles
GET /v1/permissions
  └─ Retorna catálogo de todos los permisos

# 2. Crear rol
POST /v1/roles
{
  "name": "Vendedor",
  "description": "Puede crear y leer ventas",
  "permissionIds": [
    "sales:create",
    "sales:read",
    "products:read",
    "customers:read"
  ]
}

# 3. Asignar a usuarios
PATCH /v1/users/user123/roles
{
  "roleIds": ["role_vendedor_id"]
}
```

### Modificar Permisos de un Rol

```bash
# 1. Obtener rol actual
GET /v1/roles/role123

# 2. Actualizar permisos
PATCH /v1/roles/role123/permissions
{
  "permissionIds": [
    "sales:create",
    "sales:read",
    "sales:refund",  # Nuevo permiso
    "products:read",
    "customers:read"
  ]
}

# 3. Usuarios con este rol recibirán nuevos permisos automáticamente
```

### Remover Rol de Usuario

```bash
# 1. Obtener roles actuales
GET /v1/users/user123/roles

# 2. Remover rol específico
DELETE /v1/users/user123/roles/role123

# 3. O reemplazar todos los roles
PATCH /v1/users/user123/roles
{
  "roleIds": ["role_otro_id"]  # Solo este rol
}
```

---

## Casos de Uso

### Caso 1: Ferretería con 3 Empleados

```
Estructura:
- Dueño (OWNER) - Acceso total
- Gerente (ADMIN) - Gestión de productos, ventas, reportes
- Cajero (CASHIER) - Solo ventas y caja

Implementación:
1. Seed crea roles OWNER, ADMIN, CASHIER automáticamente
2. Crear usuario para gerente:
   POST /v1/auth/register { roleIds: ["admin_role_id"] }
3. Crear usuario para cajero:
   POST /v1/auth/register { roleIds: ["cashier_role_id"] }
```

### Caso 2: Ferretería con Departamentos

```
Estructura:
- Dueño (OWNER)
- Gerente General (ADMIN)
- Jefe Ventas (SALES_MANAGER) - Gestiona ventas y clientes
- Jefe Almacén (WAREHOUSE_MANAGER) - Gestiona inventario
- Vendedor (SELLER) - Solo ventas

Implementación:
1. Crear roles personalizados:
   POST /v1/roles { name: "Jefe Ventas", permissionIds: [...] }
   POST /v1/roles { name: "Jefe Almacén", permissionIds: [...] }
   POST /v1/roles { name: "Vendedor", permissionIds: [...] }

2. Asignar a usuarios:
   PATCH /v1/users/user1/roles { roleIds: ["jefe_ventas_id"] }
   PATCH /v1/users/user2/roles { roleIds: ["jefe_almacen_id"] }
   PATCH /v1/users/user3/roles { roleIds: ["vendedor_id"] }
```

### Caso 3: Cambio de Responsabilidades

```
Escenario: Juan era vendedor, ahora es jefe de ventas

Solución:
1. Obtener roles actuales:
   GET /v1/users/juan_id/roles

2. Reemplazar roles:
   PATCH /v1/users/juan_id/roles
   {
     "roleIds": ["jefe_ventas_id"]
   }

3. Juan recibe nuevos permisos en próximo login
```

---

## Troubleshooting

### Problema: Usuario no puede acceder a recurso

**Síntoma:** Error 403 FORBIDDEN

**Solución:**
1. Verificar que usuario tiene rol asignado:
   ```bash
   GET /v1/users/:userId/roles
   ```

2. Verificar que rol tiene permiso requerido:
   ```bash
   GET /v1/roles/:roleId/permissions
   ```

3. Si falta permiso, agregar a rol:
   ```bash
   PATCH /v1/roles/:roleId/permissions
   {
     "permissionIds": [..., "nuevo_permiso"]
   }
   ```

4. Usuario debe hacer logout/login para recalcular permisos

### Problema: No puedo eliminar un rol

**Síntoma:** Error 400 ROLE_IN_USE

**Solución:**
1. Obtener usuarios con este rol:
   ```bash
   GET /v1/roles/:roleId/users
   ```

2. Remover rol de todos los usuarios:
   ```bash
   DELETE /v1/users/:userId/roles/:roleId
   ```

3. Luego eliminar rol:
   ```bash
   DELETE /v1/roles/:roleId
   ```

### Problema: No puedo modificar rol del sistema

**Síntoma:** Error 400 SYSTEM_ROLE

**Solución:**
- Los roles del sistema (OWNER, ADMIN, CASHIER) no se pueden editar/eliminar
- Crear un rol personalizado en su lugar:
  ```bash
  POST /v1/roles
  {
    "name": "Mi Rol Personalizado",
    "permissionIds": [...]
  }
  ```

### Problema: Cambios de permisos no se reflejan inmediatamente

**Síntoma:** Usuario sigue sin acceso después de asignar permiso

**Solución:**
- El middleware carga permisos en cada request
- Usuario debe hacer logout/login para forzar recarga
- O esperar a que expire el token (15 minutos por defecto)

---

## Mejores Prácticas

### ✅ HACER

- ✅ Crear roles por función/departamento
- ✅ Usar nombres descriptivos para roles
- ✅ Auditar cambios de roles regularmente
- ✅ Documentar qué permisos tiene cada rol
- ✅ Revisar permisos de usuarios periódicamente
- ✅ Usar roles del sistema como base (no modificar)

### ❌ NO HACER

- ❌ Crear un rol por usuario (usar roles reutilizables)
- ❌ Modificar roles del sistema (crear personalizados)
- ❌ Asignar permisos directamente a usuarios (usar roles)
- ❌ Eliminar permisos de roles sin revisar usuarios afectados
- ❌ Confiar solo en permisos (validar también en servicios)

---

## Referencia Rápida de Permisos

```
Productos:
  - products:create   - Crear productos
  - products:read     - Ver productos
  - products:update   - Editar productos
  - products:delete   - Eliminar productos
  - products:manage   - Gestión completa

Ventas:
  - sales:create      - Crear ventas
  - sales:read        - Ver ventas
  - sales:refund      - Reembolsar ventas
  - sales:manage      - Gestión completa

Inventario:
  - inventory:read    - Ver inventario
  - inventory:adjust  - Ajustar inventario
  - inventory:manage  - Gestión completa

Caja:
  - cash_register:open    - Abrir caja
  - cash_register:close   - Cerrar caja
  - cash_register:read    - Ver estado caja
  - cash_register:manage  - Gestión completa

Clientes:
  - customers:create  - Crear clientes
  - customers:read    - Ver clientes
  - customers:update  - Editar clientes
  - customers:delete  - Eliminar clientes
  - customers:manage  - Gestión completa

Usuarios:
  - users:create      - Crear usuarios
  - users:read        - Ver usuarios
  - users:update      - Editar usuarios
  - users:delete      - Eliminar usuarios
  - users:manage      - Gestión completa

Roles:
  - roles:create      - Crear roles
  - roles:read        - Ver roles
  - roles:update      - Editar roles
  - roles:delete      - Eliminar roles
  - roles:manage      - Gestión completa

Auditoría:
  - audit:read        - Ver logs de auditoría
```

---

## Conclusión

El sistema RBAC está completamente implementado y listo para usar. Los administradores pueden:

1. ✅ Crear roles personalizados
2. ✅ Asignar permisos granulares
3. ✅ Gestionar usuarios
4. ✅ Auditar cambios
5. ✅ Mantener aislamiento multi-tenant

Para más información, consulta:
- `RBAC_API_REFERENCE.md` - Referencia detallada de endpoints
- `RBAC_IMPLEMENTATION_ANALYSIS.md` - Análisis técnico
- Código fuente en `src/services/` y `src/routes/`

---

**Versión:** 1.0  
**Última actualización:** 2 de Febrero, 2026
