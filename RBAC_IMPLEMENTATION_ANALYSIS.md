# Análisis Detallado para Implementación de RBAC CRUD

**Fecha:** 2 de Febrero, 2026  
**Objetivo:** Implementar CRUD de Roles, Permisos y Asignación de Usuarios sin romper funcionalidad existente

---

## 1. Estado Actual del Sistema RBAC

### 1.1 Modelos Prisma (VERIFICADO ✅)

```prisma
// Role - Líneas 103-121
- id: String (PK)
- businessId: String (FK) - Multi-tenant
- name: String - Único por (businessId, name)
- description: String?
- isSystem: Boolean - Protege roles del sistema
- createdAt, updatedAt

// Permission - Líneas 123-136
- id: String (PK)
- resource: String - Único por (resource, action)
- action: String
- description: String?
- createdAt

// UserRole - Líneas 138-153
- id, userId (FK), roleId (FK)
- assignedAt
- Único por (userId, roleId)

// RolePermission - Líneas 155-169
- id, roleId (FK), permissionId (FK)
- grantedAt
- Único por (roleId, permissionId)
```

**Conclusión:** Modelos bien diseñados, soportan multi-tenant, integridad referencial garantizada.

### 1.2 Autenticación (VERIFICADO ✅)

**Archivo:** `src/middleware/auth.ts` (líneas 36-78)

```typescript
// Carga relaciones completas:
user.roles[] -> role.permissions[] -> permission

// Extrae:
- roles: string[] (nombres de roles)
- permissions: string[] (formato "resource:action")

// Inyecta en AuthRequest:
- user.roles
- user.permissions
```

**Conclusión:** Middleware carga correctamente roles/permisos. Los servicios CRUD deben mantener esta estructura.

### 1.3 Middleware RBAC (VERIFICADO ✅)

**Archivo:** `src/middleware/rbac.ts` (líneas 5-58)

```typescript
export const requirePermissions = (...requiredPermissions: string[]) => {
  // Valida que usuario tenga AL MENOS UNO de los permisos
  // Formato: "resource:action"
}

export const requireRoles = (...requiredRoles: string[]) => {
  // Valida que usuario tenga AL MENOS UNO de los roles
}
```

**Conclusión:** Middleware funciona correctamente. Nuevas rutas deben usar `requirePermissions('roles:manage')` o similar.

### 1.4 Auditoría (VERIFICADO ✅)

**Archivo:** `src/services/audit.service.ts` (líneas 4-122)

```typescript
// Métodos disponibles:
- log() - Genérico
- logCreate()
- logUpdate()
- logDelete()

// Parámetros:
- businessId (CRÍTICO para multi-tenant)
- userId
- action (CREATE, UPDATE, DELETE, etc.)
- entity (roles, permissions, user_roles)
- entityId
- before/after (para cambios)
```

**Conclusión:** Servicio de auditoría listo. Debe usarse en todas las operaciones RBAC.

### 1.5 Tipos (VERIFICADO ✅)

**Archivo:** `src/types/index.ts` (líneas 4-16)

```typescript
export interface AuthRequest extends Request {
  user?: {
    id: string;
    businessId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];           // ✅ YA EXISTE
    permissions: string[];     // ✅ YA EXISTE
  };
  businessId?: string;
}
```

**Conclusión:** Tipos ya soportan roles/permisos. No necesita cambios.

### 1.6 Constantes de Permisos (VERIFICADO ✅)

**Archivo:** `src/config/constants.ts` (líneas 11-71)

```typescript
export const PERMISSIONS = {
  // Productos
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_READ: 'products:read',
  // ... más permisos
  
  // Roles
  ROLES_CREATE: 'roles:create',
  ROLES_READ: 'roles:read',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_MANAGE: 'roles:manage',
  
  // Auditoría
  AUDIT_READ: 'audit:read',
}
```

**Conclusión:** Permisos para RBAC ya definidos. Usar `PERMISSIONS.ROLES_MANAGE` en nuevas rutas.

### 1.7 Seed Inicial (VERIFICADO ✅)

**Archivo:** `prisma/seeds/basic.seed.ts` (líneas 9-247)

