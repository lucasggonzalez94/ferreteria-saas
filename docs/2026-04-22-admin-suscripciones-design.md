# Sistema de Admin y Suscripciones - Diseño

Fecha: 2026-04-22
Proyecto: FerreSaaS (Ferretería SaaS)

---

## 1. Overview

Sistema de administración para gestionar el SaaS multi-tenant de ferreterías:
- Gestión de usuarios por negocio (alta, baja, roles)
- Suscripciones con trials y planes
- Dashboard admin para operaciones

## 2. Arquitectura

### 2.1 Decisión: Mismo Proyecto

El dashboard admin será parte del mismo proyecto FerreSaaS, con un módulo interno `/admin` accesible solo para usuarios con rol OWNER.

### 2.2 Flujo Actual

```
User login → [¿Es OWNER?] → Sí → Access /admin
                          No → Redirigir a /dashboard
```

## 3. Modelo de Datos

### 3.1 Subscription (nuevo)

```prisma
model Subscription {
  id              String   @id @default(cuid())
  businessId      String   @unique
  
  // Plan
  plan            String   @default("FREE") // FREE, BASIC, PRO, ENTERPRISE
  status          String   @default("ACTIVE") // TRIAL, ACTIVE, PAST_DUE, CANCELLED, EXPIRED
  
  // Fechas
  trialStartDate  DateTime?
  trialEndDate    DateTime?
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime
  
  // Cancelación
  cancelAtPeriodEnd Boolean @default(false)
  cancellationReason String?
  cancelledAt      DateTime?
  
  // Notas internas (para el admin)
  adminNotes     String?
  
  createdAt      DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relaciones
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}
```

### 3.2 Planes

| Plan | Usuarios | Features | Precio (USD) |
|------|----------|----------|-------------|
| FREE | 1 | Productos básicos, 100 items | $0 |
| BASIC | 3 | Productos, ventas, reportes | $15/mo |
| PRO | Ilimitados | Todo + multi-usuario API | $29/mo |
| ENTERPRISE | Ilimitados | Soporte prioritario | $49/mo |

### 3.3 Extensión Business

Agregar a Business:
```prisma
isRoot  Boolean @default(false)  // true = puede vedere todos los negocios
```

## 4. API

### 4.1 Endpoints de Suscripción

| Método | Endpoint | Descripción |
|-------|---------|-------------|
| GET | /api/admin/subscriptions | Listar todas (solo isRoot) |
| GET | /api/admin/subscriptions/:id | Ver detalle |
| POST | /api/admin/subscriptions | Crear suscripción |
| PATCH | /api/admin/subscriptions/:id | Actualizar plan |
| POST | /api/admin/subscriptions/:id/start-trial | Iniciar trial |
| POST | /api/admin/subscriptions/:id/extend-trial | Extender trial |
| POST | /api/admin/subscriptions/:id/cancel | Cancelar |
| POST | /api/admin/subscriptions/:id/reactivate | Reactivar |

### 4.2 Endpoints de Usuario (ya existen)

Usar endpoints existentes del UserService:
- `POST /api/users` - Crear usuario
- `GET /api/users` - Listar usuarios
- `PATCH /api/users/:id` - Actualizar
- `DELETE /api/users/:id` - Desactivar (soft delete)
- `POST /api/users/:id/reset-password` - Reset password

## 5. Frontend

### 5.1 Rutas

```
/admin              → Dashboard principal
/admin/users        → Gestión de usuarios
/admin/subscriptions → Gestión de suscripciones
/admin/settings    → Configuración del sistema
```

### 5.2 Componentes

- **AdminUsersPage**: Tabla de usuarios con acciones
- **AdminSubscriptionsPage**: Tabla de negocios + suscripción
- **UserModal**: Crear/editar usuario
- **SubscriptionModal**: Gestionar suscripción

### 5.3 Permisos

- `isRoot = true` → Ve todos los negocios
- `OWNER` → Solo su negocio

## 6. Casos de Uso

### 6.1 Alta de Nuevo Cliente

```
1. Admin va a /admin/subscriptions
2. Click "Nuevo Cliente"
3. Ingresa: nombre negocio, CUIT, email owner
4. Sistema crea: Business + User + Subscription(FREE/trial)
5. Envía email con credenciales
```

### 6.2 Dar Periodo Gratuito

```
1. Admin busca cliente
2. Click "Extender Trial"
3. Selecciona duración (7, 15, 30 días)
4. Confirma
5. Notificación al cliente
```

### 6.3 Cancelar Suscripción

```
1. Admin busca cliente
2. Click "Cancelar"
3. Selecciona motivo
4. Confirmar
5. cancelAtPeriodEnd = true
6. Al到期, status = CANCELLED
```

## 7. Validaciones

- No permitir trial si ya tuvo trial activo
- Solo isRoot puede ver otros negocios
- Cancelación no es inmediata (al fin de período)
- Historial de cambios en auditoría

## 8. Pendientes (No en scope)

- Webhook de pago (MercadoPago Stripe)
- Facturación automática
- Notificaciones por email
- Panel de self-service para clientes