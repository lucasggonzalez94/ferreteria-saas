# Referencia de API RBAC

**Fecha:** 2 de Febrero, 2026  
**Versión:** 1.0

---

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Roles](#roles)
3. [Permisos](#permisos)
4. [Asignación de Roles a Usuarios](#asignación-de-roles-a-usuarios)
5. [Códigos de Error](#códigos-de-error)
6. [Ejemplos cURL](#ejemplos-curl)

---

## Autenticación

Todos los endpoints requieren un token JWT en el header `Authorization`.

```bash
Authorization: Bearer <access_token>
```

### Obtener Token

```bash
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Respuesta
{
  "success": true,
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "businessId": "business456",
      "roles": ["OWNER"],
      "permissions": ["products:create", "products:read", ...]
    },
    "accessToken": "eyJhbGc...",
    "csrfToken": "csrf123"
  }
}
```

---

## Roles

### Listar Roles

```bash
GET /v1/roles?q=<search>&page=<page>&limit=<limit>

Headers:
  Authorization: Bearer <token>

Query Parameters:
  q (string, optional) - Búsqueda por nombre o descripción
  page (number, optional) - Número de página (default: 1)
  limit (number, optional) - Resultados por página (default: 10, max: 100)

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": [
    {
      "id": "role123",
      "businessId": "business456",
      "name": "OWNER",
      "description": "Dueño del negocio - acceso total",
      "isSystem": true,
      "permissionCount": 50,
      "userCount": 1,
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-01T10:00:00Z"
    },
    ...
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1,
    "hasMore": false
  }
}
```

### Obtener Rol

```bash
GET /v1/roles/:id

Headers:
  Authorization: Bearer <token>

Path Parameters:
  id (string, required) - ID del rol

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": {
    "id": "role123",
    "businessId": "business456",
    "name": "OWNER",
    "description": "Dueño del negocio - acceso total",
    "isSystem": true,
    "permissions": [
      {
        "id": "perm1",
        "resource": "products",
        "action": "create",
        "description": "Crear productos"
      },
      ...
    ],
    "userCount": 1,
    "createdAt": "2026-02-01T10:00:00Z",
    "updatedAt": "2026-02-01T10:00:00Z"
  }
}
```

### Crear Rol

```bash
POST /v1/roles

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "name": "Gerente de Ventas",
  "description": "Gestiona ventas y clientes",
  "permissionIds": [
    "sales:create",
    "sales:read",
    "customers:create",
    "customers:read"
  ]
}

Permisos requeridos:
  - roles:create

# Respuesta (201 Created)
{
  "success": true,
  "data": {
    "id": "role_new",
    "businessId": "business456",
    "name": "Gerente de Ventas",
    "description": "Gestiona ventas y clientes",
    "isSystem": false,
    "permissions": [
      {
        "id": "perm1",
        "resource": "sales",
        "action": "create",
        "description": "Crear ventas"
      },
      ...
    ],
    "userCount": 0,
    "createdAt": "2026-02-02T15:30:00Z",
    "updatedAt": "2026-02-02T15:30:00Z"
  }
}
```

### Actualizar Rol

```bash
PUT /v1/roles/:id

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Path Parameters:
  id (string, required) - ID del rol

Body:
{
  "name": "Gerente de Ventas",
  "description": "Gestiona ventas, clientes e inventario",
  "permissionIds": [
    "sales:create",
    "sales:read",
    "customers:create",
    "customers:read",
    "inventory:read"
  ]
}

Permisos requeridos:
  - roles:update

Validaciones:
  - Rol no puede ser del sistema (isSystem=true)
  - Nombre debe ser único por negocio
  - Permisos deben existir

# Respuesta
{
  "success": true,
  "data": {
    "id": "role_new",
    "businessId": "business456",
    "name": "Gerente de Ventas",
    "description": "Gestiona ventas, clientes e inventario",
    "isSystem": false,
    "permissions": [...],
    "userCount": 2,
    "createdAt": "2026-02-02T15:30:00Z",
    "updatedAt": "2026-02-02T16:00:00Z"
  }
}
```

### Eliminar Rol

```bash
DELETE /v1/roles/:id

Headers:
  Authorization: Bearer <token>

Path Parameters:
  id (string, required) - ID del rol

Permisos requeridos:
  - roles:delete

Validaciones:
  - Rol no puede ser del sistema (isSystem=true)
  - Rol no puede tener usuarios asignados

# Respuesta
{
  "success": true,
  "data": {
    "id": "role_new",
    "businessId": "business456",
    "name": "Gerente de Ventas",
    "description": "Gestiona ventas, clientes e inventario",
    "isSystem": false,
    "permissions": [...],
    "userCount": 0,
    "createdAt": "2026-02-02T15:30:00Z",
    "updatedAt": "2026-02-02T16:00:00Z"
  }
}
```

### Obtener Permisos de Rol

```bash
GET /v1/roles/:id/permissions

Headers:
  Authorization: Bearer <token>

Path Parameters:
  id (string, required) - ID del rol

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": {
    "roleId": "role123",
    "permissions": [
      {
        "id": "perm1",
        "resource": "products",
        "action": "create",
        "description": "Crear productos"
      },
      ...
    ]
  }
}
```

### Actualizar Permisos de Rol

```bash
PATCH /v1/roles/:id/permissions

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Path Parameters:
  id (string, required) - ID del rol

Body:
{
  "permissionIds": [
    "sales:create",
    "sales:read",
    "sales:refund",
    "customers:create",
    "customers:read"
  ]
}

Permisos requeridos:
  - roles:update

Validaciones:
  - Rol no puede ser del sistema (isSystem=true)
  - Permisos deben existir

# Respuesta
{
  "success": true,
  "data": {
    "roleId": "role123",
    "permissions": [
      {
        "id": "perm1",
        "resource": "sales",
        "action": "create",
        "description": "Crear ventas"
      },
      ...
    ]
  }
}
```

---

## Permisos

### Listar Permisos

```bash
GET /v1/permissions?q=<search>&resource=<resource>&page=<page>&limit=<limit>

Headers:
  Authorization: Bearer <token>

Query Parameters:
  q (string, optional) - Búsqueda por nombre o descripción
  resource (string, optional) - Filtrar por recurso (products, sales, etc.)
  page (number, optional) - Número de página (default: 1)
  limit (number, optional) - Resultados por página (default: 20, max: 100)

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": [
    {
      "id": "perm1",
      "resource": "products",
      "action": "create",
      "description": "Crear productos",
      "fullName": "products:create",
      "createdAt": "2026-02-01T10:00:00Z"
    },
    ...
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Obtener Recursos Disponibles

```bash
GET /v1/permissions/resources

Headers:
  Authorization: Bearer <token>

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": {
    "resources": [
      "products",
      "sales",
      "inventory",
      "customers",
      "cash_register",
      "users",
      "roles",
      "audit"
    ]
  }
}
```

### Obtener Acciones por Recurso

```bash
GET /v1/permissions/resources/:resource/actions

Headers:
  Authorization: Bearer <token>

Path Parameters:
  resource (string, required) - Nombre del recurso (products, sales, etc.)

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": {
    "resource": "products",
    "actions": [
      "create",
      "read",
      "update",
      "delete",
      "manage"
    ]
  }
}
```

### Obtener Permiso

```bash
GET /v1/permissions/:id

Headers:
  Authorization: Bearer <token>

Path Parameters:
  id (string, required) - ID del permiso

Permisos requeridos:
  - roles:read

# Respuesta
{
  "success": true,
  "data": {
    "id": "perm1",
    "resource": "products",
    "action": "create",
    "description": "Crear productos",
    "fullName": "products:create",
    "roleCount": 3,
    "createdAt": "2026-02-01T10:00:00Z"
  }
}
```

### Crear Permiso (Superusuarios)

```bash
POST /v1/permissions

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "resource": "reports",
  "action": "export",
  "description": "Exportar reportes"
}

