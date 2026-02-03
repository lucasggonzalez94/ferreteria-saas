# Patrones Multi-Tenant - Guía para Desarrolladores

## Introducción

Este documento describe los patrones y mejores prácticas para trabajar con el modelo multi-tenant en el sistema de gestión de ferretería.

---

## 1. Principios Fundamentales

### 1.1 Aislamiento de Datos
- **Cada negocio es un tenant independiente**
- Los datos de un negocio NUNCA deben ser accesibles por otro negocio
- El `businessId` es el identificador del tenant

### 1.2 Validación en Múltiples Niveles
```
Autenticación (JWT) → Middleware Multi-Tenant → Servicios → Base de Datos
```

### 1.3 Responsabilidades
- **Autenticación:** Extraer `businessId` del token JWT
- **Middleware:** Validar que existe contexto de negocio
- **Servicios:** Validar propiedad de entidades
- **Base de Datos:** Filtrar por `businessId` en todas las queries

---

## 2. Crear una Nueva Entidad Multi-Tenant

### Checklist

- [ ] Agregar `businessId` al modelo Prisma
- [ ] Agregar relación inversa en modelo `Business`
- [ ] Agregar índice en `businessId`
- [ ] Crear migración de Prisma
- [ ] Ejecutar `prisma generate` para regenerar tipos
- [ ] Implementar validación en servicios
- [ ] Implementar validación en rutas
- [ ] Agregar auditoría

### Ejemplo: Crear Entidad "Warehouse"

#### 2.1 Actualizar Schema Prisma

```prisma
model Warehouse {
  id          String  @id @default(cuid())
  businessId  String
  name        String
  address     String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relaciones
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  @@index([businessId])
  @@map("warehouses")
}
```

#### 2.2 Agregar Relación Inversa en Business

```prisma
model Business {
  // ... campos existentes ...
  
  // Relaciones
  warehouses Warehouse[]  // AGREGAR ESTA LÍNEA
  
  // ... otras relaciones ...
}
```

#### 2.3 Crear Migración

```bash
npx prisma migrate dev --name add_warehouses
```

#### 2.4 Crear Servicio

```typescript
// src/services/warehouse.service.ts
import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { AuditService } from './audit.service';

export class WarehouseService {
  /**
   * Crear warehouse
   */
  async create(
    businessId: string,
    userId: string,
    data: { name: string; address?: string }
  ) {
    const warehouse = await prisma.warehouse.create({
      data: {
        businessId,
        name: data.name,
        address: data.address,
      },
    });

    // Auditoría
    await AuditService.logCreate(businessId, userId, 'warehouses', warehouse.id, {
      name: warehouse.name,
    });

    return warehouse;
  }

  /**
   * Obtener warehouse por ID
   */
  async getById(businessId: string, warehouseId: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Warehouse not found');
    }

    // VALIDACIÓN CRÍTICA: Verificar que pertenece al negocio
    if (warehouse.businessId !== businessId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    return warehouse;
  }

  /**
   * Listar warehouses
   */
  async list(businessId: string) {
    return prisma.warehouse.findMany({
      where: { businessId },  // FILTRO CRÍTICO
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Actualizar warehouse
   */
  async update(
    businessId: string,
    userId: string,
    warehouseId: string,
    data: Partial<{ name: string; address?: string }>
  ) {
    const current = await this.getById(businessId, warehouseId);

    const updated = await prisma.warehouse.update({
      where: { id: warehouseId },
      data,
    });

    // Auditoría
    await AuditService.logUpdate(businessId, userId, 'warehouses', warehouseId, current, updated);

    return updated;
  }

  /**
   * Eliminar warehouse
   */
  async delete(businessId: string, userId: string, warehouseId: string) {
    const warehouse = await this.getById(businessId, warehouseId);

    await prisma.warehouse.delete({
      where: { id: warehouseId },
    });

    // Auditoría
    await AuditService.logDelete(businessId, userId, 'warehouses', warehouseId, warehouse);

    return warehouse;
  }
}
```

#### 2.5 Crear Rutas