```typescript
// Crea:
1. Permisos base (18 permisos)
2. Negocio de ejemplo
3. Roles: OWNER (todos permisos), ADMIN (14 permisos), CASHIER (8 permisos)
4. Usuario OWNER (admin@ferreteria-demo.com / Admin123456)
5. Asignaciones user_roles
```

**Conclusión:** Seed funciona. Nuevas operaciones deben mantener compatibilidad.

---

## 2. Estructura de Rutas Existentes (ANÁLISIS COMPARATIVO)

### Patrón Estándar Observado

**Ejemplo:** `src/routes/products.routes.ts`

```typescript
// 1. Imports
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';

// 2. Router setup
const router = Router();
const productService = new ProductService();

// 3. Middlewares globales
router.use(authenticate, multiTenant);

// 4. Endpoints
router.get(
  '/',
  requirePermissions('products:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const result = await productService.list(authReq.businessId!, filters);
    sendPaginated(res, result.items, result.meta);
  }
);

router.post(
  '/',
  requirePermissions('products:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const item = await productService.create(authReq.businessId!, authReq.user!.id, data);
    sendSuccess(res, item, 201);
  }
);
```

**Patrón a Seguir:**
1. Aplicar `authenticate` + `multiTenant` globalmente
2. Usar `requirePermissions()` por endpoint
3. Pasar `authReq.businessId!` y `authReq.user!.id` a servicios
4. Usar `sendSuccess()` / `sendPaginated()` para respuestas
5. Auditar cambios en servicios

---

## 3. Servicios Existentes (ANÁLISIS COMPARATIVO)

### Patrón Estándar Observado

**Ejemplo:** `src/services/product.service.ts`

```typescript
export class ProductService {
  // 1. List - Filtra por businessId
  async list(businessId: string, filters: any) {
    return prisma.product.findMany({
      where: { businessId, ...filters },
    });
  }

  // 2. GetById - Valida propiedad
  async getById(businessId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError(404, 'NOT_FOUND', '...');
    if (product.businessId !== businessId) throw new AppError(403, 'FORBIDDEN', '...');
    return product;
  }

  // 3. Create - Asigna businessId, audita
  async create(businessId: string, userId: string, data: any) {
    const item = await prisma.product.create({
      data: { businessId, ...data },
    });
    await AuditService.logCreate(businessId, userId, 'products', item.id, data);
    return item;
  }

  // 4. Update - Valida, audita before/after
  async update(businessId: string, userId: string, id: string, data: any) {
    const current = await this.getById(businessId, id);
    const updated = await prisma.product.update({
      where: { id },
      data,
    });
    await AuditService.logUpdate(businessId, userId, 'products', id, current, updated);
    return updated;
  }

  // 5. Delete - Valida, audita
  async delete(businessId: string, userId: string, id: string) {
    const current = await this.getById(businessId, id);
    await prisma.product.delete({ where: { id } });
    await AuditService.logDelete(businessId, userId, 'products', id, current);
    return current;
  }
}
```

**Patrón a Seguir:**
1. Todos los métodos reciben `businessId` como primer parámetro
2. Validar propiedad con `getById()` antes de modificar
3. Auditar TODAS las operaciones (create, update, delete)
4. Usar `AppError` para errores estándar
5. No auditar operaciones de lectura (list, getById)

---

## 4. Validaciones Críticas para RBAC

### 4.1 Validaciones de Roles

```typescript
// ✅ DEBE VALIDAR:
1. businessId coincide con usuario autenticado
2. Nombre único por (businessId, name)
3. isSystem = true → no editable/borrable
4. No eliminar si tiene usuarios asignados (soft delete recomendado)
5. Cambios en permisos → auditar antes/después
```

### 4.2 Validaciones de Permisos

```typescript
// ✅ DEBE VALIDAR:
1. resource + action único (global, no por businessId)
2. No eliminar si está asignado a roles
3. Descripción opcional pero recomendada
4. Formato "resource:action" consistente
```

### 4.3 Validaciones de Asignación a Usuarios

```typescript
// ✅ DEBE VALIDAR:
1. Usuario existe y pertenece al mismo businessId
2. Rol existe y pertenece al mismo businessId
3. Asignación no duplicada (unique constraint)
4. Auditar cambios (qué roles se agregaron/quitaron)
5. Recalcular permisos efectivos (o confiar en middleware)
```