Permisos requeridos:
  - permissions:manage

Validaciones:
  - resource + action debe ser único
  - resource y action son obligatorios

# Respuesta (201 Created)
{
  "success": true,
  "data": {
    "id": "perm_new",
    "resource": "reports",
    "action": "export",
    "description": "Exportar reportes",
    "fullName": "reports:export",
    "roleCount": 0,
    "createdAt": "2026-02-02T16:00:00Z"
  }
}
```

---

## Asignación de Roles a Usuarios

### Obtener Roles de Usuario

```bash
GET /v1/users/:userId/roles

Headers:
  Authorization: Bearer <token>

Path Parameters:
  userId (string, required) - ID del usuario

Permisos requeridos:
  - users:read

# Respuesta
{
  "success": true,
  "data": {
    "userId": "user123",
    "roles": [
      {
        "id": "role123",
        "name": "OWNER",
        "description": "Dueño del negocio - acceso total",
        "isSystem": true,
        "permissionCount": 50,
        "assignedAt": "2026-02-01T10:00:00Z"
      },
      ...
    ]
  }
}
```

### Asignar Roles a Usuario

```bash
PATCH /v1/users/:userId/roles

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Path Parameters:
  userId (string, required) - ID del usuario

Body:
{
  "roleIds": [
    "role_gerente_ventas",
    "role_gerente_almacen"
  ]
}

Permisos requeridos:
  - users:update O roles:manage

Validaciones:
  - Usuario debe existir y pertenecer al mismo negocio
  - Roles deben existir y pertenecer al mismo negocio