```typescript
// src/routes/warehouses.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { WarehouseService } from '../services/warehouse.service';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { multiTenant } from '../middleware/multi-tenant';
import { requirePermissions } from '../middleware/rbac';
import { AuthRequest } from '../types';

const router = Router();
const warehouseService = new WarehouseService();

// CRÍTICO: Aplicar middleware de autenticación y multi-tenant
router.use(authenticate, multiTenant);

/**
 * GET /warehouses
 * Listar warehouses
 */
router.get(
  '/',
  requirePermissions('warehouses:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;

      const warehouses = await warehouseService.list(authReq.businessId!);

      sendSuccess(res, warehouses);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /warehouses
 * Crear warehouse
 */
router.post(
  '/',
  requirePermissions('warehouses:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { name, address } = req.body;

      const warehouse = await warehouseService.create(authReq.businessId!, authReq.user!.id, {
        name,
        address,
      });

      sendSuccess(res, warehouse, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /warehouses/:id
 * Obtener warehouse por ID
 */
router.get(
  '/:id',
  requirePermissions('warehouses:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const warehouse = await warehouseService.getById(authReq.businessId!, id);

      sendSuccess(res, warehouse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /warehouses/:id
 * Actualizar warehouse
 */
router.put(
  '/:id',
  requirePermissions('warehouses:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { name, address } = req.body;

      const warehouse = await warehouseService.update(authReq.businessId!, authReq.user!.id, id, {
        name,
        address,
      });

      sendSuccess(res, warehouse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /warehouses/:id
 * Eliminar warehouse
 */
router.delete(
  '/:id',
  requirePermissions('warehouses:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      const warehouse = await warehouseService.delete(authReq.businessId!, authReq.user!.id, id);

      sendSuccess(res, warehouse);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

#### 2.6 Registrar Rutas en app.ts

```typescript
// src/app.ts
import warehousesRoutes from './routes/warehouses.routes';

// ... otros imports ...

// API Routes
app.use('/v1/warehouses', warehousesRoutes);
```

---

## 3. Patrones Comunes

### 3.1 Validar Propiedad de Entidad

```typescript
// ✅ CORRECTO
async getById(businessId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  // VALIDACIÓN CRÍTICA
  if (product.businessId !== businessId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  return product;
}
```

### 3.2 Filtrar por BusinessId

```typescript
// ✅ CORRECTO
async list(businessId: string) {
  return prisma.product.findMany({
    where: { businessId },  // FILTRO CRÍTICO
    orderBy: { createdAt: 'desc' },
  });
}

// ❌ INCORRECTO
async list(businessId: string) {
  return prisma.product.findMany({
    // FALTA: where: { businessId }
    orderBy: { createdAt: 'desc' },
  });
}
```

### 3.3 Crear con BusinessId

```typescript
// ✅ CORRECTO
async create(businessId: string, data: CreateProductInput) {
  const product = await prisma.product.create({
    data: {
      businessId,  // CRÍTICO: Asignar businessId
      name: data.name,
      price: data.price,
      // ...
    },
  });

  return product;
}

// ❌ INCORRECTO
async create(businessId: string, data: CreateProductInput) {
  const product = await prisma.product.create({
    data: {
      // FALTA: businessId
      name: data.name,
      price: data.price,
      // ...
    },
  });

  return product;
}
```

### 3.4 Validar Relaciones

```typescript
// ✅ CORRECTO - Validar que cliente pertenece al negocio
async createSale(businessId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  // VALIDACIÓN CRÍTICA
  if (customer.businessId !== businessId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  // Proceder con la venta
  const sale = await prisma.sale.create({
    data: {
      businessId,
      customerId,
      // ...
    },
  });

  return sale;
}
```

### 3.5 Transacciones Multi-Tenant

```typescript
// ✅ CORRECTO - Mantener consistencia de businessId
async confirmSale(businessId: string, saleId: string) {
  const sale = await this.getById(businessId, saleId);

  return prisma.$transaction(async (tx) => {
    // 1. Actualizar venta
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'CONFIRMED' },
    });

    // 2. Crear movimientos de inventario (CRÍTICO: pasar businessId)
    for (const item of sale.items) {
      await tx.inventoryMovement.create({
        data: {
          businessId,  // CRÍTICO
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
        },
      });
    }

    return updated;
  });
}
```

---

## 4. Auditoría

### 4.1 Registrar Cambios

```typescript
// ✅ CORRECTO - Siempre registrar con businessId
await AuditService.logCreate(
  businessId,  // CRÍTICO
  userId,
  'products',
  product.id,
  { name: product.name, price: product.price }
);