---

## 5. Plan de Implementación (SIN ROMPER LO EXISTENTE)

### Fase 1: Crear Servicios

**Archivos a crear:**
- `src/services/role.service.ts` - CRUD de roles
- `src/services/permission.service.ts` - CRUD de permisos
- `src/services/user-role.service.ts` - Asignación a usuarios

**Validaciones:**
- Seguir patrón de `ProductService`
- Usar `AuditService` en todas las operaciones
- Validar `businessId` en cada operación
- Proteger roles `isSystem`

### Fase 2: Crear Schemas Zod

**Archivos a crear:**
- `src/routes/roles.schemas.ts`
- `src/routes/permissions.schemas.ts`
- `src/routes/user-roles.schemas.ts`

**Validaciones:**
- Nombre: string, min 1, max 100
- Descripción: string?, max 500
- Permisos: array de IDs válidos
- Usuarios: array de IDs válidos

### Fase 3: Crear Rutas

**Archivos a crear:**
- `src/routes/roles.routes.ts`
- `src/routes/permissions.routes.ts`
- `src/routes/user-roles.routes.ts`

**Endpoints:**
```
GET    /roles              - Listar roles del negocio
POST   /roles              - Crear rol
GET    /roles/:id          - Obtener rol
PUT    /roles/:id          - Actualizar rol
DELETE /roles/:id          - Eliminar rol (soft delete)
PATCH  /roles/:id/permissions - Actualizar permisos del rol

GET    /permissions        - Listar permisos (catálogo global)
POST   /permissions        - Crear permiso (solo superusuarios)

PATCH  /users/:id/roles    - Asignar/quitar roles a usuario
```

### Fase 4: Registrar Rutas en app.ts

```typescript
import rolesRoutes from './routes/roles.routes';
import permissionsRoutes from './routes/permissions.routes';

app.use('/v1/roles', rolesRoutes);
app.use('/v1/permissions', permissionsRoutes);
app.use('/v1/users', userRolesRoutes); // Para PATCH /users/:id/roles
```

### Fase 5: Documentación

**Archivos a crear:**
- `RBAC_IMPLEMENTATION_GUIDE.md` - Guía operativa
- `RBAC_API_REFERENCE.md` - Referencia de endpoints
- `RBAC_SEED_GUIDE.md` - Cómo crear usuario inicial para negocio nuevo

---

## 6. Checklist de Compatibilidad

- [ ] No modificar `AuthRequest` (ya tiene roles/permissions)
- [ ] No modificar middleware `authenticate` (ya carga roles/permisos)
- [ ] No modificar middleware `requirePermissions/requireRoles`
- [ ] No modificar `AuditService` (ya funciona)
- [ ] No modificar modelos Prisma (ya están bien)
- [ ] Usar permisos existentes en `PERMISSIONS` constant
- [ ] Seguir patrón de servicios existentes
- [ ] Seguir patrón de rutas existentes
- [ ] Auditar TODAS las operaciones RBAC
- [ ] Validar `businessId` en cada operación
- [ ] Usar `sendSuccess()` / `sendPaginated()` para respuestas
- [ ] Usar `AppError` para errores

---

## 7. Riesgos Identificados y Mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|-----------|
| Romper autenticación existente | Baja | No modificar middleware auth.ts |
| Permisos no se cargan correctamente | Baja | Seguir patrón de ProductService |
| Auditoría incompleta | Media | Auditar ANTES/DESPUÉS en updates |
| Falta validación de businessId | Alta | Validar en CADA operación de servicio |
| Roles del sistema se editan | Media | Validar `isSystem` antes de update/delete |
| Duplicados en asignaciones | Baja | Confiar en unique constraint de BD |

---

## 8. Conclusión

**Estado:** ✅ Sistema RBAC base está bien diseñado y funcional

**Cambios requeridos:** Exponer CRUD mediante servicios, schemas y rutas

**Compatibilidad:** 100% compatible si se sigue el patrón existente

**Riesgo de ruptura:** BAJO si se respetan las validaciones y patrones

---

**Próximo paso:** Implementar servicios siguiendo este análisis