# Respuesta
{
  "success": true,
  "data": {
    "userId": "user123",
    "roles": [
      {
        "id": "role_gerente_ventas",
        "name": "Gerente de Ventas",
        "description": "Gestiona ventas y clientes",
        "isSystem": false,
        "permissionCount": 4,
        "assignedAt": "2026-02-02T16:00:00Z"
      },
      {
        "id": "role_gerente_almacen",
        "name": "Gerente de Almacén",
        "description": "Gestiona inventario",
        "isSystem": false,
        "permissionCount": 3,
        "assignedAt": "2026-02-02T16:00:00Z"
      }
    ]
  }
}
```

### Agregar Rol a Usuario

```bash
POST /v1/users/:userId/roles

Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Path Parameters:
  userId (string, required) - ID del usuario

Body:
{
  "roleId": "role_nuevo"
}

Permisos requeridos:
  - users:update O roles:manage

Validaciones:
  - Usuario debe existir y pertenecer al mismo negocio
  - Rol debe existir y pertenecer al mismo negocio
  - Usuario no debe tener ya este rol

# Respuesta (201 Created)
{
  "success": true,
  "data": {
    "userId": "user123",
    "roles": [
      {
        "id": "role123",
        "name": "OWNER",
        "description": "Dueño del negocio - acceso total",
        "isSystem": true,
        "permissionCount": 50,
        "assignedAt": "2026-02-01T10:00:00Z"
      },
      {
        "id": "role_nuevo",
        "name": "Nuevo Rol",
        "description": "Descripción",
        "isSystem": false,
        "permissionCount": 5,
        "assignedAt": "2026-02-02T16:05:00Z"
      }
    ]
  }
}
```

### Remover Rol de Usuario

```bash
DELETE /v1/users/:userId/roles/:roleId

Headers:
  Authorization: Bearer <token>

Path Parameters:
  userId (string, required) - ID del usuario
  roleId (string, required) - ID del rol

Permisos requeridos:
  - users:update O roles:manage

Validaciones:
  - Usuario debe existir y pertenecer al mismo negocio
  - Usuario debe tener el rol asignado

# Respuesta
{
  "success": true,
  "data": {
    "userId": "user123",
    "roles": [
      {
        "id": "role123",
        "name": "OWNER",
        "description": "Dueño del negocio - acceso total",
        "isSystem": true,
        "permissionCount": 50,
        "assignedAt": "2026-02-01T10:00:00Z"
      }
    ]
  }
}
```

### Obtener Usuarios con Rol

```bash
GET /v1/roles/:roleId/users

Headers:
  Authorization: Bearer <token>

Path Parameters:
  roleId (string, required) - ID del rol

Permisos requeridos:
  - roles:read O users:read

# Respuesta
{
  "success": true,
  "data": {
    "roleId": "role123",
    "roleName": "OWNER",
    "userCount": 2,
    "users": [
      {
        "id": "user1",
        "email": "admin@example.com",
        "firstName": "Juan",
        "lastName": "Pérez",
        "isActive": true,
        "assignedAt": "2026-02-01T10:00:00Z"
      },
      ...
    ]
  }
}
```

---

## Códigos de Error

### Errores de Validación (400)

```json
{
  "success": false,
  "error": {
    "code": "ROLE_EXISTS",
    "message": "Role \"Gerente\" already exists in this business"
  }
}
```

**Códigos comunes:**
- `ROLE_EXISTS` - Nombre de rol ya existe en el negocio
- `INVALID_PERMISSIONS` - Uno o más permisos no existen
- `INVALID_ROLES` - Uno o más roles no existen
- `SYSTEM_ROLE` - No se puede modificar/eliminar rol del sistema
- `ROLE_IN_USE` - No se puede eliminar rol con usuarios asignados
- `ROLE_ALREADY_ASSIGNED` - Usuario ya tiene este rol

### Errores de Autorización (403)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this resource"
  }
}
```

### Errores de No Encontrado (404)

```json
{
  "success": false,
  "error": {
    "code": "ROLE_NOT_FOUND",
    "message": "Role not found"
  }
}
```

### Errores de Conflicto (409)

```json
{
  "success": false,
  "error": {
    "code": "ROLE_EXISTS",
    "message": "Role \"Gerente\" already exists in this business"
  }
}
```

---

## Ejemplos cURL

### Listar Roles

```bash
curl -X GET "http://localhost:3001/v1/roles?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

### Crear Rol

```bash
curl -X POST "http://localhost:3001/v1/roles" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gerente de Ventas",
    "description": "Gestiona ventas y clientes",
    "permissionIds": ["sales:create", "sales:read", "customers:read"]
  }'
```

### Asignar Roles a Usuario

```bash
curl -X PATCH "http://localhost:3001/v1/users/user123/roles" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["role_gerente_ventas"]
  }'
```

### Obtener Permisos Disponibles

```bash
curl -X GET "http://localhost:3001/v1/permissions?resource=sales" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

---

**Versión:** 1.0  
**Última actualización:** 2 de Febrero, 2026