await AuditService.logUpdate(
  businessId,  // CRÍTICO
  userId,
  'products',
  product.id,
  oldProduct,
  newProduct
);

await AuditService.logDelete(
  businessId,  // CRÍTICO
  userId,
  'products',
  product.id,
  product
);
```

---

## 5. Middleware de Autenticación

### 5.1 Flujo de Autenticación

```
1. Cliente envía token JWT en header Authorization
2. Middleware authenticate valida el token
3. Extrae userId y businessId del token
4. Inyecta en req.user y req.businessId
5. Middleware multiTenant verifica que businessId existe
6. Middleware requirePermissions valida permisos
7. Handler recibe authReq.businessId! garantizado
```

### 5.2 Usar BusinessId en Handlers

```typescript
router.get('/:id', requirePermissions('products:read'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    
    // authReq.businessId! está garantizado (no puede ser undefined)
    const product = await productService.getById(authReq.businessId!, req.params.id);
    
    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
});
```

---

## 6. Errores Comunes

### ❌ Error 1: Olvidar Validar Propiedad

```typescript
// INCORRECTO
async getProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
  });
  // FALTA: Validar que product.businessId === authReq.businessId
}
```

**Solución:** Siempre validar propiedad después de obtener la entidad.

### ❌ Error 2: Olvidar Filtrar por BusinessId

```typescript
// INCORRECTO
async listProducts() {
  return prisma.product.findMany({
    // FALTA: where: { businessId }
  });
}
```

**Solución:** Siempre filtrar por `businessId` en queries.

### ❌ Error 3: Olvidar Asignar BusinessId

```typescript
// INCORRECTO
async createProduct(data: CreateProductInput) {
  return prisma.product.create({
    data: {
      // FALTA: businessId
      name: data.name,
      price: data.price,
    },
  });
}
```

**Solución:** Siempre asignar `businessId` al crear entidades.

### ❌ Error 4: No Validar Relaciones

```typescript
// INCORRECTO
async createSale(customerId: string) {
  return prisma.sale.create({
    data: {
      customerId,
      // FALTA: Validar que customer.businessId === authReq.businessId
    },
  });
}
```

**Solución:** Validar que todas las relaciones pertenecen al mismo `businessId`.

---

## 7. Testing

### 7.1 Test de Aislamiento

```typescript
describe('Multi-Tenant Isolation', () => {
  it('User A cannot access data from Business B', async () => {
    // 1. Crear dos negocios
    const business1 = await createBusiness('Business 1');
    const business2 = await createBusiness('Business 2');

    // 2. Crear usuarios
    const user1 = await createUser(business1.id);
    const user2 = await createUser(business2.id);

    // 3. Crear producto en business1
    const product = await createProduct(business1.id);

    // 4. User2 intenta acceder a producto de business1
    const token2 = generateToken(user2.id, business2.id);
    const response = await request(app)
      .get(`/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${token2}`);

    // 5. Debe retornar 403 Forbidden
    expect(response.status).toBe(403);
  });
});
```

---

## 8. Checklist de Seguridad

- [ ] Todas las entidades tienen `businessId`
- [ ] Todas las rutas aplican `authenticate` + `multiTenant`
- [ ] Todos los servicios validan propiedad de entidades
- [ ] Todas las queries filtran por `businessId`
- [ ] Todas las creaciones asignan `businessId`
- [ ] Todas las relaciones validan `businessId`
- [ ] Todas las operaciones se registran en auditoría
- [ ] Índices en `businessId` para performance
- [ ] Tests de aislamiento implementados

---

## 9. Referencias

- `@/d:\Reespaldo\Proyectos\saas-ferreteria\ferresaas-api\src\middleware\auth.ts` - Autenticación
- `@/d:\Reespaldo\Proyectos\saas-ferreteria\ferresaas-api\src\middleware\multi-tenant.ts` - Multi-Tenant
- `@/d:\Reespaldo\Proyectos\saas-ferreteria\ferresaas-api\src\services\product.service.ts` - Ejemplo de Servicio
- `@/d:\Reespaldo\Proyectos\saas-ferreteria\ferresaas-api\src\routes\products.routes.ts` - Ejemplo de Rutas

---

**Última actualización:** 2 de Febrero, 2026
